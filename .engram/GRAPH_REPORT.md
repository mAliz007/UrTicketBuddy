# Graph Report - . (2026-11-18)

## Corpus Check

- Corpus is ~45,356 words - fits in a single context window. You may not need a graph.

## Summary

- 371 nodes · 422 edges · 40 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 177 · references: 90 · method: 59 · imports_from: 38 · imports: 27 · calls: 21 · implements: 9 · inherits: 1

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 128 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 1 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `f7be87d`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `RedisScriptsWrapper` - 16 edges
2. `EventSeat` - 10 edges
3. `Event` - 10 edges
4. `EventsService` - 8 edges
5. `AuthController` - 7 edges
6. `AuthService` - 7 edges
7. `runDbChecks()` - 7 edges
8. `User` - 7 edges
9. `Venue` - 7 edges
10. `EventsController` - 6 edges

## Surprising Connections (you probably didn't know these)

- `AuthService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/auth/auth.service.ts → _Bridges community 9 → community 2_
- `EventsService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/events/events.service.ts → _Bridges community 12 → community 2_

## Communities

### Community 0 - "Community 0"

Cohesion: 0.10
Nodes (14): AuthController, Body, Controller, CurrentUser, EventsController, Get, HealthController, HttpCode (+6 more)

### Community 1 - "Community 1"

Cohesion: 0.07
Nodes (21): ConfirmSoldParams, ConfirmSoldResult, ExtendHoldParams, ExtendHoldResult, HoldSeatsParams, HoldSeatsResult, ioredis, LUA_DIR (+13 more)

### Community 2 - "Community 2"

Cohesion: 0.08
Nodes (10): JwtAuthGuard, CanActivate, RolesGuard, HealthService, Injectable, HoldExpiryProcessor, OnModuleDestroy, OnModuleInit (+2 more)

### Community 3 - "Community 3"

Cohesion: 0.10
Nodes (18): AuthResponse, AuthResponseSchema, AuthUser, AuthUserSchema, LoginRequest, LoginRequestSchema, RegisterRequest, RegisterRequestSchema (+10 more)

### Community 4 - "Community 4"

Cohesion: 0.22
Nodes (14): Column, CreateDateColumn, Event, EventSeat, User, Venue, Entity, Index (+6 more)

### Community 5 - "Community 5"

Cohesion: 0.12
Nodes (14): ArcSectionConfig, ArcSectionConfigSchema, GridSectionConfig, GridSectionConfigSchema, Point, PointSchema, SeatNode, SeatNodeSchema (+6 more)

### Community 6 - "Community 6"

Cohesion: 0.13
Nodes (9): AuthModule, DatabaseModule, OnModuleDestroy, EventsModule, Global, HealthModule, Module, AppModule (+1 more)

### Community 7 - "Community 7"

Cohesion: 0.19
Nodes (7): GenerateArcParams, GenerateGridParams, GenerateTableClusterParams, TableClusterGroup, TableClusterTransform, buildSeatId(), rowToLabel()

### Community 8 - "Community 8"

Cohesion: 0.14
Nodes (5): createSeatLockClient(), getCounts(), getSnapshot(), RedisScriptsWrapper, registerRedisScripts()

### Community 9 - "Community 9"

Cohesion: 0.19
Nodes (3): AuthService, Inject, VenuesService

### Community 10 - "Community 10"

Cohesion: 0.29
Nodes (9): checkForeignKeyIndexes(), checkMongooseSchemaIndexes(), checkPrimaryKeys(), checkSynchronizeFlag(), DbCheckReport, runDbChecks(), scanAndCheckMongooseIndexes(), AppDataSource (+1 more)

### Community 11 - "Community 11"

Cohesion: 0.18
Nodes (8): MigrationInterface, Utb2InitExtensions1794836828550, CONFIRM_SOLD_LUA, EXPIRE_DUE_LUA, EXTEND_HOLD_LUA, HOLD_SEATS_LUA, RELEASE_SEATS_LUA, UNSELL_SEATS_LUA

### Community 12 - "Community 12"

Cohesion: 0.20
Nodes (5): EventSeatCatalogPort, EventsService, EventSeatCatalogPort, PaymentProvider, PlatformSettingsPort

### Community 13 - "Community 13"

Cohesion: 0.31
Nodes (6): ConnectedSocket, EventsGateway, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 14 - "Community 14"

Cohesion: 0.22
Nodes (8): HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SearchIndexJob, SearchIndexJobSchema, TicketSeedRotationJob, TicketSeedRotationJobSchema

### Community 15 - "Community 15"

Cohesion: 0.39
Nodes (6): InternalSeatNode, InternalVenueLayout, InvalidLayoutError, parseLayout(), serializeLayout(), validateSectionConstraints()

### Community 16 - "Community 16"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 17 - "Community 17"

Cohesion: 0.43
Nodes (5): convexHull(), crossProduct(), SectionAggregate, sectionAggregates(), BoundingBox

### Community 18 - "Community 18"

Cohesion: 0.40
Nodes (3): Catch, ExceptionFilter, GlobalHttpExceptionFilter

### Community 19 - "Community 19"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb9InitVenuesEvents1794836850000

### Community 20 - "Community 20"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb3InitUsers1794837000000

### Community 21 - "Community 21"

Cohesion: 0.40
Nodes (4): Document, VenueLayoutDocument, VenueLayoutModel, VenueLayoutSchema

### Community 22 - "Community 22"

Cohesion: 0.40
Nodes (4): HoldRequest, HoldRequestSchema, HoldResponse, HoldResponseSchema

### Community 24 - "Community 24"

Cohesion: 0.50
Nodes (2): Env, envSchema

### Community 25 - "Community 25"

Cohesion: 0.50
Nodes (3): ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema

### Community 26 - "Community 26"

Cohesion: 0.50
Nodes (3): PaginatedResult, PaginationQuery, PaginationQuerySchema

### Community 27 - "Community 27"

Cohesion: 1.00
Nodes (1): config

### Community 28 - "Community 28"

Cohesion: 1.00
Nodes (1): config

### Community 29 - "Community 29"

Cohesion: 1.00
Nodes (1): config

### Community 30 - "Community 30"

Cohesion: 1.00
Nodes (1): config

### Community 31 - "Community 31"

Cohesion: 1.00
Nodes (1): CurrentUser

### Community 34 - "Community 34"

Cohesion: 1.00
Nodes (1): CreateEventDto

### Community 35 - "Community 35"

Cohesion: 1.00
Nodes (1): CreateVenueDto

### Community 36 - "Community 36"

Cohesion: 1.00
Nodes (1): LoginDto

### Community 37 - "Community 37"

Cohesion: 1.00
Nodes (1): RegisterDto

### Community 38 - "Community 38"

Cohesion: 1.00
Nodes (1): config

### Community 39 - "Community 39"

Cohesion: 1.00
Nodes (1): config

### Community 40 - "Community 40"

Cohesion: 1.00
Nodes (1): RedisKeys

### Community 41 - "Community 41"

Cohesion: 1.00
Nodes (1): config

### Community 42 - "Community 42"

Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps

- **103 isolated node(s):** `config`, `PlatformSettingsPort`, `PaymentProvider`, `CurrentUser`, `LoginDto` (+98 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 19`** (2 nodes): `MigrationInterface`, `Utb9InitVenuesEvents1794836850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `MigrationInterface`, `Utb3InitUsers1794837000000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `Env`, `envSchema`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `CurrentUser`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `CreateEventDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `CreateVenueDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `LoginDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `RegisterDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `RedisKeys`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `RedisScriptsWrapper` connect `Community 8` to `Community 1`, `Community 11`, `Community 40`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `EventsService` connect `Community 12` to `Community 9`, `Community 2`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `config`, `PlatformSettingsPort`, `PaymentProvider` to the rest of the system?**
  _103 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1028225806451613 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.10476190476190476 - nodes in this community are weakly interconnected._
