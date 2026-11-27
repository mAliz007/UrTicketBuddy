import { Client } from "@elastic/elasticsearch";

export const EVENTS_INDEX_TEMPLATE_NAME = "events_template";
export const EVENTS_INDEX_PATTERN = "events_v*";
export const EVENTS_INITIAL_INDEX = "events_v1";

export const EVENTS_INDEX_SETTINGS = {
  analysis: {
    tokenizer: {
      edge_ngram_tokenizer: {
        type: "edge_ngram" as const,
        min_gram: 2,
        max_gram: 20,
        token_chars: ["letter" as const, "digit" as const],
      },
    },
    analyzer: {
      edge_ngram_index: {
        type: "custom" as const,
        tokenizer: "edge_ngram_tokenizer",
        filter: ["lowercase", "asciifolding"],
      },
      edge_ngram_search: {
        type: "custom" as const,
        tokenizer: "standard",
        filter: ["lowercase", "asciifolding"],
      },
    },
  },
};

export const EVENTS_INDEX_MAPPINGS = {
  properties: {
    id: { type: "keyword" as const },
    title: {
      type: "text" as const,
      analyzer: "edge_ngram_index",
      search_analyzer: "edge_ngram_search",
      fields: {
        keyword: { type: "keyword" as const },
        standard: { type: "text" as const, analyzer: "standard" },
      },
    },
    description: {
      type: "text" as const,
      analyzer: "edge_ngram_index",
      search_analyzer: "edge_ngram_search",
      fields: {
        standard: { type: "text" as const, analyzer: "standard" },
      },
    },
    city: {
      type: "keyword" as const,
      fields: {
        text: {
          type: "text" as const,
          analyzer: "edge_ngram_index",
          search_analyzer: "edge_ngram_search",
        },
      },
    },
    category: { type: "keyword" as const },
    startsAt: { type: "date" as const },
    status: { type: "keyword" as const },
    venueId: { type: "keyword" as const },
    venueName: {
      type: "text" as const,
      fields: {
        keyword: { type: "keyword" as const },
      },
    },
    location: { type: "geo_point" as const },
    minPrice: { type: "double" as const },
    maxPrice: { type: "double" as const },
  },
};

export async function ensureEventsIndexTemplateAndAlias(
  client: Client,
  aliasName = "events",
  initialIndexName = EVENTS_INITIAL_INDEX,
): Promise<void> {
  await client.indices.putIndexTemplate({
    name: EVENTS_INDEX_TEMPLATE_NAME,
    index_patterns: [EVENTS_INDEX_PATTERN],
    template: {
      settings: EVENTS_INDEX_SETTINGS,
      mappings: EVENTS_INDEX_MAPPINGS,
    },
  });

  const aliasExists = await client.indices.existsAlias({ name: aliasName });
  if (!aliasExists) {
    const initialExists = await client.indices.exists({
      index: initialIndexName,
    });
    if (!initialExists) {
      await client.indices.create({
        index: initialIndexName,
        settings: EVENTS_INDEX_SETTINGS,
        mappings: EVENTS_INDEX_MAPPINGS,
        aliases: {
          [aliasName]: {},
        },
      });
    } else {
      await client.indices.putAlias({
        index: initialIndexName,
        name: aliasName,
      });
    }
  }
}
