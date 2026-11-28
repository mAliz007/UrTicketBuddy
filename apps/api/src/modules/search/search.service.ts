import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Client } from "@elastic/elasticsearch";
import { Repository } from "typeorm";
import { loadEnv } from "@urticketbuddy/config";
import {
  SearchBackend,
  SearchEventItem,
  SearchEventsQuery,
  SearchEventsResponse,
  SearchSuggestItem,
  SearchSuggestQuery,
  SearchSuggestResponse,
} from "@urticketbuddy/contracts";
import { Event } from "@urticketbuddy/db";
import { EVENT_REPOSITORY } from "../../database/database.tokens";
import { ELASTICSEARCH_CLIENT } from "./search.tokens";
import {
  buildSearchEventsQuery,
  buildSuggestQuery,
} from "./search-query.builder";
import { SearchCircuitBreaker } from "./search-circuit-breaker";

export interface SearchEventsOutcome {
  result: SearchEventsResponse;
  backend: SearchBackend;
}

export interface SearchSuggestOutcome {
  result: SearchSuggestResponse;
  backend: SearchBackend;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly aliasName: string;
  private readonly circuitBreaker: SearchCircuitBreaker;

  constructor(
    @Inject(ELASTICSEARCH_CLIENT)
    private readonly esClient: Client,
    @Inject(EVENT_REPOSITORY)
    private readonly eventRepository: Repository<Event>,
    @Optional()
    circuitBreaker?: SearchCircuitBreaker,
  ) {
    const env = loadEnv();
    this.aliasName = env.ELASTICSEARCH_INDEX_ALIAS;
    this.circuitBreaker =
      circuitBreaker ??
      new SearchCircuitBreaker({
        failureThreshold: env.SEARCH_CB_FAILURE_THRESHOLD,
        cooldownMs: env.SEARCH_CB_COOLDOWN_MS,
      });
  }

  getCircuitBreaker(): SearchCircuitBreaker {
    return this.circuitBreaker;
  }

  async searchEvents(query: SearchEventsQuery): Promise<SearchEventsOutcome> {
    if (this.circuitBreaker.canAttempt()) {
      try {
        const esQuery = buildSearchEventsQuery(query);
        const response = await this.esClient.search<SearchEventItem>({
          index: this.aliasName,
          ...esQuery,
        });

        this.circuitBreaker.recordSuccess();

        const totalRaw = response.hits.total;
        const total =
          typeof totalRaw === "number" ? totalRaw : (totalRaw?.value ?? 0);

        const items: SearchEventItem[] = response.hits.hits
          .map((hit) => hit._source)
          .filter((src): src is SearchEventItem => Boolean(src));

        return {
          result: {
            items,
            page: query.page,
            pageSize: query.pageSize,
            total,
          },
          backend: "elasticsearch",
        };
      } catch (err) {
        this.circuitBreaker.recordFailure();
        this.logger.warn(
          `Elasticsearch searchEvents failed (circuit=${this.circuitBreaker.getState()}, failures=${this.circuitBreaker.getConsecutiveFailures()}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const fallbackResult = await this.searchEventsFromPostgres(query);
    return {
      result: fallbackResult,
      backend: "postgres-fallback",
    };
  }

  async suggestEvents(
    query: SearchSuggestQuery,
  ): Promise<SearchSuggestOutcome> {
    if (this.circuitBreaker.canAttempt()) {
      try {
        const esQuery = buildSuggestQuery(query);
        const response = await this.esClient.search<SearchSuggestItem>({
          index: this.aliasName,
          ...esQuery,
        });

        this.circuitBreaker.recordSuccess();

        const suggestions: SearchSuggestItem[] = response.hits.hits
          .map((hit) => hit._source)
          .filter((src): src is SearchSuggestItem => Boolean(src))
          .map((src) => ({
            id: src.id,
            title: src.title,
            city: src.city ?? "",
          }));

        return {
          result: { suggestions },
          backend: "elasticsearch",
        };
      } catch (err) {
        this.circuitBreaker.recordFailure();
        this.logger.warn(
          `Elasticsearch suggestEvents failed (circuit=${this.circuitBreaker.getState()}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const fallbackSuggestions = await this.suggestFromPostgres(query);
    return {
      result: fallbackSuggestions,
      backend: "postgres-fallback",
    };
  }

  async checkAliasExists(): Promise<boolean> {
    try {
      const exists = await this.esClient.indices.existsAlias({
        name: this.aliasName,
      });
      return Boolean(exists);
    } catch {
      return false;
    }
  }

  private async searchEventsFromPostgres(
    query: SearchEventsQuery,
  ): Promise<SearchEventsResponse> {
    const qb = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.venue", "venue")
      .where("event.status = :status", { status: "PUBLISHED" });

    if (query.q) {
      qb.andWhere(
        "(LOWER(event.name) LIKE :q OR LOWER(venue.location) LIKE :q OR LOWER(venue.name) LIKE :q)",
        { q: `%${query.q.toLowerCase()}%` },
      );
    }

    if (query.city) {
      qb.andWhere("LOWER(venue.location) = LOWER(:city)", {
        city: query.city,
      });
    }

    if (query.from) {
      qb.andWhere("event.startTime >= :from", {
        from: new Date(query.from),
      });
    }

    if (query.to) {
      qb.andWhere("event.startTime <= :to", {
        to: new Date(query.to),
      });
    }

    if (query.sort === "date_desc") {
      qb.orderBy("event.startTime", "DESC");
    } else {
      qb.orderBy("event.startTime", "ASC");
    }

    qb.skip((query.page - 1) * query.pageSize).take(query.pageSize);

    const [events, total] = await qb.getManyAndCount();

    const items: SearchEventItem[] = events.map((event) => ({
      id: event.id,
      title: event.name,
      description: "",
      city: event.venue?.location ?? "",
      category: "general",
      startsAt:
        event.startTime instanceof Date
          ? event.startTime.toISOString()
          : new Date(event.startTime).toISOString(),
      status: event.status,
      venueId: event.venueId,
      venueName: event.venue?.name,
      location: null,
      minPrice: 0,
      maxPrice: 0,
    }));

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  private async suggestFromPostgres(
    query: SearchSuggestQuery,
  ): Promise<SearchSuggestResponse> {
    const qb = this.eventRepository
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.venue", "venue")
      .where("event.status = :status", { status: "PUBLISHED" })
      .andWhere(
        "(LOWER(event.name) LIKE :q OR LOWER(venue.location) LIKE :q)",
        { q: `%${query.q.toLowerCase()}%` },
      )
      .orderBy("event.startTime", "ASC")
      .take(query.limit);

    const events = await qb.getMany();

    return {
      suggestions: events.map((event) => ({
        id: event.id,
        title: event.name,
        city: event.venue?.location ?? "",
      })),
    };
  }
}
