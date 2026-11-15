# @urticketbuddy/venue-engine

Pure TypeScript parametric layout mathematics for venue seat maps.

## Features

- Independent of DOM/Canvas (runs identically on server or web client).
- **Grid Layout**: `generateGridSeats` calculates rectangular row/seat coordinates.
- **Radial Layout**: `generateRadialSeats` calculates curved and amphitheater seating arcs.
- Seat IDs follow `<sectionId>-<row>-<number>` (e.g. `SEC1-A-12`).
