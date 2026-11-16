import { QueryRunner } from "typeorm";
import { AppDataSource } from "./index";
import { Utb2InitExtensions1794836828550 } from "./migrations/1794836828550-UTB-2-init-extensions";

describe("packages/db", () => {
  it("should define AppDataSource with correct options", () => {
    expect(AppDataSource).toBeDefined();
    expect(AppDataSource.options.type).toBe("postgres");
    expect(AppDataSource.options.synchronize).toBe(false);
    expect(AppDataSource.options.migrationsTableName).toBe("migrations");
  });

  it("should never have synchronize set to true", () => {
    expect(AppDataSource.options.synchronize).not.toBe(true);
  });

  it("should have baseline migration Utb2InitExtensions with up and down queries", async () => {
    const migration = new Utb2InitExtensions1794836828550();
    expect(migration.name).toBe("Utb2InitExtensions1794836828550");

    const queriesRan: string[] = [];
    const mockQueryRunner = {
      query: jest.fn().mockImplementation(async (query: string) => {
        queriesRan.push(query);
      }),
    };

    await migration.up(mockQueryRunner as unknown as QueryRunner);
    expect(queriesRan).toContain(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    expect(queriesRan).toContain(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    queriesRan.length = 0;
    await migration.down(mockQueryRunner as unknown as QueryRunner);
    expect(queriesRan).toContain(`DROP EXTENSION IF EXISTS "uuid-ossp";`);
    expect(queriesRan).toContain(`DROP EXTENSION IF EXISTS "pgcrypto";`);
  });
});
