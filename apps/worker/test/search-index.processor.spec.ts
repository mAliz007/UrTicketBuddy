import { Client } from "@elastic/elasticsearch";
import { UnrecoverableError } from "bullmq";
import { DataSource } from "typeorm";
import { SearchIndexProcessor } from "../src/processors/search-index.processor";
import { reindexEvents } from "../src/scripts/search-reindex";

describe("SearchIndexProcessor & Reindex CLI", () => {
  const eventId = "11111111-1111-4111-8111-111111111111";
  const venueId = "22222222-2222-4222-8222-222222222222";

  const mockEsClient = {
    indices: {
      putIndexTemplate: jest.fn().mockResolvedValue({ acknowledged: true }),
      existsAlias: jest.fn().mockResolvedValue(true),
      exists: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockResolvedValue({ acknowledged: true }),
      putAlias: jest.fn().mockResolvedValue({ acknowledged: true }),
      getAlias: jest.fn(),
      get: jest.fn(),
      refresh: jest.fn().mockResolvedValue({}),
      updateAliases: jest.fn().mockResolvedValue({ acknowledged: true }),
      delete: jest.fn().mockResolvedValue({ acknowledged: true }),
    },
    index: jest.fn().mockResolvedValue({ result: "created" }),
    delete: jest.fn().mockResolvedValue({ result: "deleted" }),
    bulk: jest.fn().mockResolvedValue({ errors: false, items: [] }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("indexes and updates published events idempotently using deterministic document ID", async () => {
    const processor = new SearchIndexProcessor(
      mockEsClient as unknown as Client,
      null,
    );

    const payload = {
      action: "index" as const,
      eventId,
      title: "Indie Concert",
      city: "Karachi",
      category: "music",
      startsAt: "2026-12-20T19:00:00.000Z",
      status: "PUBLISHED",
      venueId,
      minPrice: 1000,
      maxPrice: 3000,
    };

    const first = await processor.processSearchIndexJob(payload);
    const second = await processor.processSearchIndexJob({
      ...payload,
      action: "update" as const,
    });

    expect(first).toEqual({ action: "indexed", id: eventId });
    expect(second).toEqual({ action: "updated", id: eventId });
    expect(mockEsClient.index).toHaveBeenCalledTimes(2);
    expect(mockEsClient.index).toHaveBeenNthCalledWith(1, {
      index: "events",
      id: eventId,
      document: expect.objectContaining({
        id: eventId,
        title: "Indie Concert",
        city: "Karachi",
        status: "PUBLISHED",
      }),
    });
  });

  it("deletes cancelled or draft events from index and treats missing 404 deletes idempotently", async () => {
    const processor = new SearchIndexProcessor(
      mockEsClient as unknown as Client,
      null,
    );

    const cancelled = await processor.processSearchIndexJob({
      action: "update",
      eventId,
      title: "Cancelled Concert",
      status: "CANCELLED",
    });
    expect(cancelled).toEqual({ action: "deleted", id: eventId });

    mockEsClient.delete.mockRejectedValueOnce({ statusCode: 404 });
    const missingDelete = await processor.processSearchIndexJob({
      action: "delete",
      eventId,
    });
    expect(missingDelete).toEqual({ action: "deleted", id: eventId });
  });

  it("throws UnrecoverableError on invalid job payload and rethrows transient ES failures for BullMQ retry", async () => {
    const processor = new SearchIndexProcessor(
      mockEsClient as unknown as Client,
      null,
    );

    await expect(
      processor.processSearchIndexJob({ action: "invalid" }),
    ).rejects.toThrow(UnrecoverableError);

    mockEsClient.index.mockRejectedValueOnce(new Error("ES timeout"));
    await expect(
      processor.processSearchIndexJob({
        action: "index",
        eventId,
        title: "Retry Event",
        status: "PUBLISHED",
      }),
    ).rejects.toThrow("ES timeout");
  });

  it("reindexEvents builds events_v2 from Postgres batches, atomically swaps alias, and deletes events_v1", async () => {
    mockEsClient.indices.getAlias.mockResolvedValueOnce({
      events_v1: { aliases: { events: {} } },
    });
    mockEsClient.indices.get.mockResolvedValueOnce({
      events_v1: {},
    });

    const mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValueOnce([
        {
          id: eventId,
          venueId,
          name: "Reindexed Concert",
          startTime: new Date("2026-12-25T19:00:00Z"),
          status: "PUBLISHED",
          venue: { id: venueId, name: "Main Hall", location: "Islamabad" },
        },
      ]),
    };

    const mockDataSource = {
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => mockQb),
      })),
    };

    const res = await reindexEvents({
      esClient: mockEsClient as unknown as Client,
      dataSource: mockDataSource as unknown as DataSource,
      aliasName: "events",
      batchSize: 500,
    });

    expect(res).toEqual({
      newIndex: "events_v2",
      previousIndices: ["events_v1"],
      indexedCount: 1,
    });

    expect(mockEsClient.indices.create).toHaveBeenCalledWith(
      expect.objectContaining({ index: "events_v2" }),
    );
    expect(mockEsClient.bulk).toHaveBeenCalledTimes(1);
    expect(mockEsClient.indices.updateAliases).toHaveBeenCalledWith({
      actions: [
        { remove: { index: "events_v1", alias: "events" } },
        { add: { index: "events_v2", alias: "events" } },
      ],
    });
    expect(mockEsClient.indices.delete).toHaveBeenCalledWith({
      index: ["events_v1"],
    });
  });
});
