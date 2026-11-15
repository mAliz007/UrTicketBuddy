import {
  TicketStatus,
  SeatState,
  SeatStateColors,
  ErrorCode,
  PaginationQuerySchema,
  SeatStateEventSchema,
} from "./index";

describe("packages/contracts", () => {
  it("should define TicketStatus correctly according to D-2", () => {
    expect(TicketStatus.ISSUED).toBe("ISSUED");
    expect(TicketStatus.CHECKED_IN).toBe("CHECKED_IN");
    expect(TicketStatus.VOID).toBe("VOID");
    expect(TicketStatus.REVOKED).toBe("REVOKED");
  });

  it("should map seat state colors as defined in AGENTS.md section 7", () => {
    expect(SeatStateColors[SeatState.AVAILABLE]).toBe("green");
    expect(SeatStateColors[SeatState.HELD]).toBe("yellow");
    expect(SeatStateColors[SeatState.SOLD]).toBe("red");
    expect(SeatStateColors[SeatState.DISABLED]).toBe("grey");
  });

  it("should validate pagination defaults", () => {
    const res = PaginationQuerySchema.parse({});
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(20);
  });

  it("should validate seat state event", () => {
    const payload = {
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      seatId: "A-1-12",
      state: SeatState.AVAILABLE,
    };
    const parsed = SeatStateEventSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });
});
