/**
 * Converts a 0-indexed row number into a spreadsheet-style label.
 * 0 -> 'A', 25 -> 'Z', 26 -> 'AA', etc.
 */
export function rowToLabel(rowIndex: number): string {
  if (rowIndex < 0) {
    throw new Error(`Row index cannot be negative: ${rowIndex}`);
  }
  let label = "";
  let current = rowIndex;
  while (current >= 0) {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  }
  return label;
}

/**
 * Builds a deterministic seat ID adhering to format: <sectionId>-<row>-<number>
 */
export function buildSeatId(
  sectionId: string,
  row: string | number,
  number: string | number,
): string {
  const rowStr = typeof row === "number" ? rowToLabel(row) : row;
  const numStr = String(number);
  return `${sectionId}-${rowStr}-${numStr}`;
}

/**
 * Parses a deterministic seat ID back into components
 */
export function parseSeatId(seatId: string): {
  sectionId: string;
  row: string;
  number: string;
} {
  const parts = seatId.split("-");
  if (parts.length < 3) {
    throw new Error(
      `Invalid seat ID format: "${seatId}". Expected <sectionId>-<row>-<number>`,
    );
  }
  const number = parts[parts.length - 1];
  const row = parts[parts.length - 2];
  const sectionId = parts.slice(0, parts.length - 2).join("-");
  return { sectionId, row, number };
}
