import { DataSource } from "typeorm";
import {
  checkFinancialLedgerIntegrity,
  checkOrphanRecords,
  checkSeatStateIntegrity,
  checkTicketLifecycleIntegrity,
  checkVenueEventIntegrity,
  runAllDataIntegrityChecks,
} from "./data-check";

describe("Nightly Data-Level Integrity Checker (db:check:data) [UTB-19]", () => {
  let mockDataSource: Partial<DataSource>;

  beforeEach(() => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockImplementation((queryStr: string) => {
        if (
          typeof queryStr === "string" &&
          queryStr.includes("information_schema.tables")
        ) {
          return Promise.resolve([{ exists: true }]);
        }
        return Promise.resolve([]);
      }),
    };
  });

  describe("checkFinancialLedgerIntegrity", () => {
    it("should pass when there are no negative values or order sum mismatches", async () => {
      const errors = await checkFinancialLedgerIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(0);
    });

    it("should catch negative currency amounts", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (queryStr.includes('WHERE "totalAmount" < 0')) {
            return Promise.resolve([
              { source: "order", id: "order-1", val: "-50.00" },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const errors = await checkFinancialLedgerIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Negative currency amount detected");
      expect(errors[0]).toContain("order-1");
    });

    it("should catch order total vs items sum mismatch", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (queryStr.includes("HAVING ABS")) {
            return Promise.resolve([
              { orderId: "order-123", orderTotal: "100.00", itemsSum: "80.00" },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const errors = await checkFinancialLedgerIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        "Financial ledger mismatch for order order-123",
      );
    });
  });

  describe("checkOrphanRecords", () => {
    it("should pass when no orphan records exist", async () => {
      const errors = await checkOrphanRecords(mockDataSource as DataSource);
      expect(errors).toHaveLength(0);
    });

    it("should catch orphaned order_items, tickets, and gate_scans", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (queryStr.includes("FROM order_items oi")) {
            return Promise.resolve([
              { id: "item-1", orderId: "missing-order-1" },
            ]);
          }
          if (queryStr.includes("FROM tickets t")) {
            return Promise.resolve([
              {
                id: "ticket-1",
                orderId: "missing-order-2",
                eventId: "missing-event",
              },
            ]);
          }
          if (queryStr.includes("FROM gate_scans gs")) {
            return Promise.resolve([
              { id: "scan-1", ticketId: "missing-ticket" },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const errors = await checkOrphanRecords(mockDataSource as DataSource);
      expect(errors).toHaveLength(3);
      expect(errors[0]).toContain("Orphaned order_item detected");
      expect(errors[1]).toContain("Orphaned ticket detected");
      expect(errors[2]).toContain("Gate scan record");
    });
  });

  describe("checkSeatStateIntegrity", () => {
    it("should pass when seat inventory is completely consistent", async () => {
      const errors = await checkSeatStateIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(0);
    });

    it("should detect double-booked seat anomaly (multiple active tickets for same seat)", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (queryStr.includes("HAVING COUNT(*) > 1")) {
            return Promise.resolve([
              { eventId: "evt-1", eventSeatId: "seat-1", activeCount: "2" },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const errors = await checkSeatStateIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Double-booked seat anomaly");
      expect(errors[0]).toContain("2 active tickets simultaneously");
    });

    it("should detect seat marked AVAILABLE despite having active ticket", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (queryStr.includes("AND es.status = 'AVAILABLE'")) {
            return Promise.resolve([
              {
                id: "es-1",
                seatId: "SEC1-A-1",
                seatStatus: "AVAILABLE",
                ticketId: "t-1",
                ticketStatus: "ISSUED",
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const errors = await checkSeatStateIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Seat state mismatch: Seat SEC1-A-1");
      expect(errors[0]).toContain("marked AVAILABLE but has active ticket");
    });
  });

  describe("checkTicketLifecycleIntegrity", () => {
    it("should pass when ticket lifecycle and scan audit trail match", async () => {
      const errors = await checkTicketLifecycleIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(0);
    });

    it("should detect invalid ticket status", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (queryStr.includes("status NOT IN")) {
            return Promise.resolve([{ id: "t-1", status: "INVALID_STATUS" }]);
          }
          return Promise.resolve([]);
        },
      );

      const errors = await checkTicketLifecycleIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("invalid status 'INVALID_STATUS'");
    });

    it("should detect CHECKED_IN ticket without valid scan record", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (
            queryStr.includes("WHERE t.status = 'CHECKED_IN' AND gs.id IS NULL")
          ) {
            return Promise.resolve([{ id: "t-checked-in" }]);
          }
          return Promise.resolve([]);
        },
      );

      const errors = await checkTicketLifecycleIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        "Audit trail anomaly: Ticket t-checked-in has status CHECKED_IN",
      );
    });

    it("should detect ISSUED ticket with valid scan recorded", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (queryStr.includes("WHERE t.status = 'ISSUED'")) {
            return Promise.resolve([{ id: "t-issued", scanId: "scan-99" }]);
          }
          return Promise.resolve([]);
        },
      );

      const errors = await checkTicketLifecycleIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        "State sync anomaly: Ticket t-issued is marked ISSUED",
      );
    });
  });

  describe("checkVenueEventIntegrity", () => {
    it("should pass when events and venues are valid and dates are chronological", async () => {
      const errors = await checkVenueEventIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(0);
    });

    it("should detect events with missing startTime", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (queryStr.includes('"startTime" IS NULL')) {
            return Promise.resolve([
              {
                id: "evt-bad",
                name: "Corrupt Event",
              },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const errors = await checkVenueEventIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        "Temporal consistency anomaly in event evt-bad",
      );
    });
  });

  describe("runAllDataIntegrityChecks", () => {
    it("should aggregate all categories and return passed=true when 0 errors", async () => {
      const report = await runAllDataIntegrityChecks(
        mockDataSource as DataSource,
      );
      expect(report.passed).toBe(true);
      expect(report.checksRun).toBe(5);
      expect(report.allErrors).toHaveLength(0);
    });

    it("should aggregate all categories and return passed=false with errors list when anomalies exist", async () => {
      (mockDataSource.query as jest.Mock).mockImplementation(
        (queryStr: string) => {
          if (queryStr.includes("information_schema.tables")) {
            return Promise.resolve([{ exists: true }]);
          }
          if (queryStr.includes('WHERE "totalAmount" < 0')) {
            return Promise.resolve([
              { source: "order", id: "o-1", val: "-10" },
            ]);
          }
          return Promise.resolve([]);
        },
      );

      const report = await runAllDataIntegrityChecks(
        mockDataSource as DataSource,
      );
      expect(report.passed).toBe(false);
      expect(report.allErrors.length).toBeGreaterThan(0);
      expect(report.financialErrors.length).toBe(1);
    });
  });
});
