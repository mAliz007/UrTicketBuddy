import { Client } from "@elastic/elasticsearch";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { Event } from "@urticketbuddy/db";
import { Repository } from "typeorm";
import { ensureEventsIndexTemplateAndAlias } from "../src/modules/search/search.index";
import { SearchService } from "../src/modules/search/search.service";
import { SearchCircuitBreaker } from "../src/modules/search/search-circuit-breaker";

jest.setTimeout(180_000);

describe("Search Elasticsearch Integration (Testcontainers / CI)", () => {
  let container: StartedTestContainer | undefined;
  let esClient: Client;
  let searchService: SearchService;
  let skipSuite = false;

  const mockEventRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeAll(async () => {
    if (process.env.SKIP_INTEGRATION_TESTS === "true") {
      skipSuite = true;
      return;
    }

    let nodeUrl = process.env.ELASTICSEARCH_NODE;

    if (nodeUrl) {
      try {
        const probe = new Client({ node: nodeUrl, requestTimeout: 2000 });
        await probe.ping();
        await probe.close();
      } catch {
        nodeUrl = undefined;
      }
    }

    if (!nodeUrl) {
      try {
        container = await new GenericContainer(
          "docker.elastic.co/elasticsearch/elasticsearch:8.17.2",
        )
          .withEnvironment({
            "discovery.type": "single-node",
            "xpack.security.enabled": "false",
            ES_JAVA_OPTS: "-Xms512m -Xmx512m",
          })
          .withExposedPorts(9200)
          .start();

        nodeUrl = `http://${container.getHost()}:${container.getMappedPort(9200)}`;
      } catch {
        console.warn(
          "Skipping Elasticsearch Testcontainers integration tests (no container runtime or Elasticsearch available)",
        );
        skipSuite = true;
        return;
      }
    }

    esClient = new Client({ node: nodeUrl });
    await ensureEventsIndexTemplateAndAlias(esClient, "events", "events_v1");

    searchService = new SearchService(
      esClient,
      mockEventRepo as unknown as Repository<Event>,
      new SearchCircuitBreaker({ failureThreshold: 3, cooldownMs: 5000 }),
    );
  });

  afterAll(async () => {
    if (esClient) {
      await esClient.close().catch(() => undefined);
    }
    if (container) {
      await container.stop().catch(() => undefined);
    }
  });

  it("indexes events idempotently, supports typeahead, city/date/geo filters, delete, and alias swap", async () => {
    if (skipSuite) {
      return;
    }

    const eventA = "11111111-1111-4111-8111-111111111111";
    const eventB = "22222222-2222-4222-8222-222222222222";
    const venueA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const venueB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const docA = {
      id: eventA,
      title: "Rockstar Arena Tour",
      description: "Electric rock concert",
      city: "Lahore",
      category: "music",
      startsAt: "2026-12-10T19:00:00.000Z",
      status: "PUBLISHED",
      venueId: venueA,
      venueName: "Alhamra",
      location: { lat: 31.5204, lon: 74.3587 },
      minPrice: 2000,
      maxPrice: 8000,
    };

    const docB = {
      id: eventB,
      title: "Tech Summit Expo",
      description: "Annual developer conference",
      city: "Karachi",
      category: "tech",
      startsAt: "2026-12-20T10:00:00.000Z",
      status: "PUBLISHED",
      venueId: venueB,
      venueName: "Expo Center",
      location: { lat: 24.8607, lon: 67.0011 },
      minPrice: 500,
      maxPrice: 1500,
    };

    // Idempotent indexing (index same doc twice -> still 1 doc)
    await esClient.index({ index: "events", id: eventA, document: docA });
    await esClient.index({ index: "events", id: eventA, document: docA });
    await esClient.index({
      index: "events",
      id: eventB,
      document: docB,
      refresh: "wait_for",
    });

    // Prefix typeahead suggest
    const suggestRes = await searchService.suggestEvents({
      q: "roc",
      limit: 8,
    });
    expect(suggestRes.backend).toBe("elasticsearch");
    expect(suggestRes.result.suggestions.map((s) => s.id)).toContain(eventA);

    // City + date range filter
    const cityDateRes = await searchService.searchEvents({
      city: "Lahore",
      from: "2026-12-01T00:00:00Z",
      to: "2026-12-15T00:00:00Z",
      sort: "relevance",
      page: 1,
      pageSize: 20,
    });
    expect(cityDateRes.result.total).toBe(1);
    expect(cityDateRes.result.items[0]?.id).toBe(eventA);

    // Geo filter near Lahore (excludes Karachi ~1000km away)
    const geoRes = await searchService.searchEvents({
      lat: 31.5204,
      lng: 74.3587,
      radiusKm: 50,
      sort: "relevance",
      page: 1,
      pageSize: 20,
    });
    expect(geoRes.result.total).toBe(1);
    expect(geoRes.result.items[0]?.id).toBe(eventA);

    // Delete eventB and verify removal
    await esClient.delete({
      index: "events",
      id: eventB,
      refresh: "wait_for",
    });
    const afterDelete = await searchService.searchEvents({
      city: "Karachi",
      sort: "relevance",
      page: 1,
      pageSize: 20,
    });
    expect(afterDelete.result.total).toBe(0);

    // Alias swap during reindex: create events_v2, index docA, swap alias atomically, delete events_v1
    await esClient.indices.create({ index: "events_v2" });
    await esClient.index({
      index: "events_v2",
      id: eventA,
      document: docA,
      refresh: "wait_for",
    });
    await esClient.indices.updateAliases({
      actions: [
        { remove: { index: "events_v1", alias: "events" } },
        { add: { index: "events_v2", alias: "events" } },
      ],
    });
    await esClient.indices.delete({ index: "events_v1" });

    const aliasMap = await esClient.indices.getAlias({ name: "events" });
    expect(Object.keys(aliasMap)).toEqual(["events_v2"]);
    expect(await searchService.checkAliasExists()).toBe(true);
  });
});
