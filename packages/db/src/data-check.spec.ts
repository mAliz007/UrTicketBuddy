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
      query: jest.fn().mockResolvedValue([]),
    };
  });

  describe("checkFinancialLedgerIntegrity", () => {
    it("should pass when there are no negative values or order sum mismatches", async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue([]);

      const errors = await checkFinancialLedgerIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(0);
    });

    it("should catch negative currency amounts", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { source: "order", id: "order-1", val: "-50.00" },
        ])
        .mockResolvedValueOnce([]);

      const errors = await checkFinancialLedgerIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Negative currency amount detected");
      expect(errors[0]).toContain("order-1");
    });

    it("should catch order total vs items sum mismatch", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { orderId: "order-123", orderTotal: "100.00", itemsSum: "80.00" },
        ]);

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
      (mockDataSource.query as jest.Mock).mockResolvedValue([]);

      const errors = await checkOrphanRecords(mockDataSource as DataSource);
      expect(errors).toHaveLength(0);
    });

    it("should catch orphaned order_items, tickets, and gate_scans", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ id: "item-1", orderId: "missing-order-1" }])
        .mockResolvedValueOnce([
          {
            id: "ticket-1",
            orderId: "missing-order-2",
            eventId: "missing-event",
          },
        ])
        .mockResolvedValueOnce([{ id: "scan-1", ticketId: "missing-ticket" }]);

      const errors = await checkOrphanRecords(mockDataSource as DataSource);
      expect(errors).toHaveLength(3);
      expect(errors[0]).toContain("Orphaned order_item detected");
      expect(errors[1]).toContain("Orphaned ticket detected");
      expect(errors[2]).toContain("Gate scan record");
    });
  });

  describe("checkSeatStateIntegrity", () => {
    it("should pass when seat inventory is completely consistent", async () => {
      (mockDataSource.query as jest.Mock).mockResolvedValue([]);

      const errors = await checkSeatStateIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(0);
    });

    it("should detect double-booked seat anomaly (multiple active tickets for same seat)", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { eventId: "evt-1", eventSeatId: "seat-1", activeCount: "2" },
        ])
        .mockResolvedValueOnce([]);

      const errors = await checkSeatStateIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Double-booked seat anomaly");
      expect(errors[0]).toContain("2 active tickets simultaneously");
    });

    it("should detect seat marked AVAILABLE despite having active ticket", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "es-1",
            seatId: "SEC1-A-1",
            seatStatus: "AVAILABLE",
            ticketId: "t-1",
            ticketStatus: "ISSUED",
          },
        ]);

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
      (mockDataSource.query as jest.Mock).mockResolvedValue([]);

      const errors = await checkTicketLifecycleIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(0);
    });

    it("should detect invalid ticket status", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ id: "t-1", status: "INVALID_STATUS" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const errors = await checkTicketLifecycleIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("invalid status 'INVALID_STATUS'");
    });

    it("should detect CHECKED_IN ticket without valid scan record", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "t-checked-in" }])
        .mockResolvedValueOnce([]);

      const errors = await checkTicketLifecycleIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(
        "Audit trail anomaly: Ticket t-checked-in has status CHECKED_IN",
      );
    });

    it("should detect ISSUED ticket with valid scan recorded", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "t-issued", scanId: "scan-99" }]);

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
      (mockDataSource.query as jest.Mock).mockResolvedValue([]);

      const errors = await checkVenueEventIntegrity(
        mockDataSource as DataSource,
      );
      expect(errors).toHaveLength(0);
    });

    it("should detect events with inverted start and end dates", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "evt-bad",
            title: "Corrupt Event",
            startDate: "2026-12-01",
            endDate: "2026-11-01",
          },
        ]);

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
      (mockDataSource.query as jest.Mock).mockResolvedValue([]);

      const report = await runAllDataIntegrityChecks(
        mockDataSource as DataSource,
      );
      expect(report.passed).toBe(true);
      expect(report.checksRun).toBe(5);
      expect(report.allErrors).toHaveLength(0);
    });

    it("should aggregate all categories and return passed=false with errors list when anomalies exist", async () => {
      (mockDataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ source: "order", id: "o-1", val: "-10" }])
        .mockResolvedValue([]);

      const report = await runAllDataIntegrityChecks(
        mockDataSource as DataSource,
      );
      expect(report.passed).toBe(false);
      expect(report.allErrors.length).toBeGreaterThan(0);
      expect(report.financialErrors.length).toBe(1);
    });
  });
});
