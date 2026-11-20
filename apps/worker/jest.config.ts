import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.spec.ts", "**/*.test.ts"],
  transform: {
    "^.+\\.[tj]s$": [
      "ts-jest",
      {
        tsconfig: {
          allowJs: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm/@nestjs\\+schedule|@nestjs/schedule))",
  ],
};

export default config;
