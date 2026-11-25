import {
  TicketStatus,
  SeatState,
  SeatStateColors,
  ErrorCode,
  PaginationQuerySchema,
  SeatStateEventSchema,
  HoldRequestSchema,
  HoldResponseSchema,
  SeatNodeSchema,
  VenueLayoutSchema,
  degToRad,
  radToDeg,
  maxResalePrice,
  ResaleListingStatus,
  LedgerEntryKind,
  CreateResaleListingSchema,
  UpdateResaleListingSchema,
  PurchaseResaleListingSchema,
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

  it("should validate VenueLayoutSchema and SeatNodeSchema", () => {
    const seat = {
      id: "SEC1-A-1",
      x: 100,
      y: 200,
      rotation: 45,
      sectionId: "SEC1",
      row: "A",
      number: "1",
      tierId: "VIP",
      state: "DISABLED" as const,
    };
    const validSeat = SeatNodeSchema.safeParse(seat);
    expect(validSeat.success).toBe(true);

    const layout = {
      schemaVersion: 1,
      name: "Grand Arena",
      dimensions: { width: 1000, height: 800 },
      sections: [
        {
          type: "grid" as const,
          id: "SEC1",
          origin: { x: 50, y: 50 },
          rows: 5,
          columns: 10,
          seatWidth: 20,
          gapX: 5,
          gapY: 5,
        },
      ],
      seats: [seat],
    };
    const validLayout = VenueLayoutSchema.safeParse(layout);
    expect(validLayout.success).toBe(true);
  });

  it("should properly convert degrees and radians", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
    expect(radToDeg(Math.PI)).toBeCloseTo(180);
  });

  it("should enforce maxResalePrice 110% ceiling across boundary, zero, and large values", () => {
    // Exact 110% boundary
    expect(maxResalePrice(1000)).toBe(1100);
    expect(maxResalePrice(10000)).toBe(11000);
    expect(maxResalePrice(105)).toBe(115); // Math.floor(115.5)
    expect(maxResalePrice(1)).toBe(1); // floor(1.1)
    expect(maxResalePrice(10)).toBe(11); // 10 * 110 / 100 = 11

    // 1 minor unit above boundary fails cap check
    const cap1000 = maxResalePrice(1000);
    expect(1100 <= cap1000).toBe(true);
    expect(1101 <= cap1000).toBe(false);

    const cap10000 = maxResalePrice(10000);
    expect(11000 <= cap10000).toBe(true);
    expect(11001 <= cap10000).toBe(false);

    // Zero
    expect(maxResalePrice(0)).toBe(0);
    expect(0 <= maxResalePrice(0)).toBe(true);
    expect(1 <= maxResalePrice(0)).toBe(false);

    // Large values and 32-bit limits
    expect(maxResalePrice(10_000_000)).toBe(11_000_000);
    expect(maxResalePrice(999_999_999)).toBe(1_099_999_998);
    expect(maxResalePrice(2_147_483_647)).toBe(2_362_232_011);

    // Negative / NaN / Non-finite rejection
    expect(() => maxResalePrice(-1)).toThrow(RangeError);
    expect(() => maxResalePrice(-100)).toThrow(RangeError);
    expect(() => maxResalePrice(Number.NaN)).toThrow(RangeError);
    expect(() => maxResalePrice(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("should validate resale enums and schemas", () => {
    expect(ResaleListingStatus.ACTIVE).toBe("ACTIVE");
    expect(ResaleListingStatus.SOLD).toBe("SOLD");
    expect(ResaleListingStatus.WITHDRAWN).toBe("WITHDRAWN");
    expect(LedgerEntryKind.SELLER_PAYOUT).toBe("SELLER_PAYOUT");
    expect(LedgerEntryKind.PLATFORM_COMMISSION).toBe("PLATFORM_COMMISSION");

    expect(
      CreateResaleListingSchema.safeParse({
        ticketId: "123e4567-e89b-12d3-a456-426614174000",
        askingPriceMinor: 5500,
      }).success,
    ).toBe(true);

    // Rejects 0, negative, float, and > PG_MAX_INT32
    expect(
      CreateResaleListingSchema.safeParse({
        ticketId: "123e4567-e89b-12d3-a456-426614174000",
        askingPriceMinor: 0,
      }).success,
    ).toBe(false);
    expect(
      CreateResaleListingSchema.safeParse({
        ticketId: "123e4567-e89b-12d3-a456-426614174000",
        askingPriceMinor: 100.5,
      }).success,
    ).toBe(false);
    expect(
      CreateResaleListingSchema.safeParse({
        ticketId: "123e4567-e89b-12d3-a456-426614174000",
        askingPriceMinor: 3_000_000_000,
      }).success,
    ).toBe(false);

    expect(
      UpdateResaleListingSchema.safeParse({
        status: ResaleListingStatus.WITHDRAWN,
      }).success,
    ).toBe(true);

    expect(UpdateResaleListingSchema.safeParse({}).success).toBe(false);

    expect(PurchaseResaleListingSchema.parse({}).paymentMethodToken).toBe(
      "tok_visa",
    );
  });
});
