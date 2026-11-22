# Graph Report - . (2026-11-22)

## Corpus Check

- 158 files · ~56,196 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 512 nodes · 646 edges · 55 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 215 · references: 181 · method: 117 · calls: 46 · imports_from: 40 · imports: 28 · implements: 17 · inherits: 2

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 158 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 6 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `f64ac0c`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `AuthService` - 18 edges
2. `RedisScriptsWrapper` - 16 edges
3. `ExpiryService` - 14 edges
4. `AuthController` - 11 edges
5. `SeatUpdatesGateway` - 10 edges
6. `EventSeat` - 10 edges
7. `Event` - 10 edges
8. `Order` - 10 edges
9. `OrderItem` - 9 edges
10. `EventsService` - 8 edges

## Surprising Connections (you probably didn't know these)

- `AuthService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/auth/auth.service.ts → _Bridges community 7 → community 21_
- `CheckoutService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/checkout/checkout.service.ts → _Bridges community 14 → community 21_
- `EventsService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/events/events.service.ts → _Bridges community 20 → community 21_
- `ExpiryService` --references--> `Injectable` [EXTRACTED]
  apps/worker/src/modules/expiry/expiry.service.ts → _Bridges community 6 → community 21_
- `JwtAuthGuard` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/auth/guards/jwt-auth.guard.ts → _Bridges community 24 → community 21_

## Communities

### Community 0 - "Community 0"

Cohesion: 0.07
Nodes (23): AuthController, OrganizerController, Body, CheckoutController, Controller, CurrentUser, EventsController, Get (+15 more)

### Community 1 - "Community 1"

Cohesion: 0.06
Nodes (16): AuthModule, CheckoutModule, OnModuleDestroy, DatabaseModule, OnModuleDestroy, EventsModule, ExpiryModule, GatewayModule (+8 more)

### Community 2 - "Community 2"

Cohesion: 0.07
Nodes (21): ConfirmSoldParams, ConfirmSoldResult, ExtendHoldParams, ExtendHoldResult, HoldSeatsParams, HoldSeatsResult, ioredis, LUA_DIR (+13 more)

### Community 3 - "Community 3"

Cohesion: 0.09
Nodes (22): AuthResponse, AuthResponseSchema, AuthUser, AuthUserSchema, CreateGateStaffRequest, CreateGateStaffRequestSchema, LoginRequest, LoginRequestSchema (+14 more)

### Community 4 - "Community 4"

Cohesion: 0.23
Nodes (16): Column, CreateDateColumn, Event, EventSeat, Order, OrderItem, User, Venue (+8 more)

### Community 5 - "Community 5"

Cohesion: 0.15
Nodes (11): ConnectedSocket, JoinEventPayload, OnModuleDestroy, OnModuleInit, SeatUpdatesBroadcastPayload, SeatUpdatesGateway, EventsGateway, MessageBody (+3 more)

### Community 6 - "Community 6"

Cohesion: 0.15
Nodes (6): Cron, ExpiryMetrics, ExpiryService, OnModuleDestroy, SeatExpiryPubSubPayload, Optional

### Community 7 - "Community 7"

Cohesion: 0.29
Nodes (1): AuthService

### Community 8 - "Community 8"

Cohesion: 0.12
Nodes (14): ArcSectionConfig, ArcSectionConfigSchema, GridSectionConfig, GridSectionConfigSchema, Point, PointSchema, SeatNode, SeatNodeSchema (+6 more)

### Community 9 - "Community 9"

Cohesion: 0.19
Nodes (7): GenerateArcParams, GenerateGridParams, GenerateTableClusterParams, TableClusterGroup, TableClusterTransform, buildSeatId(), rowToLabel()

### Community 10 - "Community 10"

Cohesion: 0.14
Nodes (5): createSeatLockClient(), getCounts(), getSnapshot(), RedisScriptsWrapper, registerRedisScripts()

### Community 11 - "Community 11"

Cohesion: 0.29
Nodes (9): checkForeignKeyIndexes(), checkMongooseSchemaIndexes(), checkPrimaryKeys(), checkSynchronizeFlag(), DbCheckReport, runDbChecks(), scanAndCheckMongooseIndexes(), AppDataSource (+1 more)

### Community 12 - "Community 12"

Cohesion: 0.20
Nodes (6): ChargeResult, MockPaymentService, PaymentProvider, EventSeatCatalogPort, PaymentProvider, PlatformSettingsPort

### Community 13 - "Community 13"

Cohesion: 0.18
Nodes (8): MigrationInterface, Utb2InitExtensions1794836828550, CONFIRM_SOLD_LUA, EXPIRE_DUE_LUA, EXTEND_HOLD_LUA, HOLD_SEATS_LUA, RELEASE_SEATS_LUA, UNSELL_SEATS_LUA

### Community 14 - "Community 14"

Cohesion: 0.22
Nodes (3): CheckoutService, SeatUpdatePubSubPayload, Inject

### Community 15 - "Community 15"

Cohesion: 0.22
Nodes (8): HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SearchIndexJob, SearchIndexJobSchema, TicketSeedRotationJob, TicketSeedRotationJobSchema

### Community 16 - "Community 16"

Cohesion: 0.25
Nodes (7): CheckoutRequest, CheckoutRequestSchema, OrderItemDto, OrderItemDtoSchema, OrderResponse, OrderResponseSchema, OrderStatus

### Community 17 - "Community 17"

Cohesion: 0.39
Nodes (6): InternalSeatNode, InternalVenueLayout, InvalidLayoutError, parseLayout(), serializeLayout(), validateSectionConstraints()

### Community 18 - "Community 18"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 19 - "Community 19"

Cohesion: 0.43
Nodes (5): convexHull(), crossProduct(), SectionAggregate, sectionAggregates(), BoundingBox

### Community 20 - "Community 20"

Cohesion: 0.33
Nodes (2): EventSeatCatalogPort, EventsService

### Community 21 - "Community 21"

Cohesion: 0.33
Nodes (3): Injectable, JwtPayload, JwtStrategy

### Community 22 - "Community 22"

Cohesion: 0.33
Nodes (3): HoldExpiryProcessor, OnModuleDestroy, OnModuleInit

### Community 23 - "Community 23"

Cohesion: 0.40
Nodes (3): Catch, ExceptionFilter, GlobalHttpExceptionFilter

### Community 24 - "Community 24"

Cohesion: 0.40
Nodes (1): JwtAuthGuard

### Community 25 - "Community 25"

Cohesion: 0.40
Nodes (2): CanActivate, RolesGuard

### Community 26 - "Community 26"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb9InitVenuesEvents1794836850000

### Community 27 - "Community 27"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb3InitUsers1794837000000

### Community 28 - "Community 28"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb10InitOrders1794936850000

### Community 29 - "Community 29"

Cohesion: 0.40
Nodes (1): OrdersService

### Community 30 - "Community 30"

Cohesion: 0.40
Nodes (4): Document, VenueLayoutDocument, VenueLayoutModel, VenueLayoutSchema

### Community 31 - "Community 31"

Cohesion: 0.40
Nodes (4): HoldRequest, HoldRequestSchema, HoldResponse, HoldResponseSchema

### Community 32 - "Community 32"

Cohesion: 0.40
Nodes (1): VenuesService

### Community 33 - "Community 33"

Cohesion: 0.50
Nodes (2): CanActivate, OwnershipGuard

### Community 34 - "Community 34"

Cohesion: 0.67
Nodes (1): HealthService

### Community 36 - "Community 36"

Cohesion: 0.50
Nodes (2): Env, envSchema

### Community 37 - "Community 37"

Cohesion: 0.50
Nodes (3): ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema

### Community 38 - "Community 38"

Cohesion: 0.50
Nodes (3): PaginatedResult, PaginationQuery, PaginationQuerySchema

### Community 39 - "Community 39"

Cohesion: 0.50
Nodes (1): GoogleStrategy

### Community 40 - "Community 40"

Cohesion: 0.67
Nodes (2): EventEmitter, MockRedisSubscriber

### Community 41 - "Community 41"

Cohesion: 1.00
Nodes (1): config

### Community 42 - "Community 42"

Cohesion: 1.00
Nodes (1): config

### Community 43 - "Community 43"

Cohesion: 1.00
Nodes (1): config

### Community 44 - "Community 44"

Cohesion: 1.00
Nodes (1): config

### Community 45 - "Community 45"

Cohesion: 1.00
Nodes (1): CurrentUser

### Community 48 - "Community 48"

Cohesion: 1.00
Nodes (1): CheckoutDto

### Community 49 - "Community 49"

Cohesion: 1.00
Nodes (1): CreateEventDto

### Community 50 - "Community 50"

Cohesion: 1.00
Nodes (1): CreateVenueDto

### Community 51 - "Community 51"

Cohesion: 1.00
Nodes (1): LoginDto

### Community 52 - "Community 52"

Cohesion: 1.00
Nodes (1): RegisterDto

### Community 53 - "Community 53"

Cohesion: 1.00
Nodes (1): config

### Community 54 - "Community 54"

Cohesion: 1.00
Nodes (1): config

### Community 55 - "Community 55"

Cohesion: 1.00
Nodes (1): RedisKeys

### Community 56 - "Community 56"

Cohesion: 1.00
Nodes (1): config

### Community 57 - "Community 57"

Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps

- **120 isolated node(s):** `config`, `PlatformSettingsPort`, `CurrentUser`, `LoginDto`, `RegisterDto` (+115 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 7`** (1 nodes): `AuthService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `EventSeatCatalogPort`, `EventsService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (1 nodes): `JwtAuthGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `CanActivate`, `RolesGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `MigrationInterface`, `Utb9InitVenuesEvents1794836850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `MigrationInterface`, `Utb3InitUsers1794837000000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `MigrationInterface`, `Utb10InitOrders1794936850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `OrdersService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `VenuesService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `CanActivate`, `OwnershipGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `HealthService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `Env`, `envSchema`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `GoogleStrategy`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `EventEmitter`, `MockRedisSubscriber`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `CurrentUser`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `CheckoutDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `CreateEventDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `CreateVenueDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `LoginDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `RegisterDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `RedisKeys`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthService` connect `Community 7` to `Community 14`, `Community 21`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `ExpiryService` connect `Community 6` to `Community 21`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `SeatUpdatesGateway` connect `Community 5` to `Community 14`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `config`, `PlatformSettingsPort`, `CurrentUser` to the rest of the system?**
  _120 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
