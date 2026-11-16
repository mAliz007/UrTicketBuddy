import {
  TicketStatus,
  SeatState,
  SeatStateColors,
  ErrorCode,
  PaginationQuerySchema,
  SeatStateEventSchema,
  HoldRequestSchema,
  HoldResponseSchema,
} from "./index";

describe("packages/contracts", () => {
  it("should define TicketStatus correctly according to D-2", () => {
    expect(TicketStatus.ISSUED).toBe("ISSUED");
    expect(TicketStatus.CHECKED_IN).toBe("CHECKED_IN");
    expect(TicketStatus.VOID).toBe("VOID");
    expect(TicketStatus.REVOKED).toBe("REVOKED");
  });

  it("should export ErrorCode enum including seat locking error codes", () => {
    expect(ErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(ErrorCode.SEAT_ALREADY_HELD).toBe("SEAT_ALREADY_HELD");
    expect(ErrorCode.SEAT_NOT_HELD_BY_YOU).toBe("SEAT_NOT_HELD_BY_YOU");
    expect(ErrorCode.HOLD_EXPIRED).toBe("HOLD_EXPIRED");
    expect(ErrorCode.TOO_MANY_SEATS).toBe("TOO_MANY_SEATS");
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

  it("should validate seat state event with optional expiresAt", () => {
    const payload = {
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      seatId: "A-1-12",
      state: SeatState.HELD,
      expiresAt: 1700000600000,
    };
    const parsed = SeatStateEventSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("should validate HoldRequest and HoldResponse schemas and reject unknown fields", () => {
    const validRequest = HoldRequestSchema.safeParse({
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      seatIds: ["A-1-1", "A-1-2"],
      ttlSeconds: 600,
      maxPerUser: 6,
    });
    expect(validRequest.success).toBe(true);

    const invalidRequest = HoldRequestSchema.safeParse({
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      seatIds: ["A-1-1"],
      unknownField: true,
    });
    expect(invalidRequest.success).toBe(false);

    const validResponse = HoldResponseSchema.safeParse({
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      seatIds: ["A-1-1", "A-1-2"],
      expiresAt: 1700000600000,
    });
    expect(validResponse.success).toBe(true);
  });
});
