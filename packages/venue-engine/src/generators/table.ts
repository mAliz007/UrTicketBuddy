import { SeatNode, Point, radToDeg, degToRad } from "@urticketbuddy/contracts";
import { buildSeatId } from "../utils/ids";

export interface GenerateTableClusterParams {
  center: Point;
  tableRadius: number;
  seatCount: number;
  sectionId: string;
  tableId?: string;
  seatWidth?: number;
  tierId?: string;
  startAngle?: number; // default 0
  isDegrees?: boolean;
}

export interface TableClusterTransform {
  translate: { dx: number; dy: number };
  rotate: { angle: number; pivot: Point };
}

export interface TableClusterGroup {
  id: string;
  sectionId: string;
  table: {
    center: Point;
    radius: number;
  };
  transform: TableClusterTransform;
  seats: SeatNode[];
}

/**
 * Generates seats placed radially around a circular table.
 * Returns a group containing the table metadata, transform info, and generated seats.
 */
export function generateTableCluster(
  params: GenerateTableClusterParams,
): TableClusterGroup {
  const {
    center,
    tableRadius,
    seatCount,
    sectionId,
    tableId = "T1",
    tierId,
    startAngle = 0,
    isDegrees = false,
  } = params;

  if (tableRadius <= 0) {
    throw new Error(`tableRadius must be positive, got ${tableRadius}`);
  }
  if (seatCount <= 0) {
    throw new Error(`seatCount must be a positive integer, got ${seatCount}`);
  }

  const startRad = isDegrees ? degToRad(startAngle) : startAngle;
  const seats: SeatNode[] = [];

  for (let i = 0; i < seatCount; i++) {
    // theta = i * (2 * Math.PI / seatCount)
    const theta = startRad + i * ((2 * Math.PI) / seatCount);

    const x = center.x + tableRadius * Math.cos(theta);
    const y = center.y + tableRadius * Math.sin(theta);

    // Rotate seat to face table center
    const rotationDeg = (radToDeg(theta) + 90 + 360) % 360;

    const seatNum = String(i + 1);
    const id = buildSeatId(sectionId, tableId, seatNum);

    seats.push({
      id,
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      rotation: Number(rotationDeg.toFixed(4)),
      sectionId,
      row: tableId,
      number: seatNum,
      ...(tierId ? { tierId } : {}),
    });
  }

  return {
    id: `${sectionId}-${tableId}`,
    sectionId,
    table: {
      center: { ...center },
      radius: tableRadius,
    },
    transform: {
      translate: { dx: center.x, dy: center.y },
      rotate: { angle: startAngle, pivot: { ...center } },
    },
    seats,
  };
}
