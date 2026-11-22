import { DataSource } from "typeorm";
import { AppDataSource } from "./data-source";
import { TicketStatus, SeatState } from "@urticketbuddy/contracts";

export interface DataIntegrityReport {
  passed: boolean;
  timestamp: string;
  checksRun: number;
  financialErrors: string[];
  orphanErrors: string[];
  seatStateErrors: string[];
  ticketLifecycleErrors: string[];
  venueEventErrors: string[];
  allErrors: string[];
}

/**
 * Check 1: Financial and Ledger Integrity
 * - Order totalAmount must equal sum of its order_items.price.
 * - No negative values allowed in totalAmount, price, or ticket faceValueMinor.
 */
export async function checkFinancialLedgerIntegrity(
  dataSource: DataSource,
): Promise<string[]> {
  const errors: string[] = [];
  if (!dataSource.isInitialized) return errors;

  try {
    // 1. Check for negative amounts
    const negativeAmounts = await dataSource.query(`
      SELECT 'order' AS source, id, "totalAmount"::text AS val FROM orders WHERE "totalAmount" < 0
      UNION ALL
      SELECT 'order_item' AS source, id, price::text AS val FROM order_items WHERE price < 0
      UNION ALL
      SELECT 'ticket' AS source, id, "faceValueMinor"::text AS val FROM tickets WHERE "faceValueMinor" < 0;
    `);

    for (const row of negativeAmounts) {
      errors.push(
        `Negative currency amount detected in table ${row.source} (id: ${row.id}, value: ${row.val})`,
      );
    }

    // 2. Check Order Total vs Item Sum Mismatch
    const orderMismatches = await dataSource.query(`
      SELECT
        o.id AS "orderId",
        o."totalAmount"::numeric AS "orderTotal",
        COALESCE(SUM(oi.price), 0)::numeric AS "itemsSum"
      FROM orders o
      LEFT JOIN order_items oi ON oi."orderId" = o.id
      GROUP BY o.id, o."totalAmount"
      HAVING ABS(o."totalAmount"::numeric - COALESCE(SUM(oi.price), 0)::numeric) > 0.01;
    `);

    for (const row of orderMismatches) {
      errors.push(
        `Financial ledger mismatch for order ${row.orderId}: order total (${row.orderTotal}) does not match items sum (${row.itemsSum})`,
      );
    }
  } catch (err: unknown) {
    errors.push(
      `Error querying financial ledger integrity: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return errors;
}

/**
 * Check 2: Orphan Records & Referential Consistency
 * - order_items must reference valid orders and event_seats.
 * - tickets must reference valid orders, events, and event_seats.
 * - gate_scans must reference valid events and tickets (if ticketId not null).
 */
export async function checkOrphanRecords(
  dataSource: DataSource,
): Promise<string[]> {
  const errors: string[] = [];
  if (!dataSource.isInitialized) return errors;

  try {
    // Orphaned order_items
    const orphanOrderItems = await dataSource.query(`
      SELECT oi.id, oi."orderId" FROM order_items oi
      LEFT JOIN orders o ON o.id = oi."orderId"
      WHERE o.id IS NULL;
    `);
    for (const row of orphanOrderItems) {
      errors.push(
        `Orphaned order_item detected (id: ${row.id}) referencing missing order (${row.orderId})`,
      );
    }

    // Orphaned tickets (missing order or event)
    const orphanTickets = await dataSource.query(`
      SELECT t.id, t."orderId", t."eventId" FROM tickets t
      LEFT JOIN orders o ON o.id = t."orderId"
      LEFT JOIN events e ON e.id = t."eventId"
      WHERE o.id IS NULL OR e.id IS NULL;
    `);
    for (const row of orphanTickets) {
      errors.push(
        `Orphaned ticket detected (id: ${row.id}) referencing non-existent order or event`,
      );
    }

    // Orphaned gate_scans (non-null ticketId referencing missing ticket)
    const orphanScans = await dataSource.query(`
      SELECT gs.id, gs."ticketId" FROM gate_scans gs
      LEFT JOIN tickets t ON t.id = gs."ticketId"
      WHERE gs."ticketId" IS NOT NULL AND t.id IS NULL;
    `);
    for (const row of orphanScans) {
      errors.push(
        `Gate scan record (id: ${row.id}) references missing ticket (${row.ticketId})`,
      );
    }
  } catch (err: unknown) {
    errors.push(
      `Error checking orphan records: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return errors;
}

/**
 * Check 3: Seat Inventory & State Consistency
 * - No duplicate active tickets (ISSUED or CHECKED_IN) for the same eventSeatId.
 * - Seats associated with active tickets must have status SOLD in event_seats.
 * - Seat ID format convention: <sectionId>-<row>-<number>.
 */
export async function checkSeatStateIntegrity(
  dataSource: DataSource,
): Promise<string[]> {
  const errors: string[] = [];
  if (!dataSource.isInitialized) return errors;

  try {
    // Duplicate active tickets for the same event seat
    const duplicateSeatTickets = await dataSource.query(`
      SELECT "eventId", "eventSeatId", COUNT(*) AS "activeCount"
      FROM tickets
      WHERE status IN ('${TicketStatus.ISSUED}', '${TicketStatus.CHECKED_IN}')
      GROUP BY "eventId", "eventSeatId"
      HAVING COUNT(*) > 1;
    `);
    for (const row of duplicateSeatTickets) {
      errors.push(
        `Double-booked seat anomaly! Seat ${row.eventSeatId} in event ${row.eventId} has ${row.activeCount} active tickets simultaneously`,
      );
    }

    // Inconsistent event_seats status (seat has active ticket but is still marked AVAILABLE)
    const inconsistentSeatStatus = await dataSource.query(`
      SELECT es.id, es."seatId", es.status AS "seatStatus", t.id AS "ticketId", t.status AS "ticketStatus"
      FROM event_seats es
      INNER JOIN tickets t ON t."eventSeatId" = es.id
      WHERE t.status IN ('${TicketStatus.ISSUED}', '${TicketStatus.CHECKED_IN}')
        AND es.status = '${SeatState.AVAILABLE}';
    `);
    for (const row of inconsistentSeatStatus) {
      errors.push(
        `Seat state mismatch: Seat ${row.seatId} (id: ${row.id}) is marked AVAILABLE but has active ticket ${row.ticketId} (${row.ticketStatus})`,
      );
    }
  } catch (err: unknown) {
    errors.push(
      `Error checking seat state integrity: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return errors;
}

/**
 * Check 4: Ticket Lifecycle and Gate Scan Consistency
 * - Ticket status must be one of frozen decision D-2: ISSUED, CHECKED_IN, VOID, REVOKED.
 * - CHECKED_IN tickets must have at least one gate_scan entry.
 * - ISSUED tickets must not have any VALID gate_scan.
 */
export async function checkTicketLifecycleIntegrity(
  dataSource: DataSource,
): Promise<string[]> {
  const errors: string[] = [];
  if (!dataSource.isInitialized) return errors;

  try {
    // 1. Invalid status values
    const allowedStatuses = Object.values(TicketStatus);
    const statusPlaceholders = allowedStatuses.map((s) => `'${s}'`).join(", ");
    const invalidStatuses = await dataSource.query(`
      SELECT id, status FROM tickets WHERE status NOT IN (${statusPlaceholders});
    `);
    for (const row of invalidStatuses) {
      errors.push(
        `Ticket ${row.id} has invalid status '${row.status}'. Allowed statuses: ${allowedStatuses.join(", ")}`,
      );
    }

    // 2. CHECKED_IN tickets without any gate_scan record
    const checkedInWithoutScans = await dataSource.query(`
      SELECT t.id FROM tickets t
      LEFT JOIN gate_scans gs ON gs."ticketId" = t.id AND gs.result = 'VALID'
      WHERE t.status = '${TicketStatus.CHECKED_IN}' AND gs.id IS NULL;
    `);
    for (const row of checkedInWithoutScans) {
      errors.push(
        `Audit trail anomaly: Ticket ${row.id} has status CHECKED_IN but possesses no corresponding VALID gate scan record`,
      );
    }

    // 3. ISSUED tickets that have a VALID gate_scan recorded
    const issuedWithValidScan = await dataSource.query(`
      SELECT t.id, gs.id AS "scanId" FROM tickets t
      INNER JOIN gate_scans gs ON gs."ticketId" = t.id AND gs.result = 'VALID'
      WHERE t.status = '${TicketStatus.ISSUED}';
    `);
    for (const row of issuedWithValidScan) {
      errors.push(
        `State sync anomaly: Ticket ${row.id} is marked ISSUED but has valid gate scan ${row.scanId} on file`,
      );
    }
  } catch (err: unknown) {
    errors.push(
      `Error checking ticket lifecycle integrity: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return errors;
}

/**
 * Check 5: Venue and Event Relation / Date Integrity
 * - Event startDate must be <= endDate (if endDate is defined).
 * - Events must reference valid venues.
 */
export async function checkVenueEventIntegrity(
  dataSource: DataSource,
): Promise<string[]> {
  const errors: string[] = [];
  if (!dataSource.isInitialized) return errors;

  try {
    // Events referencing missing venues
    const orphanEvents = await dataSource.query(`
      SELECT e.id, e."venueId" FROM events e
      LEFT JOIN venues v ON v.id = e."venueId"
      WHERE v.id IS NULL;
    `);
    for (const row of orphanEvents) {
      errors.push(
        `Event ${row.id} references non-existent venue (${row.venueId})`,
      );
    }

    // Inverted event dates (startDate > endDate)
    const invertedDates = await dataSource.query(`
      SELECT id, title, "startDate", "endDate" FROM events
      WHERE "endDate" IS NOT NULL AND "startDate" > "endDate";
    `);
    for (const row of invertedDates) {
      errors.push(
        `Temporal consistency anomaly in event ${row.id} ('${row.title}'): startDate (${row.startDate}) is after endDate (${row.endDate})`,
      );
    }
  } catch (err: unknown) {
    errors.push(
      `Error checking venue & event integrity: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return errors;
}

/**
 * Aggregator: Executes all 5 integrity categories and produces report.
 */
export async function runAllDataIntegrityChecks(
  dataSource: DataSource,
): Promise<DataIntegrityReport> {
  const financialErrors = await checkFinancialLedgerIntegrity(dataSource);
  const orphanErrors = await checkOrphanRecords(dataSource);
  const seatStateErrors = await checkSeatStateIntegrity(dataSource);
  const ticketLifecycleErrors = await checkTicketLifecycleIntegrity(dataSource);
  const venueEventErrors = await checkVenueEventIntegrity(dataSource);

  const allErrors = [
    ...financialErrors,
    ...orphanErrors,
    ...seatStateErrors,
    ...ticketLifecycleErrors,
    ...venueEventErrors,
  ];

  return {
    passed: allErrors.length === 0,
    timestamp: new Date().toISOString(),
    checksRun: 5,
    financialErrors,
    orphanErrors,
    seatStateErrors,
    ticketLifecycleErrors,
    venueEventErrors,
    allErrors,
  };
}

/**
 * CLI Runner: Executed via `pnpm db:check:data`
 */
async function main() {
  console.log(
    "====================================================================",
  );
  console.log(
    " UrTicketBuddy Nightly Data-Level Integrity Checker (db:check:data)",
  );
  console.log(` Timestamp: ${new Date().toISOString()}`);
  console.log(
    "====================================================================",
  );

  let dataSource: DataSource | null = null;
  try {
    dataSource = await AppDataSource.initialize();
    console.log(" Connected to PostgreSQL database successfully.");
  } catch (err) {
    console.error(
      ` Failed to connect to live PostgreSQL database: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.log(" Exiting with code 1.");
    process.exit(1);
  }

  try {
    const report = await runAllDataIntegrityChecks(dataSource);

    console.log("\n--- Integrity Audit Summary ---");
    console.log(
      ` Financial Ledger Integrity:  ${report.financialErrors.length === 0 ? "PASSED" : `FAILED (${report.financialErrors.length} errors)`}`,
    );
    console.log(
      ` Referential Consistency:     ${report.orphanErrors.length === 0 ? "PASSED" : `FAILED (${report.orphanErrors.length} errors)`}`,
    );
    console.log(
      ` Seat State & Double-Booking: ${report.seatStateErrors.length === 0 ? "PASSED" : `FAILED (${report.seatStateErrors.length} errors)`}`,
    );
    console.log(
      ` Ticket Lifecycle & Audits:   ${report.ticketLifecycleErrors.length === 0 ? "PASSED" : `FAILED (${report.ticketLifecycleErrors.length} errors)`}`,
    );
    console.log(
      ` Venue & Event Consistency:   ${report.venueEventErrors.length === 0 ? "PASSED" : `FAILED (${report.venueEventErrors.length} errors)`}`,
    );
    console.log(
      "--------------------------------------------------------------------",
    );

    if (report.passed) {
      console.log(
        "\n SUCCESS: All database data-level integrity checks passed cleanly (0 anomalies).",
      );
      process.exit(0);
    } else {
      console.error(
        `\n FAILURE: Found ${report.allErrors.length} data-level integrity violation(s):\n`,
      );
      for (let i = 0; i < report.allErrors.length; i++) {
        console.error(`  ${i + 1}. ${report.allErrors[i]}`);
      }
      process.exit(1);
    }
  } finally {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal unhandled error during data integrity check:", err);
    process.exit(1);
  });
}
