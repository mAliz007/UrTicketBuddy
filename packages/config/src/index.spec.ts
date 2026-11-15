import { envSchema, loadEnv } from "./index";

describe("packages/config env loader", () => {
  it("should validate default environment correctly", () => {
    const parsed = envSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.API_PORT).toBe(3000);
      expect(parsed.data.POSTGRES_PORT).toBe(6432);
      expect(parsed.data.NODE_ENV).toBe("development");
    }
  });

  it("should load environment variables", () => {
    const env = loadEnv();
    expect(env).toBeDefined();
    expect(typeof env.API_PORT).toBe("number");
  });
});
