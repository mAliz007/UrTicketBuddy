export interface Point {
  x: number;
  y: number;
}

export interface GridSectionConfig {
  sectionId: string;
  startX: number;
  startY: number;
  rows: number;
  seatsPerRow: number;
  seatSpacing: number;
  rowSpacing: number;
}

export interface GeneratedSeat {
  seatId: string; // format: <sectionId>-<row>-<number>
  sectionId: string;
  row: string;
  number: number;
  x: number;
  y: number;
}

export function generateGridSeats(config: GridSectionConfig): GeneratedSeat[] {
  const seats: GeneratedSeat[] = [];
  const {
    sectionId,
    startX,
    startY,
    rows,
    seatsPerRow,
    seatSpacing,
    rowSpacing,
  } = config;

  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r); // A, B, C...
    const y = startY + r * rowSpacing;

    for (let s = 1; s <= seatsPerRow; s++) {
      const x = startX + (s - 1) * seatSpacing;
      seats.push({
        seatId: `${sectionId}-${rowLabel}-${s}`,
        sectionId,
        row: rowLabel,
        number: s,
        x,
        y,
      });
    }
  }

  return seats;
}

export interface RadialSectionConfig {
  sectionId: string;
  centerX: number;
  centerY: number;
  startRadius: number;
  radiusStep: number;
  startAngleDeg: number;
  endAngleDeg: number;
  rows: number;
  seatsPerRow: number;
}

export function generateRadialSeats(
  config: RadialSectionConfig,
): GeneratedSeat[] {
  const seats: GeneratedSeat[] = [];
  const {
    sectionId,
    centerX,
    centerY,
    startRadius,
    radiusStep,
    startAngleDeg,
    endAngleDeg,
    rows,
    seatsPerRow,
  } = config;

  for (let r = 0; r < rows; r++) {
    const rowLabel = String.fromCharCode(65 + r);
    const radius = startRadius + r * radiusStep;
    const angleStep =
      seatsPerRow > 1 ? (endAngleDeg - startAngleDeg) / (seatsPerRow - 1) : 0;

    for (let s = 1; s <= seatsPerRow; s++) {
      const angleDeg = startAngleDeg + (s - 1) * angleStep;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = Math.round((centerX + radius * Math.cos(angleRad)) * 100) / 100;
      const y = Math.round((centerY + radius * Math.sin(angleRad)) * 100) / 100;

      seats.push({
        seatId: `${sectionId}-${rowLabel}-${s}`,
        sectionId,
        row: rowLabel,
        number: s,
        x,
        y,
      });
    }
  }

  return seats;
}
