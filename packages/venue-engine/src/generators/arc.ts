import { SeatNode, Point, radToDeg, degToRad } from "@urticketbuddy/contracts";
import { buildSeatId, rowToLabel } from "../utils/ids";

export interface GenerateArcParams {
  center: Point;
  thetaStart: number;
  thetaEnd: number;
  rInner: number;
  rowGap: number;
  rows: number;
  seatWidth: number;
  gapX: number;
  sectionId: string;
  rowLabels?: string[];
  tierId?: string;
  isDegrees?: boolean;
}

/**
 * Generates 2D seat coordinates for an arc (curved) seating section.
 * Calculates seats per row according to arc length and seats facing origin (center).
 */
export function generateArc(params: GenerateArcParams): SeatNode[] {
  const {
    center,
    rInner,
    rowGap,
    rows,
    seatWidth,
    gapX,
    sectionId,
    rowLabels,
    tierId,
  } = params;

  if (rows <= 0) return [];
  if (seatWidth <= 0) {
    throw new Error(`seatWidth must be positive, got ${seatWidth}`);
  }
  if (rInner <= 0) {
    throw new Error(`rInner must be positive, got ${rInner}`);
  }

  // Detect or use specified angle units
  const isDeg =
    params.isDegrees ??
    Math.abs(params.thetaEnd - params.thetaStart) > 2 * Math.PI;
  const thetaStart = isDeg ? degToRad(params.thetaStart) : params.thetaStart;
  const thetaEnd = isDeg ? degToRad(params.thetaEnd) : params.thetaEnd;

  const thetaSpan = thetaEnd - thetaStart;
  if (thetaSpan <= 0) {
    return [];
  }

  const seats: SeatNode[] = [];

  for (let r = 0; r < rows; r++) {
    const rowLabel = rowLabels?.[r] ?? rowToLabel(r);
    const radius = rInner + r * rowGap;

    // Max seats per row = Math.floor((radius * (thetaEnd - thetaStart) + gapX) / (seatWidth + gapX))
    const maxSeats = Math.floor(
      (radius * thetaSpan + gapX) / (seatWidth + gapX),
    );
    if (maxSeats <= 0) continue;

    // Calculate angular step to guarantee chord distance >= seatWidth
    const minChordAngle =
      seatWidth <= 2 * radius
        ? 2 * Math.asin(seatWidth / (2 * radius))
        : (seatWidth + gapX) / radius;
    const nominalStepAngle = (seatWidth + gapX) / radius;
    const stepAngle = Math.max(nominalStepAngle, minChordAngle);

    // Total span occupied by the seats
    const totalOccupiedSpan = (maxSeats - 1) * stepAngle;
    const margin = Math.max(0, (thetaSpan - totalOccupiedSpan) / 2);

    for (let s = 0; s < maxSeats; s++) {
      const theta =
        maxSeats === 1
          ? thetaStart + thetaSpan / 2
          : thetaStart + margin + s * stepAngle;

      // Position math: x = Xc + radius * cos(theta), y = Yc + radius * sin(theta)
      const x = center.x + radius * Math.cos(theta);
      const y = center.y + radius * Math.sin(theta);

      // Rotation: Rotate seat by theta + 90 deg (converted to radians/degrees) to face center (Xc, Yc)
      const rotationDeg = (radToDeg(theta) + 90 + 360) % 360;

      const seatNum = String(s + 1);
      const id = buildSeatId(sectionId, rowLabel, seatNum);

      seats.push({
        id,
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4)),
        rotation: Number(rotationDeg.toFixed(4)),
        sectionId,
        row: rowLabel,
        number: seatNum,
        ...(tierId ? { tierId } : {}),
      });
    }
  }

  return seats;
}
