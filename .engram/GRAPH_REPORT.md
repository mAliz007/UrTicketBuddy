# Graph Report - . (2026-11-15)

## Corpus Check

- Corpus is ~26,268 words - fits in a single context window. You may not need a graph.

## Summary

- 170 nodes · 169 edges · 22 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 96 · imports_from: 30 · references: 14 · method: 11 · calls: 8 · imports: 8 · implements: 2

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 80 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `44e98bc`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `HoldExpiryProcessor` - 6 edges
2. `EventsGateway` - 5 edges
3. `buildSeatId()` - 5 edges
4. `InvalidLayoutError` - 5 edges
5. `HealthController` - 4 edges
6. `HealthService` - 4 edges
7. `rowToLabel()` - 4 edges
8. `RedisScriptsWrapper` - 3 edges
9. `convexHull()` - 3 edges
10. `validateSectionConstraints()` - 3 edges

## Surprising Connections (you probably didn't know these)

- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"

Cohesion: 0.09
Nodes (13): Env, envSchema, ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema, PaginatedResult, PaginationQuery, PaginationQuerySchema (+5 more)

### Community 1 - "Community 1"

Cohesion: 0.12
Nodes (14): ArcSectionConfig, ArcSectionConfigSchema, GridSectionConfig, GridSectionConfigSchema, Point, PointSchema, SeatNode, SeatNodeSchema (+6 more)

### Community 2 - "Community 2"

Cohesion: 0.19
Nodes (7): GenerateArcParams, GenerateGridParams, GenerateTableClusterParams, TableClusterGroup, TableClusterTransform, buildSeatId(), rowToLabel()

### Community 3 - "Community 3"

Cohesion: 0.18
Nodes (10): SeatState, SeatStateColors, TicketStatus, UserRole, RoomJoinPayload, RoomJoinSchema, RoomLeavePayload, RoomLeaveSchema (+2 more)

### Community 4 - "Community 4"

Cohesion: 0.20
Nodes (5): HealthService, Injectable, HoldExpiryProcessor, OnModuleDestroy, OnModuleInit

### Community 5 - "Community 5"

Cohesion: 0.31
Nodes (6): ConnectedSocket, EventsGateway, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 6 - "Community 6"

Cohesion: 0.22
Nodes (8): HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SearchIndexJob, SearchIndexJobSchema, TicketSeedRotationJob, TicketSeedRotationJobSchema

### Community 7 - "Community 7"

Cohesion: 0.39
Nodes (6): InternalSeatNode, InternalVenueLayout, InvalidLayoutError, parseLayout(), serializeLayout(), validateSectionConstraints()

### Community 8 - "Community 8"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 9 - "Community 9"

Cohesion: 0.33
Nodes (3): Controller, Get, HealthController

### Community 10 - "Community 10"

Cohesion: 0.33
Nodes (3): RedisScriptsWrapper, SeatHoldParams, SeatHoldResult

### Community 11 - "Community 11"

Cohesion: 0.40
Nodes (3): HealthModule, Module, AppModule

### Community 12 - "Community 12"

Cohesion: 0.50
Nodes (2): AppDataSource, env

### Community 13 - "Community 13"

Cohesion: 0.50
Nodes (3): EventSeatCatalogPort, PaymentProvider, PlatformSettingsPort

### Community 15 - "Community 15"

Cohesion: 1.00
Nodes (1): config

### Community 16 - "Community 16"

Cohesion: 1.00
Nodes (1): config

### Community 17 - "Community 17"

Cohesion: 1.00
Nodes (1): config

### Community 18 - "Community 18"

Cohesion: 1.00
Nodes (1): config

### Community 19 - "Community 19"

Cohesion: 1.00
Nodes (1): config

### Community 20 - "Community 20"

Cohesion: 1.00
Nodes (1): config

### Community 21 - "Community 21"

Cohesion: 1.00
Nodes (1): config

### Community 22 - "Community 22"

Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps

- **65 isolated node(s):** `config`, `EventSeatCatalogPort`, `PlatformSettingsPort`, `PaymentProvider`, `config` (+60 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 12`** (2 nodes): `AppDataSource`, `env`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **What connects `config`, `EventSeatCatalogPort`, `PlatformSettingsPort` to the rest of the system?**
  _65 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08923076923076922 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
