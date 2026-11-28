import { z } from "zod";
import { EventSearchGeoPointSchema } from "./jobs";

export const SearchBackendSchema = z.enum([
  "elasticsearch",
  "postgres-fallback",
]);

export type SearchBackend = z.infer<typeof SearchBackendSchema>;

export const SearchSortSchema = z.enum([
  "relevance",
  "date_asc",
  "date_desc",
  "price_asc",
  "price_desc",
]);

export type SearchSort = z.infer<typeof SearchSortSchema>;

const dateStringSchema = z
  .string()
  .trim()
  .refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid ISO date string",
  });

export const SearchEventsQuerySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(20000).optional(),
    sort: SearchSortSchema.default("relevance"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine(
    (data) => {
      const hasAnyGeo =
        data.lat !== undefined ||
        data.lng !== undefined ||
        data.radiusKm !== undefined;
      if (!hasAnyGeo) return true;
      return (
        data.lat !== undefined &&
        data.lng !== undefined &&
        data.radiusKm !== undefined
      );
    },
    {
      message:
        "lat, lng, and radiusKm must all be provided together for geo search",
    },
  );

export type SearchEventsQuery = z.infer<typeof SearchEventsQuerySchema>;

export const SearchEventItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().default(""),
  city: z.string(),
  category: z.string(),
  startsAt: z.string(),
  status: z.string(),
  venueId: z.string().uuid(),
  venueName: z.string().optional(),
  location: EventSearchGeoPointSchema.nullable().optional(),
  minPrice: z.number().nonnegative(),
  maxPrice: z.number().nonnegative(),
});

export type SearchEventItem = z.infer<typeof SearchEventItemSchema>;

export const SearchEventsResponseSchema = z.object({
  items: z.array(SearchEventItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
});

export type SearchEventsResponse = z.infer<typeof SearchEventsResponseSchema>;

export const SearchSuggestQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100),
    limit: z.coerce.number().int().min(1).max(20).default(8),
  })
  .strict();

export type SearchSuggestQuery = z.infer<typeof SearchSuggestQuerySchema>;

export const SearchSuggestItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  city: z.string(),
});

export type SearchSuggestItem = z.infer<typeof SearchSuggestItemSchema>;

export const SearchSuggestResponseSchema = z.object({
  suggestions: z.array(SearchSuggestItemSchema),
});

export type SearchSuggestResponse = z.infer<typeof SearchSuggestResponseSchema>;
