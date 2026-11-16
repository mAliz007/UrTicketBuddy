import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Schema } from "mongoose";
import { DataSource } from "typeorm";
import {
  checkSynchronizeFlag,
  checkPrimaryKeys,
  checkForeignKeyIndexes,
  checkMongooseSchemaIndexes,
  runDbChecks,
} from "./check";

describe("packages/db db-check tooling", () => {
  const tempDir = path.join(os.tmpdir(), "utb-db-check-test-" + Date.now());

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("checkSynchronizeFlag", () => {
    it("should pass when no synchronize: true is found", () => {
      const cleanDir = path.join(tempDir, "clean");
      fs.mkdirSync(cleanDir, { recursive: true });
      fs.writeFileSync(
        path.join(cleanDir, "clean.ts"),
        "export const config = { synchronize: false };",
      );

      const errors = checkSynchronizeFlag(cleanDir);
      expect(errors).toHaveLength(0);
    });

    it("should detect and report synchronize: true in code files", () => {
      const dirtyDir = path.join(tempDir, "dirty");
      fs.mkdirSync(dirtyDir, { recursive: true });
      fs.writeFileSync(
        path.join(dirtyDir, "bad-config.ts"),
        "export const ormConfig = {\n  type: 'postgres',\n  synchronize: true,\n};",
      );

      const errors = checkSynchronizeFlag(dirtyDir);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Found forbidden "synchronize: true"');
      expect(errors[0]).toContain("bad-config.ts:3");
    });
  });

  describe("checkPrimaryKeys", () => {
    it("should pass when entities have primary columns", async () => {
      const mockDataSource = {
        isInitialized: false,
        entityMetadatas: [
          {
            name: "User",
            tableName: "users",
            primaryColumns: [{ databaseName: "id" }],
          },
        ],
        query: jest.fn(),
      } as unknown as DataSource;

      const errors = await checkPrimaryKeys(mockDataSource);
      expect(errors).toHaveLength(0);
    });

    it("should fail when an entity lacks a primary key", async () => {
      const mockDataSource = {
        isInitialized: false,
        entityMetadatas: [
          {
            name: "UnkeyedLog",
            tableName: "unkeyed_logs",
            primaryColumns: [],
          },
        ],
        query: jest.fn(),
      } as unknown as DataSource;

      const errors = await checkPrimaryKeys(mockDataSource);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        'Entity "UnkeyedLog" (table: "unkeyed_logs") lacks a primary key',
      );
    });

    it("should detect tables without primary keys from live DB catalog query", async () => {
      const mockDataSource = {
        isInitialized: true,
        entityMetadatas: [],
        query: jest.fn().mockResolvedValue([{ table_name: "legacy_events" }]),
      } as unknown as DataSource;

      const errors = await checkPrimaryKeys(mockDataSource);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        'Database table "legacy_events" lacks a primary key constraint.',
      );
    });
  });

  describe("checkForeignKeyIndexes", () => {
    it("should pass when foreign key columns have covering indexes", async () => {
      const mockDataSource = {
        isInitialized: false,
        entityMetadatas: [
          {
            name: "Order",
            tableName: "orders",
            primaryColumns: [{ databaseName: "id" }],
            indices: [{ columns: [{ databaseName: "user_id" }] }],
            foreignKeys: [
              {
                columns: [{ databaseName: "user_id" }],
              },
            ],
          },
        ],
        query: jest.fn(),
      } as unknown as DataSource;

      const errors = await checkForeignKeyIndexes(mockDataSource);
      expect(errors).toHaveLength(0);
    });

    it("should fail when foreign key column lacks an index in entity metadata", async () => {
      const mockDataSource = {
        isInitialized: false,
        entityMetadatas: [
          {
            name: "Order",
            tableName: "orders",
            primaryColumns: [{ databaseName: "id" }],
            indices: [],
            foreignKeys: [
              {
                columns: [{ databaseName: "user_id" }],
              },
            ],
          },
        ],
        query: jest.fn(),
      } as unknown as DataSource;

      const errors = await checkForeignKeyIndexes(mockDataSource);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        'Foreign key column "user_id" in entity "Order" (table: "orders") lacks an index',
      );
    });

    it("should detect unindexed foreign keys from live DB catalog query", async () => {
      const mockDataSource = {
        isInitialized: true,
        entityMetadatas: [],
        query: jest.fn().mockResolvedValue([
          {
            constraint_name: "fk_orders_user_id",
            table_name: "orders",
            fk_columns: ["user_id"],
          },
        ]),
      } as unknown as DataSource;

      const errors = await checkForeignKeyIndexes(mockDataSource);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        'Foreign key constraint "fk_orders_user_id" on table "orders" (columns: user_id) lacks a covering index.',
      );
    });
  });

  describe("checkMongooseSchemaIndexes", () => {
    it("should pass on a valid Mongoose schema with properly defined indexes", () => {
      const schema = new Schema({
        name: String,
        venueId: String,
      });
      schema.index({ venueId: 1 });

      const errors = checkMongooseSchemaIndexes("VenueLayout", schema);
      expect(errors).toHaveLength(0);
    });

    it("should fail when Mongoose schema index definitions are broken or malformed", () => {
      const schema = new Schema({
        title: String,
      });
      // Force a broken index definition
      schema.indexes = jest.fn().mockImplementation(() => {
        throw new Error("Invalid compound index specification on title");
      });

      const errors = checkMongooseSchemaIndexes("BrokenModel", schema);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        'Mongoose schema "BrokenModel" index definitions failed to load',
      );
      expect(errors[0]).toContain(
        "Invalid compound index specification on title",
      );
    });
  });

  describe("runDbChecks integration", () => {
    it("should complete check orchestration cleanly", async () => {
      const report = await runDbChecks({ strict: false });
      expect(report).toBeDefined();
      expect(report.synchronizeErrors).toHaveLength(0);
      expect(report.passed).toBe(true);
    });
  });
});
