# Graph Report - . (2026-11-16)

## Corpus Check

- Corpus is ~33,480 words - fits in a single context window. You may not need a graph.

## Summary

- 228 nodes · 253 edges · 28 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 138 · imports_from: 35 · imports: 25 · method: 21 · calls: 17 · references: 14 · implements: 3

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 90 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `638213a`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `RedisScriptsWrapper` - 16 edges
2. `runDbChecks()` - 7 edges
3. `HoldExpiryProcessor` - 6 edges
4. `EventsGateway` - 5 edges
5. `Utb2InitExtensions1794836828550` - 5 edges
6. `buildSeatId()` - 5 edges
7. `InvalidLayoutError` - 5 edges
8. `HealthController` - 4 edges
9. `HealthService` - 4 edges
10. `rowToLabel()` - 4 edges

## Surprising Connections (you probably didn't know these)

- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"

Cohesion: 0.06
Nodes (28): CONFIRM_SOLD_LUA, ConfirmSoldParams, ConfirmSoldResult, EXPIRE_DUE_LUA, EXTEND_HOLD_LUA, ExtendHoldParams, ExtendHoldResult, HOLD_SEATS_LUA (+20 more)

### Community 1 - "Community 1"

Cohesion: 0.12
Nodes (14): ArcSectionConfig, ArcSectionConfigSchema, GridSectionConfig, GridSectionConfigSchema, Point, PointSchema, SeatNode, SeatNodeSchema (+6 more)

### Community 2 - "Community 2"

Cohesion: 0.19
Nodes (7): GenerateArcParams, GenerateGridParams, GenerateTableClusterParams, TableClusterGroup, TableClusterTransform, buildSeatId(), rowToLabel()

### Community 3 - "Community 3"

Cohesion: 0.14
Nodes (5): createSeatLockClient(), getCounts(), getSnapshot(), RedisScriptsWrapper, registerRedisScripts()

### Community 4 - "Community 4"

Cohesion: 0.29
Nodes (9): checkForeignKeyIndexes(), checkMongooseSchemaIndexes(), checkPrimaryKeys(), checkSynchronizeFlag(), DbCheckReport, runDbChecks(), scanAndCheckMongooseIndexes(), AppDataSource (+1 more)

### Community 5 - "Community 5"

Cohesion: 0.18
Nodes (10): SeatState, SeatStateColors, TicketStatus, UserRole, RoomJoinPayload, RoomJoinSchema, RoomLeavePayload, RoomLeaveSchema (+2 more)

### Community 6 - "Community 6"

Cohesion: 0.20
Nodes (5): HealthService, Injectable, HoldExpiryProcessor, OnModuleDestroy, OnModuleInit

### Community 7 - "Community 7"

Cohesion: 0.31
Nodes (6): ConnectedSocket, EventsGateway, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 8 - "Community 8"

Cohesion: 0.22
Nodes (8): HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SearchIndexJob, SearchIndexJobSchema, TicketSeedRotationJob, TicketSeedRotationJobSchema

### Community 9 - "Community 9"

Cohesion: 0.39
Nodes (6): InternalSeatNode, InternalVenueLayout, InvalidLayoutError, parseLayout(), serializeLayout(), validateSectionConstraints()

### Community 10 - "Community 10"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 11 - "Community 11"

Cohesion: 0.43
Nodes (5): convexHull(), crossProduct(), SectionAggregate, sectionAggregates(), BoundingBox

### Community 12 - "Community 12"

Cohesion: 0.33
Nodes (3): Controller, Get, HealthController

### Community 13 - "Community 13"

Cohesion: 0.40
Nodes (3): HealthModule, Module, AppModule

### Community 14 - "Community 14"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb2InitExtensions1794836828550

### Community 15 - "Community 15"

Cohesion: 0.40
Nodes (4): HoldRequest, HoldRequestSchema, HoldResponse, HoldResponseSchema

### Community 16 - "Community 16"

Cohesion: 0.50
Nodes (3): EventSeatCatalogPort, PaymentProvider, PlatformSettingsPort

### Community 18 - "Community 18"

Cohesion: 0.50
Nodes (2): Env, envSchema

### Community 19 - "Community 19"

Cohesion: 0.50
Nodes (3): ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema

### Community 20 - "Community 20"

Cohesion: 0.50
Nodes (3): PaginatedResult, PaginationQuery, PaginationQuerySchema

### Community 21 - "Community 21"

Cohesion: 1.00
Nodes (1): config

### Community 22 - "Community 22"

Cohesion: 1.00
Nodes (1): config

### Community 23 - "Community 23"

Cohesion: 1.00
Nodes (1): config

### Community 24 - "Community 24"

Cohesion: 1.00
Nodes (1): config

### Community 25 - "Community 25"

Cohesion: 1.00
Nodes (1): config

### Community 26 - "Community 26"

Cohesion: 1.00
Nodes (1): config

### Community 27 - "Community 27"

Cohesion: 1.00
Nodes (1): config

### Community 28 - "Community 28"

Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps

- **89 isolated node(s):** `config`, `EventSeatCatalogPort`, `PlatformSettingsPort`, `PaymentProvider`, `config` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 14`** (2 nodes): `MigrationInterface`, `Utb2InitExtensions1794836828550`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (2 nodes): `Env`, `envSchema`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `RedisScriptsWrapper` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `Utb2InitExtensions1794836828550` connect `Community 14` to `Community 0`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `config`, `EventSeatCatalogPort`, `PlatformSettingsPort` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06401137980085349 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
