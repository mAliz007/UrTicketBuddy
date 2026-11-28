import {
  Client,
  ClientOptions,
  errors as esErrors,
} from "@elastic/elasticsearch";
import { loadEnv } from "@urticketbuddy/config";
import { AppDataSource, Event } from "@urticketbuddy/db";
import { DataSource } from "typeorm";
import {
  EVENTS_INDEX_PATTERN,
  EVENTS_INDEX_SETTINGS,
  EVENTS_INDEX_MAPPINGS,
  EVENTS_INDEX_TEMPLATE_NAME,
} from "../processors/search-index.schema";

export interface ReindexOptions {
  esClient: Client;
  dataSource: DataSource;
  aliasName?: string;
  batchSize?: number;
}

export interface ReindexResult {
  newIndex: string;
  previousIndices: string[];
  indexedCount: number;
}

export function parseIndexVersion(
  indexName: string,
  aliasName: string,
): number {
  const escaped = aliasName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}_v(\\d+)$`).exec(indexName);
  return match ? Number(match[1]) : 0;
}

export function computeNextIndexName(
  existingIndices: string[],
  aliasName: string,
): string {
  const maxVersion = existingIndices.reduce((max, idx) => {
    const v = parseIndexVersion(idx, aliasName);
    return v > max ? v : max;
  }, 0);
  return `${aliasName}_v${maxVersion + 1}`;
}

async function getExistingAliasIndices(
  esClient: Client,
  aliasName: string,
): Promise<string[]> {
  try {
    const res = await esClient.indices.getAlias({ name: aliasName });
    return Object.keys(res);
  } catch (err) {
    const statusCode =
      err instanceof esErrors.ResponseError
        ? err.statusCode
        : ((err as { statusCode?: number; meta?: { statusCode?: number } })
            ?.statusCode ??
          (err as { meta?: { statusCode?: number } })?.meta?.statusCode);
    if (statusCode === 404) {
      return [];
    }
    throw err;
  }
}

async function getMatchingVersionedIndices(
  esClient: Client,
  aliasName: string,
): Promise<string[]> {
  try {
    const res = await esClient.indices.get({ index: `${aliasName}_v*` });
    return Object.keys(res);
  } catch (err) {
    const statusCode =
      err instanceof esErrors.ResponseError
        ? err.statusCode
        : ((err as { statusCode?: number; meta?: { statusCode?: number } })
            ?.statusCode ??
          (err as { meta?: { statusCode?: number } })?.meta?.statusCode);
    if (statusCode === 404) {
      return [];
    }
    throw err;
  }
}

export async function reindexEvents(
  options: ReindexOptions,
): Promise<ReindexResult> {
  const {
    esClient,
    dataSource,
    aliasName = "events",
    batchSize = 500,
  } = options;

  // 1. Ensure template exists and inspect existing versioned indices
  await esClient.indices.putIndexTemplate({
    name: EVENTS_INDEX_TEMPLATE_NAME,
    index_patterns: [EVENTS_INDEX_PATTERN],
    template: {
      settings: EVENTS_INDEX_SETTINGS,
      mappings: EVENTS_INDEX_MAPPINGS,
    },
  });

  const aliasIndices = await getExistingAliasIndices(esClient, aliasName);
  const versionedIndices = await getMatchingVersionedIndices(
    esClient,
    aliasName,
  );
  const allKnown = Array.from(new Set([...aliasIndices, ...versionedIndices]));
  const newIndex = computeNextIndexName(allKnown, aliasName);

  // 2. Create new versioned index
  await esClient.indices.create({
    index: newIndex,
    settings: EVENTS_INDEX_SETTINGS,
    mappings: EVENTS_INDEX_MAPPINGS,
  });

  // 3. Stream PUBLISHED events from Postgres in batches and bulk-index into newIndex
  const eventRepo = dataSource.getRepository(Event);
  let skip = 0;
  let indexedCount = 0;

  while (true) {
    const batch = await eventRepo
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.venue", "venue")
      .where("event.status = :status", { status: "PUBLISHED" })
      .orderBy("event.id", "ASC")
      .skip(skip)
      .take(batchSize)
      .getMany();

    if (batch.length === 0) {
      break;
    }

    const operations = batch.flatMap((event) => {
      const startsAt =
        event.startTime instanceof Date
          ? event.startTime.toISOString()
          : new Date(event.startTime).toISOString();

      const doc = {
        id: event.id,
        title: event.name,
        description: "",
        city: event.venue?.location ?? "",
        category: "general",
        startsAt,
        status: event.status,
        venueId: event.venueId,
        venueName: event.venue?.name ?? "",
        location: null,
        minPrice: 0,
        maxPrice: 0,
      };

      return [{ index: { _index: newIndex, _id: event.id } }, doc];
    });

    const bulkRes = await esClient.bulk({ operations });
    if (bulkRes.errors) {
      throw new Error(
        `Elasticsearch bulk indexing reported item errors into ${newIndex}`,
      );
    }

    indexedCount += batch.length;
    skip += batch.length;

    if (batch.length < batchSize) {
      break;
    }
  }

  await esClient.indices.refresh({ index: newIndex });

  // 4. Atomically swap the alias in a single updateAliases call
  const actions: Array<
    | { remove: { index: string; alias: string } }
    | { add: { index: string; alias: string } }
  > = [
    ...aliasIndices.map((idx) => ({
      remove: { index: idx, alias: aliasName },
    })),
    { add: { index: newIndex, alias: aliasName } },
  ];

  await esClient.indices.updateAliases({ actions });

  // 5. Delete previous indices
  const previousIndices = allKnown.filter((idx) => idx !== newIndex);
  if (previousIndices.length > 0) {
    await esClient.indices.delete({ index: previousIndices });
  }

  return {
    newIndex,
    previousIndices,
    indexedCount,
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const options: ClientOptions = { node: env.ELASTICSEARCH_NODE };
  if (env.ELASTICSEARCH_API_KEY) {
    options.auth = { apiKey: env.ELASTICSEARCH_API_KEY };
  } else if (env.ELASTICSEARCH_USERNAME && env.ELASTICSEARCH_PASSWORD) {
    options.auth = {
      username: env.ELASTICSEARCH_USERNAME,
      password: env.ELASTICSEARCH_PASSWORD,
    };
  }

  const esClient = new Client(options);

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const result = await reindexEvents({
      esClient,
      dataSource: AppDataSource,
      aliasName: env.ELASTICSEARCH_INDEX_ALIAS,
      batchSize: 500,
    });

    console.log(
      JSON.stringify({
        status: "ok",
        alias: env.ELASTICSEARCH_INDEX_ALIAS,
        ...result,
      }),
    );
  } finally {
    await esClient.close().catch(() => undefined);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy().catch(() => undefined);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Search reindex failed:", err);
    process.exit(1);
  });
}
