import { envSchema, loadEnv } from "./index";

describe("packages/config env loader", () => {
  it("should validate default environment correctly", () => {
    const parsed = envSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.API_PORT).toBe(3000);
      expect(parsed.data.POSTGRES_PORT).toBe(6432);
      expect(parsed.data.NODE_ENV).toBe("development");
      expect(parsed.data.STORAGE_PROVIDER).toBe("local");
      expect(parsed.data.S3_BUCKET).toBe("urticketbuddy-media");
      expect(parsed.data.CDN_BASE_URL).toBe("http://localhost:3000/media");
      expect(parsed.data.ELASTICSEARCH_NODE).toBe("http://localhost:9200");
      expect(parsed.data.ELASTICSEARCH_INDEX_ALIAS).toBe("events");
      expect(parsed.data.SEARCH_CB_FAILURE_THRESHOLD).toBe(3);
      expect(parsed.data.SEARCH_CB_COOLDOWN_MS).toBe(30000);
    }
  });

  it("should load environment variables", () => {
    const env = loadEnv();
    expect(env).toBeDefined();
    expect(typeof env.API_PORT).toBe("number");
  });
});
