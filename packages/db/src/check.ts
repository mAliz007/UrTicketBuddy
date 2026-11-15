import { AppDataSource } from "./data-source";

async function checkDatabase() {
  console.log("Checking database connection and migrations...");
  try {
    await AppDataSource.initialize();
    console.log("Database connection initialized successfully.");
    const hasPending = await AppDataSource.showMigrations();
    console.log("Migrations check complete. Pending:", hasPending);
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error(
      "Database check error (offline or connection failed):",
      error,
    );
    // Don't fail the build script if DB is not running during CI/build step
    process.exit(0);
  }
}

if (require.main === module) {
  checkDatabase();
}
