# Graph Report - . (2026-11-18)

## Corpus Check

- Corpus is ~44,228 words - fits in a single context window. You may not need a graph.

## Summary

- 339 nodes · 384 edges · 35 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 164 · references: 78 · method: 51 · imports_from: 36 · imports: 26 · calls: 17 · implements: 10 · inherits: 2

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 118 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 3 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `e86a94b`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `RedisScriptsWrapper` - 16 edges
2. `SeatUpdatesGateway` - 10 edges
3. `EventSeat` - 10 edges
4. `Event` - 10 edges
5. `EventsService` - 8 edges
6. `runDbChecks()` - 7 edges
7. `Venue` - 7 edges
8. `EventsController` - 6 edges
9. `HoldExpiryProcessor` - 6 edges
10. `DatabaseModule` - 5 edges

## Surprising Connections (you probably didn't know these)

- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"

Cohesion: 0.06
Nodes (14): CheckoutService, SeatUpdatePubSubPayload, EventSeatCatalogPort, EventsService, HealthService, Inject, Injectable, EventSeatCatalogPort (+6 more)

### Community 1 - "Community 1"

Cohesion: 0.07
Nodes (21): ConfirmSoldParams, ConfirmSoldResult, ExtendHoldParams, ExtendHoldResult, HoldSeatsParams, HoldSeatsResult, ioredis, LUA_DIR (+13 more)

### Community 2 - "Community 2"

Cohesion: 0.11
Nodes (11): Body, CheckoutController, Controller, EventsController, Get, Headers, HealthController, HttpCode (+3 more)

### Community 3 - "Community 3"

Cohesion: 0.10
Nodes (11): CheckoutModule, OnModuleDestroy, DatabaseModule, OnModuleDestroy, EventsModule, GatewayModule, Global, HealthModule (+3 more)

### Community 4 - "Community 4"

Cohesion: 0.15
Nodes (11): ConnectedSocket, JoinEventPayload, OnModuleDestroy, OnModuleInit, SeatUpdatesBroadcastPayload, SeatUpdatesGateway, EventsGateway, MessageBody (+3 more)

### Community 5 - "Community 5"

Cohesion: 0.12
Nodes (14): ArcSectionConfig, ArcSectionConfigSchema, GridSectionConfig, GridSectionConfigSchema, Point, PointSchema, SeatNode, SeatNodeSchema (+6 more)

### Community 6 - "Community 6"

Cohesion: 0.23
Nodes (13): Column, CreateDateColumn, Event, EventSeat, Venue, Entity, Index, JoinColumn (+5 more)

### Community 7 - "Community 7"

Cohesion: 0.19
Nodes (7): GenerateArcParams, GenerateGridParams, GenerateTableClusterParams, TableClusterGroup, TableClusterTransform, buildSeatId(), rowToLabel()

### Community 8 - "Community 8"

Cohesion: 0.14
Nodes (5): createSeatLockClient(), getCounts(), getSnapshot(), RedisScriptsWrapper, registerRedisScripts()

### Community 9 - "Community 9"

Cohesion: 0.29
Nodes (9): checkForeignKeyIndexes(), checkMongooseSchemaIndexes(), checkPrimaryKeys(), checkSynchronizeFlag(), DbCheckReport, runDbChecks(), scanAndCheckMongooseIndexes(), AppDataSource (+1 more)

### Community 10 - "Community 10"

Cohesion: 0.18
Nodes (8): MigrationInterface, Utb2InitExtensions1794836828550, CONFIRM_SOLD_LUA, EXPIRE_DUE_LUA, EXTEND_HOLD_LUA, HOLD_SEATS_LUA, RELEASE_SEATS_LUA, UNSELL_SEATS_LUA

### Community 11 - "Community 11"

Cohesion: 0.18
Nodes (10): SeatState, SeatStateColors, TicketStatus, UserRole, RoomJoinPayload, RoomJoinSchema, RoomLeavePayload, RoomLeaveSchema (+2 more)

### Community 12 - "Community 12"

Cohesion: 0.22
Nodes (8): HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SearchIndexJob, SearchIndexJobSchema, TicketSeedRotationJob, TicketSeedRotationJobSchema

### Community 13 - "Community 13"

Cohesion: 0.39
Nodes (6): InternalSeatNode, InternalVenueLayout, InvalidLayoutError, parseLayout(), serializeLayout(), validateSectionConstraints()

### Community 14 - "Community 14"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 15 - "Community 15"

Cohesion: 0.43
Nodes (5): convexHull(), crossProduct(), SectionAggregate, sectionAggregates(), BoundingBox

### Community 16 - "Community 16"

Cohesion: 0.40
Nodes (3): Catch, ExceptionFilter, GlobalHttpExceptionFilter

### Community 17 - "Community 17"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb9InitVenuesEvents1794836850000

### Community 18 - "Community 18"

Cohesion: 0.40
Nodes (4): Document, VenueLayoutDocument, VenueLayoutModel, VenueLayoutSchema

### Community 19 - "Community 19"

Cohesion: 0.40
Nodes (4): HoldRequest, HoldRequestSchema, HoldResponse, HoldResponseSchema

### Community 21 - "Community 21"

Cohesion: 0.50
Nodes (2): Env, envSchema

### Community 22 - "Community 22"

Cohesion: 0.50
Nodes (3): ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema

### Community 23 - "Community 23"

Cohesion: 0.50
Nodes (3): PaginatedResult, PaginationQuery, PaginationQuerySchema

### Community 24 - "Community 24"

Cohesion: 0.67
Nodes (2): EventEmitter, MockRedisSubscriber

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

### Community 29 - "Community 29"

Cohesion: 1.00
Nodes (1): CreateEventDto

### Community 30 - "Community 30"

Cohesion: 1.00
Nodes (1): CreateVenueDto

### Community 31 - "Community 31"

Cohesion: 1.00
Nodes (1): config

### Community 32 - "Community 32"

Cohesion: 1.00
Nodes (1): config

### Community 33 - "Community 33"

Cohesion: 1.00
Nodes (1): RedisKeys

### Community 34 - "Community 34"

Cohesion: 1.00
Nodes (1): config

### Community 35 - "Community 35"

Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps

- **95 isolated node(s):** `config`, `PlatformSettingsPort`, `PaymentProvider`, `SeatUpdatePubSubPayload`, `CreateEventDto` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 17`** (2 nodes): `MigrationInterface`, `Utb9InitVenuesEvents1794836850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `Env`, `envSchema`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `EventEmitter`, `MockRedisSubscriber`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `CreateEventDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `CreateVenueDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `RedisKeys`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `RedisScriptsWrapper` connect `Community 8` to `Community 1`, `Community 10`, `Community 33`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `SeatUpdatesGateway` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `CheckoutModule` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `config`, `PlatformSettingsPort`, `PaymentProvider` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06190476190476191 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11384615384615385 - nodes in this community are weakly interconnected._
