import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts", "**/*.test.ts", "**/*.e2e-spec.ts"],
};

export default config;
