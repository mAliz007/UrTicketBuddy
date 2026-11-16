export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Calculates the bounding box (min/max X and Y, width, height) of an array of points or seats.
 */
export function boundingBox(
  items: ReadonlyArray<{ x: number; y: number }>,
): BoundingBox {
  if (items.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.x < minX) minX = item.x;
    if (item.x > maxX) maxX = item.x;
    if (item.y < minY) minY = item.y;
    if (item.y > maxY) maxY = item.y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
