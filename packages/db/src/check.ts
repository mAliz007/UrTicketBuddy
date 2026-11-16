import * as fs from "fs";
import * as path from "path";
import { DataSource } from "typeorm";
import { Schema } from "mongoose";
import { AppDataSource } from "./data-source";

export interface DbCheckReport {
  passed: boolean;
  synchronizeErrors: string[];
  primaryKeyErrors: string[];
  foreignKeyErrors: string[];
  mongooseIndexErrors: string[];
  allErrors: string[];
}

/**
 * Check 1: Ensure "synchronize: true" is never present anywhere in the codebase.
 */
export function checkSynchronizeFlag(rootDir: string): string[] {
  const errors: string[] = [];

  // Check AppDataSource runtime options
  if (AppDataSource.options.synchronize === true) {
    errors.push(
      "AppDataSource options explicitly have synchronize: true. Synchronize must NEVER be enabled.",
    );
  }

  const ignoreDirs = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    ".turbo",
    ".engram",
    ".pnpm-store",
    "coverage",
  ]);

  const targetExtensions = new Set([".ts", ".js", ".json", ".yaml", ".yml"]);

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          scanDir(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (targetExtensions.has(ext)) {
          const normalized = fullPath.replace(/\\/g, "/");
          // Skip check scripts and test specs with negative assertion fixtures
          if (
            normalized.endsWith(".spec.ts") ||
            normalized.endsWith(".test.ts") ||
            normalized.endsWith(".spec.js") ||
            normalized.endsWith(".test.js") ||
            normalized.includes("scripts/db-check.ts") ||
            normalized.includes("packages/db/src/check.ts")
          ) {
            continue;
          }

          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            const syncRegex = /synchronize\s*:\s*true\b/g;
            let match: RegExpExecArray | null;
            while ((match = syncRegex.exec(content)) !== null) {
              const linesUpToMatch = content
                .slice(0, match.index)
                .split("\n").length;
              errors.push(
                `Found forbidden "synchronize: true" in ${path.relative(rootDir, fullPath)}:${linesUpToMatch}`,
              );
            }
          } catch {
            // Ignore unreadable files
          }
        }
      }
    }
  }

  scanDir(rootDir);
  return errors;
}

/**
 * Check 2: Fail if any table lacks a primary key.
 */
export async function checkPrimaryKeys(
  dataSource: DataSource,
): Promise<string[]> {
  const errors: string[] = [];

  // 1. Check entity metadatas
  if (dataSource.entityMetadatas && dataSource.entityMetadatas.length > 0) {
    for (const entity of dataSource.entityMetadatas) {
      if (!entity.primaryColumns || entity.primaryColumns.length === 0) {
        errors.push(
          `Entity "${entity.name}" (table: "${entity.tableName}") lacks a primary key.`,
        );
      }
    }
  }

  // 2. Check live PostgreSQL database catalog if connected
  if (dataSource.isInitialized) {
    const missingPkQuery = `
      SELECT t.table_name
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT IN (
          SELECT c.table_name
          FROM information_schema.table_constraints c
          WHERE c.constraint_type = 'PRIMARY KEY'
            AND c.table_schema = 'public'
        );
    `;

    try {
      const rows: Array<{ table_name: string }> =
        await dataSource.query(missingPkQuery);
      for (const row of rows) {
        if (row.table_name === "typeorm_metadata") continue;
        errors.push(
          `Database table "${row.table_name}" lacks a primary key constraint.`,
        );
      }
    } catch (err: unknown) {
      errors.push(
        `Failed to query primary key constraints from database: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return errors;
}

/**
 * Check 3: Fail if any foreign key column lacks an index.
 */
export async function checkForeignKeyIndexes(
  dataSource: DataSource,
): Promise<string[]> {
  const errors: string[] = [];

  // 1. Check entity metadatas
  if (dataSource.entityMetadatas && dataSource.entityMetadatas.length > 0) {
    for (const entity of dataSource.entityMetadatas) {
      const indexedColumnNames = new Set<string>();
      for (const index of entity.indices) {
        for (const col of index.columns) {
          indexedColumnNames.add(col.databaseName);
        }
      }
      for (const col of entity.primaryColumns) {
        indexedColumnNames.add(col.databaseName);
      }

      for (const foreignKey of entity.foreignKeys) {
        for (const column of foreignKey.columns) {
          if (!indexedColumnNames.has(column.databaseName)) {
            errors.push(
              `Foreign key column "${column.databaseName}" in entity "${entity.name}" (table: "${entity.tableName}") lacks an index.`,
            );
          }
        }
      }
    }
  }

  // 2. Check live PostgreSQL database catalog if connected
  if (dataSource.isInitialized) {
    const unindexedFkQuery = `
      WITH fk_actions AS (
        SELECT
          c.conname AS constraint_name,
          c.conrelid::regclass::text AS table_name,
          ARRAY_AGG(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS fk_columns,
          c.conkey AS fk_attnums,
          c.conrelid AS table_oid
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f'
          AND c.connamespace = 'public'::regnamespace
        GROUP BY c.conname, c.conrelid, c.conkey
      ),
      unindexed_fks AS (
        SELECT
          f.constraint_name,
          f.table_name,
          f.fk_columns
        FROM fk_actions f
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_index i
          WHERE i.indrelid = f.table_oid
            AND i.indisvalid
            AND (i.indkey::int2[])[0:cardinality(f.fk_attnums)-1] = f.fk_attnums
        )
      )
      SELECT constraint_name, table_name, fk_columns
      FROM unindexed_fks;
    `;

    try {
      const rows: Array<{
        constraint_name: string;
        table_name: string;
        fk_columns: string[];
      }> = await dataSource.query(unindexedFkQuery);

      for (const row of rows) {
        errors.push(
          `Foreign key constraint "${row.constraint_name}" on table "${row.table_name}" (columns: ${row.fk_columns.join(", ")}) lacks a covering index.`,
        );
      }
    } catch (err: unknown) {
      errors.push(
        `Failed to query foreign key indexes from database: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return errors;
}

/**
 * Check 4: Fail if Mongoose index definitions fail to load.
 */
export function checkMongooseSchemaIndexes(
  name: string,
  schema: Schema,
): string[] {
  const errors: string[] = [];
  try {
    const indexes = schema.indexes();
    if (!Array.isArray(indexes)) {
      errors.push(
        `Mongoose schema "${name}" indexes() returned non-array result.`,
      );
      return errors;
    }

    for (const item of indexes) {
      const itemTuple = item as unknown as unknown[];
      if (!item || !Array.isArray(itemTuple) || itemTuple.length < 1) {
        errors.push(
          `Mongoose schema "${name}" contains malformed index tuple.`,
        );
        continue;
      }
      const [fields, options] = item;
      if (
        !fields ||
        typeof fields !== "object" ||
        Object.keys(fields).length === 0
      ) {
        errors.push(
          `Mongoose schema "${name}" contains empty or invalid index field specification.`,
        );
      }
      if (options && typeof options !== "object") {
        errors.push(
          `Mongoose schema "${name}" contains invalid index options specification.`,
        );
      }
    }
  } catch (err: unknown) {
    errors.push(
      `Mongoose schema "${name}" index definitions failed to load: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return errors;
}

export function scanAndCheckMongooseIndexes(rootDir: string): string[] {
  const errors: string[] = [];
  const ignoreDirs = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    ".turbo",
    ".engram",
  ]);

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          scanDir(fullPath);
        }
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".schema.ts") || entry.name.endsWith(".model.ts"))
      ) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mod = require(fullPath);
          for (const [key, value] of Object.entries(mod)) {
            if (value instanceof Schema) {
              const schemaErrors = checkMongooseSchemaIndexes(key, value);
              errors.push(...schemaErrors);
            }
          }
        } catch (err: unknown) {
          errors.push(
            `Failed to load Mongoose schema file "${path.relative(rootDir, fullPath)}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  scanDir(path.join(rootDir, "packages"));
  scanDir(path.join(rootDir, "apps"));
  return errors;
}

/**
 * Main db:check orchestrator
 */
export async function runDbChecks(options?: {
  rootDir?: string;
  strict?: boolean;
}): Promise<DbCheckReport> {
  const rootDir = options?.rootDir || path.resolve(__dirname, "../../..");
  const strict =
    options?.strict ??
    (process.env.CI === "true" || process.env.STRICT_DB_CHECK === "true");

  console.log("=== Running UrTicketBuddy Database Consistency Checks ===");
  console.log(`Root directory: ${rootDir}`);
  console.log(`Strict mode: ${strict ? "ENABLED" : "DISABLED"}`);

  // 1. Check synchronize: true
  console.log("\n[1/4] Checking for forbidden 'synchronize: true'...");
  const synchronizeErrors = checkSynchronizeFlag(rootDir);
  if (synchronizeErrors.length === 0) {
    console.log("  ✓ No 'synchronize: true' occurrences found.");
  } else {
    for (const err of synchronizeErrors) {
      console.error(`  ✗ ${err}`);
    }
  }

  // 2. Initialize DB connection if possible for primary key and foreign key checks
  let dbConnected = false;
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    dbConnected = true;
    console.log("  ✓ Connected to PostgreSQL database.");
  } catch (err: unknown) {
    const msg = `Could not connect to PostgreSQL: ${err instanceof Error ? err.message : String(err)}`;
    if (strict) {
      console.error(`  ✗ [STRICT] ${msg}`);
    } else {
      console.warn(`  ! [WARN] ${msg} (proceeding with static checks)`);
    }
  }

  // 3. Check Primary Keys
  console.log("\n[2/4] Checking primary keys on all tables/entities...");
  const primaryKeyErrors = await checkPrimaryKeys(AppDataSource);
  if (primaryKeyErrors.length === 0) {
    console.log("  ✓ All checked tables/entities have valid primary keys.");
  } else {
    for (const err of primaryKeyErrors) {
      console.error(`  ✗ ${err}`);
    }
  }

  // 4. Check Foreign Key Indexes
  console.log(
    "\n[3/4] Checking covering indexes on all foreign key columns...",
  );
  const foreignKeyErrors = await checkForeignKeyIndexes(AppDataSource);
  if (foreignKeyErrors.length === 0) {
    console.log("  ✓ All foreign key columns have covering indexes.");
  } else {
    for (const err of foreignKeyErrors) {
      console.error(`  ✗ ${err}`);
    }
  }

  // 5. Check Mongoose Index Definitions
  console.log("\n[4/4] Checking Mongoose index definitions...");
  const mongooseIndexErrors = scanAndCheckMongooseIndexes(rootDir);
  if (mongooseIndexErrors.length === 0) {
    console.log("  ✓ All Mongoose index definitions loaded cleanly.");
  } else {
    for (const err of mongooseIndexErrors) {
      console.error(`  ✗ ${err}`);
    }
  }

  if (dbConnected && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  const allErrors: string[] = [
    ...synchronizeErrors,
    ...primaryKeyErrors,
    ...foreignKeyErrors,
    ...mongooseIndexErrors,
  ];

  if (!dbConnected && strict) {
    allErrors.push(
      "Database connection is required in strict/CI mode for catalog checks.",
    );
  }

  const passed = allErrors.length === 0;

  console.log("\n=======================================================");
  if (passed) {
    console.log("✓ ALL DATABASE CONSISTENCY CHECKS PASSED!");
  } else {
    console.error(
      `✗ DATABASE CHECKS FAILED WITH ${allErrors.length} ERROR(S):`,
    );
    for (const err of allErrors) {
      console.error(`  - ${err}`);
    }
  }
  console.log("=======================================================\n");

  return {
    passed,
    synchronizeErrors,
    primaryKeyErrors,
    foreignKeyErrors,
    mongooseIndexErrors,
    allErrors,
  };
}

if (require.main === module) {
  runDbChecks().then((report) => {
    if (!report.passed) {
      process.exit(1);
    }
    process.exit(0);
  });
}
