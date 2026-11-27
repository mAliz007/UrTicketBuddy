# Graph Report - . (2026-11-27)

## Corpus Check

- 273 files · ~107,356 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 978 nodes · 1365 edges · 102 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 445 · references: 390 · method: 238 · calls: 96 · imports: 83 · imports_from: 82 · implements: 29 · inherits: 2

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 273 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 8 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `7705b20`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `AuthService` - 18 edges
2. `RedisScriptsWrapper` - 16 edges
3. `ExpiryService` - 14 edges
4. `AdminController` - 12 edges
5. `SearchCircuitBreaker` - 12 edges
6. `AdminService` - 11 edges
7. `AuthController` - 11 edges
8. `SearchIndexProcessor` - 11 edges
9. `TicketsService` - 10 edges
10. `SeatUpdatesGateway` - 10 edges

## Surprising Connections (you probably didn't know these)

- `AdminController` --references--> `Controller` [EXTRACTED]
  apps/api/src/modules/admin/admin.controller.ts → _Bridges community 6 → community 18_
- `AdminController` --references--> `Roles` [EXTRACTED]
  apps/api/src/modules/admin/admin.controller.ts → _Bridges community 6 → community 9_
- `AdminController` --references--> `UseGuards` [EXTRACTED]
  apps/api/src/modules/admin/admin.controller.ts → _Bridges community 6 → community 23_
- `AdminService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/admin/admin.service.ts → _Bridges community 22 → community 20_
- `AuditLogInterceptor` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/admin/audit-log.interceptor.ts → _Bridges community 49 → community 20_

## Communities

### Community 0 - "Community 0"

Cohesion: 0.09
Nodes (30): Header(), HeaderProps, QRVisualizer(), QRVisualizerProps, RequestEditor(), RequestEditorProps, ResponseViewer(), ResponseViewerProps (+22 more)

### Community 1 - "Community 1"

Cohesion: 0.06
Nodes (14): PlatformSettingsPort, PlatformSettingsService, EventSeatCatalogPort, EventsService, ChargeResult, MockPaymentService, PaymentProvider, DefaultPlatformSettingsProvider (+6 more)

### Community 2 - "Community 2"

Cohesion: 0.05
Nodes (36): AuthResponse, AuthResponseSchema, AuthUser, AuthUserSchema, CreateGateStaffRequest, CreateGateStaffRequestSchema, LoginRequest, LoginRequestSchema (+28 more)

### Community 3 - "Community 3"

Cohesion: 0.18
Nodes (22): Column, CreateDateColumn, AuditLog, Event, EventSeat, GateScan, LedgerEntry, Order (+14 more)

### Community 4 - "Community 4"

Cohesion: 0.06
Nodes (31): EventSearchGeoPoint, EventSearchGeoPointSchema, HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SEARCH_INDEX_QUEUE, SearchIndexJob (+23 more)

### Community 5 - "Community 5"

Cohesion: 0.07
Nodes (21): ConfirmSoldParams, ConfirmSoldResult, ExtendHoldParams, ExtendHoldResult, HoldSeatsParams, HoldSeatsResult, ioredis, LUA_DIR (+13 more)

### Community 6 - "Community 6"

Cohesion: 0.15
Nodes (9): AdminController, CurrentUser, Delete, Param, Patch, Put, Req, AuthenticatedUser (+1 more)

### Community 7 - "Community 7"

Cohesion: 0.19
Nodes (18): checkForeignKeyIndexes(), checkMongooseSchemaIndexes(), checkPrimaryKeys(), checkSynchronizeFlag(), DbCheckReport, runDbChecks(), scanAndCheckMongooseIndexes(), checkFinancialLedgerIntegrity() (+10 more)

### Community 8 - "Community 8"

Cohesion: 0.11
Nodes (6): CircuitBreakerOptions, CircuitState, SearchCircuitBreaker, SearchEventsOutcome, SearchService, SearchSuggestOutcome

### Community 9 - "Community 9"

Cohesion: 0.24
Nodes (7): Body, EventsController, HttpCode, Post, Res, Roles, Throttle

### Community 10 - "Community 10"

Cohesion: 0.15
Nodes (6): Get, HealthController, Public, Query, SearchController, VenuesController

### Community 11 - "Community 11"

Cohesion: 0.14
Nodes (11): ConnectedSocket, JoinEventPayload, OnModuleDestroy, OnModuleInit, SeatUpdatesBroadcastPayload, SeatUpdatesGateway, EventsGateway, MessageBody (+3 more)

### Community 12 - "Community 12"

Cohesion: 0.29
Nodes (1): AuthService

### Community 13 - "Community 13"

Cohesion: 0.20
Nodes (12): base64UrlEncode(), clearStaleRedisEventState(), generate1000VirtualUsers(), generate5000SeatDefinitions(), LoadTestSeedManifest, LoadTestUserEntry, runLoadTestSeed(), signLoadTestJwt() (+4 more)

### Community 14 - "Community 14"

Cohesion: 0.13
Nodes (6): createSeatLockClient(), getCounts(), getSnapshot(), RedisKeys, RedisScriptsWrapper, registerRedisScripts()

### Community 15 - "Community 15"

Cohesion: 0.12
Nodes (14): ArcSectionConfig, ArcSectionConfigSchema, GridSectionConfig, GridSectionConfigSchema, Point, PointSchema, SeatNode, SeatNodeSchema (+6 more)

### Community 16 - "Community 16"

Cohesion: 0.17
Nodes (5): Cron, ExpiryMetrics, ExpiryService, OnModuleDestroy, SeatExpiryPubSubPayload

### Community 17 - "Community 17"

Cohesion: 0.13
Nodes (14): AdminReasonDto, AdminReasonSchema, AuditLogDto, AuditLogQuery, AuditLogQuerySchema, CommissionSettingsResponse, FlagOrderResponse, PaginatedAuditLogs (+6 more)

### Community 18 - "Community 18"

Cohesion: 0.13
Nodes (6): AnalyticsController, OrganizerController, CheckoutController, Controller, GateController, UseInterceptors

### Community 19 - "Community 19"

Cohesion: 0.19
Nodes (7): GenerateArcParams, GenerateGridParams, GenerateTableClusterParams, TableClusterGroup, TableClusterTransform, buildSeatId(), rowToLabel()

### Community 20 - "Community 20"

Cohesion: 0.14
Nodes (6): CanActivate, OwnershipGuard, Injectable, GoogleStrategy, JwtPayload, JwtStrategy

### Community 21 - "Community 21"

Cohesion: 0.15
Nodes (7): AdminModule, AnalyticsModule, AuthModule, EventsModule, ExpiryModule, Module, VenuesModule

### Community 22 - "Community 22"

Cohesion: 0.24
Nodes (2): AdminActor, AdminService

### Community 23 - "Community 23"

Cohesion: 0.21
Nodes (3): AuthController, UserTicketsController, UseGuards

### Community 24 - "Community 24"

Cohesion: 0.18
Nodes (8): MigrationInterface, Utb2InitExtensions1794836828550, CONFIRM_SOLD_LUA, EXPIRE_DUE_LUA, EXTEND_HOLD_LUA, HOLD_SEATS_LUA, RELEASE_SEATS_LUA, UNSELL_SEATS_LUA

### Community 25 - "Community 25"

Cohesion: 0.25
Nodes (4): OnModuleDestroy, OnModuleInit, SEARCH_INDEX_JOB_OPTIONS, SearchIndexProcessor

### Community 26 - "Community 26"

Cohesion: 0.20
Nodes (9): checkoutLatencyMs, funnelConflicts, funnelHoldsWon, funnelOrdersCompleted, funnelServerErrors, options, seedData, TOTAL_VUS (+1 more)

### Community 27 - "Community 27"

Cohesion: 0.20
Nodes (8): holdsConflicted, holdsSucceeded, options, seedData, serverErrors, TOTAL_VUS, users, validSeatHoldRate

### Community 28 - "Community 28"

Cohesion: 0.31
Nodes (7): computeNextIndexName(), getExistingAliasIndices(), getMatchingVersionedIndices(), main(), reindexEvents(), ReindexOptions, ReindexResult

### Community 29 - "Community 29"

Cohesion: 0.20
Nodes (8): CreateResaleListingDto, CreateResaleListingSchema, LedgerEntryKind, PurchaseResaleListingDto, PurchaseResaleListingSchema, ResaleListingStatus, UpdateResaleListingDto, UpdateResaleListingSchema

### Community 30 - "Community 30"

Cohesion: 0.27
Nodes (1): TicketsService

### Community 31 - "Community 31"

Cohesion: 0.33
Nodes (1): MediaService

### Community 32 - "Community 32"

Cohesion: 0.43
Nodes (2): Inject, Optional

### Community 33 - "Community 33"

Cohesion: 0.25
Nodes (4): BloomModule, DatabaseModule, OnModuleDestroy, Global

### Community 34 - "Community 34"

Cohesion: 0.36
Nodes (6): isSensitiveField(), LogRedactionInterceptor, NestInterceptor, redactSensitiveData(), sanitizeUrl(), SENSITIVE_KEYS

### Community 35 - "Community 35"

Cohesion: 0.25
Nodes (7): holdsConflicted, holdsWon, options, seedData, serverErrors, TOTAL_VUS, users

### Community 36 - "Community 36"

Cohesion: 0.25
Nodes (7): options, seedData, TOTAL_VUS, users, wsBroadcastLatencyMs, wsBroadcastsReceived, wsConnectionsEstablished

### Community 37 - "Community 37"

Cohesion: 0.25
Nodes (7): ALLOWED_MEDIA_MIME_TYPES, AllowedMediaMimeType, GenerateUploadUrlRequest, GenerateUploadUrlRequestSchema, GenerateUploadUrlResponse, GenerateUploadUrlResponseSchema, MediaPurpose

### Community 38 - "Community 38"

Cohesion: 0.25
Nodes (7): CheckoutRequest, CheckoutRequestSchema, OrderItemDto, OrderItemDtoSchema, OrderResponse, OrderResponseSchema, OrderStatus

### Community 39 - "Community 39"

Cohesion: 0.39
Nodes (6): InternalSeatNode, InternalVenueLayout, InvalidLayoutError, parseLayout(), serializeLayout(), validateSectionConstraints()

### Community 40 - "Community 40"

Cohesion: 0.43
Nodes (2): BloomService, OnApplicationBootstrap

### Community 41 - "Community 41"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 42 - "Community 42"

Cohesion: 0.43
Nodes (5): convexHull(), crossProduct(), SectionAggregate, sectionAggregates(), BoundingBox

### Community 43 - "Community 43"

Cohesion: 0.33
Nodes (2): AuditService, RecordAuditLogParams

### Community 44 - "Community 44"

Cohesion: 0.40
Nodes (1): GateService

### Community 45 - "Community 45"

Cohesion: 0.33
Nodes (2): Headers, OrdersController

### Community 46 - "Community 46"

Cohesion: 0.33
Nodes (3): HoldExpiryProcessor, OnModuleDestroy, OnModuleInit

### Community 47 - "Community 47"

Cohesion: 0.33
Nodes (1): ResaleService

### Community 48 - "Community 48"

Cohesion: 0.33
Nodes (2): OnModuleDestroy, SearchModule

### Community 49 - "Community 49"

Cohesion: 0.40
Nodes (2): AuditLogInterceptor, NestInterceptor

### Community 50 - "Community 50"

Cohesion: 0.40
Nodes (2): AnalyticsRequester, AnalyticsService

### Community 51 - "Community 51"

Cohesion: 0.40
Nodes (3): Catch, ExceptionFilter, GlobalHttpExceptionFilter

### Community 52 - "Community 52"

Cohesion: 0.40
Nodes (2): CheckoutModule, OnModuleDestroy

### Community 53 - "Community 53"

Cohesion: 0.40
Nodes (2): CheckoutService, SeatUpdatePubSubPayload

### Community 54 - "Community 54"

Cohesion: 0.40
Nodes (1): JwtAuthGuard

### Community 55 - "Community 55"

Cohesion: 0.40
Nodes (2): CanActivate, RolesGuard

### Community 56 - "Community 56"

Cohesion: 0.50
Nodes (1): HealthService

### Community 57 - "Community 57"

Cohesion: 0.40
Nodes (2): OnModuleDestroy, WorkerInfraModule

### Community 58 - "Community 58"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb9InitVenuesEvents1794836850000

### Community 59 - "Community 59"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb3InitUsers1794837000000

### Community 60 - "Community 60"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb10InitOrders1794936850000

### Community 61 - "Community 61"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb14InitTicketsGateScans1795036850000

### Community 62 - "Community 62"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb15InitResaleLedger1795136850000

### Community 63 - "Community 63"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb16InitAdminAudit1795136850000

### Community 64 - "Community 64"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb17AddTicketUniqueSeatIdx1795236850000

### Community 65 - "Community 65"

Cohesion: 0.40
Nodes (4): Document, VenueLayoutDocument, VenueLayoutModel, VenueLayoutSchema

### Community 66 - "Community 66"

Cohesion: 0.40
Nodes (4): EntryVelocityBucket, HoldStats, OrganizerAnalyticsResponse, ResaleStats

### Community 67 - "Community 67"

Cohesion: 0.40
Nodes (4): HoldRequest, HoldRequestSchema, HoldResponse, HoldResponseSchema

### Community 68 - "Community 68"

Cohesion: 0.40
Nodes (1): VenuesService

### Community 69 - "Community 69"

Cohesion: 0.50
Nodes (1): MediaController

### Community 70 - "Community 70"

Cohesion: 0.50
Nodes (1): OrdersService

### Community 71 - "Community 71"

Cohesion: 0.50
Nodes (2): EVENTS_INDEX_MAPPINGS, EVENTS_INDEX_SETTINGS

### Community 72 - "Community 72"

Cohesion: 0.50
Nodes (2): EVENTS_INDEX_MAPPINGS, EVENTS_INDEX_SETTINGS

### Community 73 - "Community 73"

Cohesion: 0.50
Nodes (2): Env, envSchema

### Community 74 - "Community 74"

Cohesion: 0.50
Nodes (3): ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema

### Community 75 - "Community 75"

Cohesion: 0.50
Nodes (1): TicketsController

### Community 76 - "Community 76"

Cohesion: 0.50
Nodes (1): UsersController

### Community 78 - "Community 78"

Cohesion: 0.67
Nodes (2): EventEmitter, MockRedisSubscriber

### Community 79 - "Community 79"

Cohesion: 1.00
Nodes (1): config

### Community 80 - "Community 80"

Cohesion: 1.00
Nodes (1): config

### Community 81 - "Community 81"

Cohesion: 1.00
Nodes (1): config

### Community 82 - "Community 82"

Cohesion: 1.00
Nodes (1): config

### Community 83 - "Community 83"

Cohesion: 1.00
Nodes (1): CurrentUser

### Community 86 - "Community 86"

Cohesion: 1.00
Nodes (1): CheckoutDto

### Community 87 - "Community 87"

Cohesion: 1.00
Nodes (1): CreateEventDto

### Community 88 - "Community 88"

Cohesion: 1.00
Nodes (1): CreateVenueDto

### Community 89 - "Community 89"

Cohesion: 1.00
Nodes (1): GenerateUploadUrlDto

### Community 90 - "Community 90"

Cohesion: 1.00
Nodes (1): LoginDto

### Community 91 - "Community 91"

Cohesion: 1.00
Nodes (1): RegisterDto

### Community 92 - "Community 92"

Cohesion: 1.00
Nodes (1): ScanTicketDto

### Community 93 - "Community 93"

Cohesion: 1.00
Nodes (1): GateModule

### Community 94 - "Community 94"

Cohesion: 1.00
Nodes (1): GatewayModule

### Community 95 - "Community 95"

Cohesion: 1.00
Nodes (1): HealthModule

### Community 96 - "Community 96"

Cohesion: 1.00
Nodes (1): MediaModule

### Community 97 - "Community 97"

Cohesion: 1.00
Nodes (1): OrdersModule

### Community 98 - "Community 98"

Cohesion: 1.00
Nodes (1): config

### Community 99 - "Community 99"

Cohesion: 1.00
Nodes (1): config

### Community 100 - "Community 100"

Cohesion: 1.00
Nodes (1): ResaleModule

### Community 102 - "Community 102"

Cohesion: 1.00
Nodes (1): AppModule

### Community 103 - "Community 103"

Cohesion: 1.00
Nodes (1): TicketsModule

### Community 104 - "Community 104"

Cohesion: 1.00
Nodes (1): config

### Community 105 - "Community 105"

Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps

- **246 isolated node(s):** `config`, `SENSITIVE_KEYS`, `AdminActor`, `RecordAuditLogParams`, `AnalyticsRequester` (+241 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 12`** (1 nodes): `AuthService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `AdminActor`, `AdminService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `TicketsService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `MediaService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `Inject`, `Optional`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `BloomService`, `OnApplicationBootstrap`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `AuditService`, `RecordAuditLogParams`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `GateService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `Headers`, `OrdersController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `ResaleService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `OnModuleDestroy`, `SearchModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `AuditLogInterceptor`, `NestInterceptor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `AnalyticsRequester`, `AnalyticsService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `CheckoutModule`, `OnModuleDestroy`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `CheckoutService`, `SeatUpdatePubSubPayload`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `JwtAuthGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `CanActivate`, `RolesGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `HealthService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `OnModuleDestroy`, `WorkerInfraModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `MigrationInterface`, `Utb9InitVenuesEvents1794836850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `MigrationInterface`, `Utb3InitUsers1794837000000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `MigrationInterface`, `Utb10InitOrders1794936850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (2 nodes): `MigrationInterface`, `Utb14InitTicketsGateScans1795036850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `MigrationInterface`, `Utb15InitResaleLedger1795136850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `MigrationInterface`, `Utb16InitAdminAudit1795136850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (2 nodes): `MigrationInterface`, `Utb17AddTicketUniqueSeatIdx1795236850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `VenuesService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `MediaController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `OrdersService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (2 nodes): `EVENTS_INDEX_MAPPINGS`, `EVENTS_INDEX_SETTINGS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (2 nodes): `EVENTS_INDEX_MAPPINGS`, `EVENTS_INDEX_SETTINGS`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (2 nodes): `Env`, `envSchema`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `TicketsController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `UsersController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (2 nodes): `EventEmitter`, `MockRedisSubscriber`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `CurrentUser`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `CheckoutDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `CreateEventDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `CreateVenueDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `GenerateUploadUrlDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `LoginDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (1 nodes): `RegisterDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (1 nodes): `ScanTicketDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `GateModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `GatewayModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `HealthModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (1 nodes): `MediaModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (1 nodes): `OrdersModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 100`** (1 nodes): `ResaleModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 102`** (1 nodes): `AppModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (1 nodes): `TicketsModule`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 104`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 105`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `SearchService` connect `Community 8` to `Community 20`, `Community 32`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Community 12` to `Community 32`, `Community 20`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `config`, `SENSITIVE_KEYS`, `AdminActor` to the rest of the system?**
  _246 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09191583610188261 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05731707317073171 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05384615384615385 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
