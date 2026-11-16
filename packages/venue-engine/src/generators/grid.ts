import { SeatNode, Point } from "@urticketbuddy/contracts";
import { buildSeatId, rowToLabel } from "../utils/ids";

export interface GenerateGridParams {
  origin: Point;
  rows: number;
  columns: number;
  seatWidth: number;
  gapX: number;
  gapY: number;
  staggerOffset?: number;
  aisleColumns?: number[];
  aisleWidth?: number;
  sectionId: string;
  rowLabels?: string[];
  tierId?: string;
}

/**
 * Generates 2D seat coordinates for a grid layout.
 * Supports row staggering, column gaps, and aisles.
 */
export function generateGrid(params: GenerateGridParams): SeatNode[] {
  const {
    origin,
    rows,
    columns,
    seatWidth,
    gapX,
    gapY,
    staggerOffset = 0,
    aisleColumns = [],
    aisleWidth = seatWidth,
    sectionId,
    rowLabels,
    tierId,
  } = params;

  if (rows <= 0 || columns <= 0) {
    return [];
  }
  if (seatWidth <= 0) {
    throw new Error(`seatWidth must be positive, got ${seatWidth}`);
  }

  const seats: SeatNode[] = [];

  for (let r = 0; r < rows; r++) {
    const rowLabel = rowLabels?.[r] ?? rowToLabel(r);
    const isOddRow = r % 2 !== 0;
    const startX = origin.x + (isOddRow ? staggerOffset : 0);
    const y = origin.y + r * (seatWidth + gapY);

    let currentX = startX;

    for (let c = 0; c < columns; c++) {
      if (c > 0) {
        const isAisle = aisleColumns.includes(c);
        const aisleExtra = isAisle ? aisleWidth : 0;
        currentX += seatWidth + gapX + aisleExtra;
      }

      const seatNum = String(c + 1);
      const id = buildSeatId(sectionId, rowLabel, seatNum);

      seats.push({
        id,
        x: Number(currentX.toFixed(4)),
        y: Number(y.toFixed(4)),
        rotation: 0, // Facing default forward in degrees
        sectionId,
        row: rowLabel,
        number: seatNum,
        ...(tierId ? { tierId } : {}),
      });
    }
  }

  return seats;
}
