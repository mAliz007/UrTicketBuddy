import { runDbChecks } from "../packages/db/src/check";

if (require.main === module) {
  runDbChecks().then((report) => {
    if (!report.passed) {
      process.exit(1);
    }
    process.exit(0);
  });
}

export * from "../packages/db/src/check";
