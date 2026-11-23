# Graph Report - . (2026-11-23)

## Corpus Check

- 209 files · ~79,825 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 717 nodes · 991 edges · 65 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 302 · references: 301 · method: 178 · imports: 64 · imports_from: 63 · calls: 59 · implements: 22 · inherits: 2

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 209 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 6 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `c90ccf6`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `AuthService` - 18 edges
2. `RedisScriptsWrapper` - 16 edges
3. `ExpiryService` - 14 edges
4. `AdminController` - 12 edges
5. `AdminService` - 11 edges
6. `AuthController` - 11 edges
7. `TicketsService` - 10 edges
8. `SeatUpdatesGateway` - 10 edges
9. `EventSeat` - 10 edges
10. `Event` - 10 edges

## Surprising Connections (you probably didn't know these)

- `AdminService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/admin/admin.service.ts → _Bridges community 15 → community 18_
- `AuditLogInterceptor` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/admin/audit-log.interceptor.ts → _Bridges community 29 → community 18_
- `AuditService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/admin/audit.service.ts → _Bridges community 26 → community 18_
- `PlatformSettingsService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/admin/platform-settings.service.ts → _Bridges community 6 → community 18_
- `AnalyticsService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/analytics/analytics.service.ts → _Bridges community 30 → community 18_

## Communities

### Community 0 - "Community 0"

Cohesion: 0.05
Nodes (32): AdminController, AnalyticsController, AuthController, OrganizerController, Body, CheckoutController, Controller, CurrentUser (+24 more)

### Community 1 - "Community 1"

Cohesion: 0.05
Nodes (21): AdminModule, AnalyticsModule, AuthModule, BloomModule, CheckoutModule, OnModuleDestroy, DatabaseModule, OnModuleDestroy (+13 more)

### Community 2 - "Community 2"

Cohesion: 0.09
Nodes (30): Header(), HeaderProps, QRVisualizer(), QRVisualizerProps, RequestEditor(), RequestEditorProps, ResponseViewer(), ResponseViewerProps (+22 more)

### Community 3 - "Community 3"

Cohesion: 0.06
Nodes (35): AuthResponse, AuthResponseSchema, AuthUser, AuthUserSchema, CreateGateStaffRequest, CreateGateStaffRequestSchema, LoginRequest, LoginRequestSchema (+27 more)

### Community 4 - "Community 4"

Cohesion: 0.19
Nodes (20): Column, CreateDateColumn, AuditLog, Event, EventSeat, GateScan, Order, OrderItem (+12 more)

### Community 5 - "Community 5"

Cohesion: 0.07
Nodes (21): ConfirmSoldParams, ConfirmSoldResult, ExtendHoldParams, ExtendHoldResult, HoldSeatsParams, HoldSeatsResult, ioredis, LUA_DIR (+13 more)

### Community 6 - "Community 6"

Cohesion: 0.09
Nodes (10): PlatformSettingsPort, PlatformSettingsService, EventSeatCatalogPort, EventsService, ChargeResult, MockPaymentService, PaymentProvider, EventSeatCatalogPort (+2 more)

### Community 7 - "Community 7"

Cohesion: 0.14
Nodes (11): ConnectedSocket, JoinEventPayload, OnModuleDestroy, OnModuleInit, SeatUpdatesBroadcastPayload, SeatUpdatesGateway, EventsGateway, MessageBody (+3 more)

### Community 8 - "Community 8"

Cohesion: 0.29
Nodes (1): AuthService

### Community 9 - "Community 9"

Cohesion: 0.12
Nodes (14): ArcSectionConfig, ArcSectionConfigSchema, GridSectionConfig, GridSectionConfigSchema, Point, PointSchema, SeatNode, SeatNodeSchema (+6 more)

### Community 10 - "Community 10"

Cohesion: 0.17
Nodes (5): Cron, ExpiryMetrics, ExpiryService, OnModuleDestroy, SeatExpiryPubSubPayload

### Community 11 - "Community 11"

Cohesion: 0.13
Nodes (14): AdminReasonDto, AdminReasonSchema, AuditLogDto, AuditLogQuery, AuditLogQuerySchema, CommissionSettingsResponse, FlagOrderResponse, PaginatedAuditLogs (+6 more)

### Community 12 - "Community 12"

Cohesion: 0.19
Nodes (7): GenerateArcParams, GenerateGridParams, GenerateTableClusterParams, TableClusterGroup, TableClusterTransform, buildSeatId(), rowToLabel()

### Community 13 - "Community 13"

Cohesion: 0.14
Nodes (5): createSeatLockClient(), getCounts(), getSnapshot(), RedisScriptsWrapper, registerRedisScripts()

### Community 14 - "Community 14"

Cohesion: 0.29
Nodes (9): checkForeignKeyIndexes(), checkMongooseSchemaIndexes(), checkPrimaryKeys(), checkSynchronizeFlag(), DbCheckReport, runDbChecks(), scanAndCheckMongooseIndexes(), AppDataSource (+1 more)

### Community 15 - "Community 15"

Cohesion: 0.24
Nodes (2): AdminActor, AdminService

### Community 16 - "Community 16"

Cohesion: 0.18
Nodes (8): MigrationInterface, Utb2InitExtensions1794836828550, CONFIRM_SOLD_LUA, EXPIRE_DUE_LUA, EXTEND_HOLD_LUA, HOLD_SEATS_LUA, RELEASE_SEATS_LUA, UNSELL_SEATS_LUA

### Community 17 - "Community 17"

Cohesion: 0.27
Nodes (3): Inject, Optional, OrdersService

### Community 18 - "Community 18"

Cohesion: 0.20
Nodes (4): Injectable, GoogleStrategy, JwtPayload, JwtStrategy

### Community 19 - "Community 19"

Cohesion: 0.27
Nodes (1): TicketsService

### Community 20 - "Community 20"

Cohesion: 0.22
Nodes (8): HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SearchIndexJob, SearchIndexJobSchema, TicketSeedRotationJob, TicketSeedRotationJobSchema

### Community 21 - "Community 21"

Cohesion: 0.25
Nodes (7): CheckoutRequest, CheckoutRequestSchema, OrderItemDto, OrderItemDtoSchema, OrderResponse, OrderResponseSchema, OrderStatus

### Community 22 - "Community 22"

Cohesion: 0.39
Nodes (6): InternalSeatNode, InternalVenueLayout, InvalidLayoutError, parseLayout(), serializeLayout(), validateSectionConstraints()

### Community 23 - "Community 23"

Cohesion: 0.43
Nodes (2): BloomService, OnApplicationBootstrap

### Community 24 - "Community 24"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 25 - "Community 25"

Cohesion: 0.43
Nodes (5): convexHull(), crossProduct(), SectionAggregate, sectionAggregates(), BoundingBox

### Community 26 - "Community 26"

Cohesion: 0.33
Nodes (2): AuditService, RecordAuditLogParams

### Community 27 - "Community 27"

Cohesion: 0.40
Nodes (1): GateService

### Community 28 - "Community 28"

Cohesion: 0.33
Nodes (3): HoldExpiryProcessor, OnModuleDestroy, OnModuleInit

### Community 29 - "Community 29"

Cohesion: 0.40
Nodes (2): AuditLogInterceptor, NestInterceptor

### Community 30 - "Community 30"

Cohesion: 0.40
Nodes (2): AnalyticsRequester, AnalyticsService

### Community 31 - "Community 31"

Cohesion: 0.40
Nodes (3): Catch, ExceptionFilter, GlobalHttpExceptionFilter

### Community 32 - "Community 32"

Cohesion: 0.40
Nodes (2): CheckoutService, SeatUpdatePubSubPayload

### Community 33 - "Community 33"

Cohesion: 0.40
Nodes (1): JwtAuthGuard

### Community 34 - "Community 34"

Cohesion: 0.40
Nodes (2): CanActivate, RolesGuard

### Community 35 - "Community 35"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb9InitVenuesEvents1794836850000

### Community 36 - "Community 36"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb3InitUsers1794837000000

### Community 37 - "Community 37"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb10InitOrders1794936850000

### Community 38 - "Community 38"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb14InitTicketsGateScans1795036850000

### Community 39 - "Community 39"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb16InitAdminAudit1795136850000

### Community 40 - "Community 40"

Cohesion: 0.40
Nodes (4): Document, VenueLayoutDocument, VenueLayoutModel, VenueLayoutSchema

### Community 41 - "Community 41"

Cohesion: 0.40
Nodes (4): EntryVelocityBucket, HoldStats, OrganizerAnalyticsResponse, ResaleStats

### Community 42 - "Community 42"

Cohesion: 0.40
Nodes (4): HoldRequest, HoldRequestSchema, HoldResponse, HoldResponseSchema

### Community 43 - "Community 43"

Cohesion: 0.40
Nodes (1): VenuesService

### Community 44 - "Community 44"

Cohesion: 0.50
Nodes (2): CanActivate, OwnershipGuard

### Community 45 - "Community 45"

Cohesion: 0.67
Nodes (1): HealthService

### Community 46 - "Community 46"

Cohesion: 0.50
Nodes (2): Env, envSchema

### Community 47 - "Community 47"

Cohesion: 0.50
Nodes (3): ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema

### Community 48 - "Community 48"

Cohesion: 0.67
Nodes (2): EventEmitter, MockRedisSubscriber

### Community 49 - "Community 49"

Cohesion: 1.00
Nodes (1): config

### Community 50 - "Community 50"

Cohesion: 1.00
Nodes (1): config

### Community 51 - "Community 51"

Cohesion: 1.00
Nodes (1): config

### Community 52 - "Community 52"

Cohesion: 1.00
Nodes (1): config

### Community 53 - "Community 53"

Cohesion: 1.00
Nodes (1): CurrentUser

### Community 56 - "Community 56"

Cohesion: 1.00
Nodes (1): CheckoutDto

### Community 57 - "Community 57"

Cohesion: 1.00
Nodes (1): CreateEventDto

### Community 58 - "Community 58"

Cohesion: 1.00
Nodes (1): CreateVenueDto

### Community 59 - "Community 59"

Cohesion: 1.00
Nodes (1): LoginDto

### Community 60 - "Community 60"

Cohesion: 1.00
Nodes (1): RegisterDto

### Community 61 - "Community 61"

Cohesion: 1.00
Nodes (1): ScanTicketDto

### Community 62 - "Community 62"

Cohesion: 1.00
Nodes (1): config

### Community 63 - "Community 63"

Cohesion: 1.00
Nodes (1): config

### Community 64 - "Community 64"

Cohesion: 1.00
Nodes (1): RedisKeys

### Community 65 - "Community 65"

Cohesion: 1.00
Nodes (1): config

### Community 66 - "Community 66"

Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps

- **157 isolated node(s):** `config`, `AdminActor`, `RecordAuditLogParams`, `AnalyticsRequester`, `CurrentUser` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 8`** (1 nodes): `AuthService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (2 nodes): `AdminActor`, `AdminService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (1 nodes): `TicketsService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `BloomService`, `OnApplicationBootstrap`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `AuditService`, `RecordAuditLogParams`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `GateService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `AuditLogInterceptor`, `NestInterceptor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `AnalyticsRequester`, `AnalyticsService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `CheckoutService`, `SeatUpdatePubSubPayload`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `JwtAuthGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `CanActivate`, `RolesGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `MigrationInterface`, `Utb9InitVenuesEvents1794836850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `MigrationInterface`, `Utb3InitUsers1794837000000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `MigrationInterface`, `Utb10InitOrders1794936850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `MigrationInterface`, `Utb14InitTicketsGateScans1795036850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `MigrationInterface`, `Utb16InitAdminAudit1795136850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `VenuesService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `CanActivate`, `OwnershipGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `HealthService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `Env`, `envSchema`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `EventEmitter`, `MockRedisSubscriber`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `CurrentUser`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `CheckoutDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `CreateEventDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `CreateVenueDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `LoginDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `RegisterDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `ScanTicketDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `RedisKeys`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthService` connect `Community 8` to `Community 17`, `Community 18`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `config`, `AdminActor`, `RecordAuditLogParams` to the rest of the system?**
  _157 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.050645007166746296 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.048726467331118496 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09191583610188261 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.0553306342780027 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
