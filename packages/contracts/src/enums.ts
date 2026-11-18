export enum TicketStatus {
  ISSUED = "ISSUED",
  CHECKED_IN = "CHECKED_IN",
  VOID = "VOID",
  REVOKED = "REVOKED",
}

export enum SeatState {
  AVAILABLE = "AVAILABLE",
  HELD = "HELD",
  SOLD = "SOLD",
  DISABLED = "DISABLED",
}

export const SeatStateColors = {
  [SeatState.AVAILABLE]: "green",
  [SeatState.HELD]: "yellow",
  [SeatState.SOLD]: "red",
  [SeatState.DISABLED]: "grey",
} as const;

export enum UserRole {
  ADMIN = "ADMIN",
  ORGANIZER = "ORGANIZER",
  CUSTOMER = "CUSTOMER",
  ATTENDEE = "CUSTOMER",
}
