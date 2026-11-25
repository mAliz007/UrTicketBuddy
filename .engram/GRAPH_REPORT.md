# Graph Report - . (2026-11-25)

## Corpus Check

- 257 files · ~104,634 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 882 nodes · 1242 edges · 84 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 395 · references: 372 · method: 211 · calls: 84 · imports: 77 · imports_from: 75 · implements: 26 · inherits: 2

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 257 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 7 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `deec913`
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

- `AdminController` --references--> `Controller` [EXTRACTED]
  apps/api/src/modules/admin/admin.controller.ts → _Bridges community 11 → community 18_
- `AdminController` --references--> `Roles` [EXTRACTED]
  apps/api/src/modules/admin/admin.controller.ts → _Bridges community 11 → community 8_
- `AdminController` --references--> `UseGuards` [EXTRACTED]
  apps/api/src/modules/admin/admin.controller.ts → _Bridges community 11 → community 10_
- `AdminService` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/admin/admin.service.ts → _Bridges community 20 → community 23_
- `AuditLogInterceptor` --references--> `Injectable` [EXTRACTED]
  apps/api/src/modules/admin/audit-log.interceptor.ts → _Bridges community 43 → community 23_

## Communities

### Community 0 - "Community 0"

Cohesion: 0.04
Nodes (23): AdminModule, AnalyticsModule, AuthModule, BloomModule, CheckoutModule, OnModuleDestroy, DatabaseModule, OnModuleDestroy (+15 more)

### Community 1 - "Community 1"

Cohesion: 0.09
Nodes (30): Header(), HeaderProps, QRVisualizer(), QRVisualizerProps, RequestEditor(), RequestEditorProps, ResponseViewer(), ResponseViewerProps (+22 more)

### Community 2 - "Community 2"

Cohesion: 0.06
Nodes (14): PlatformSettingsPort, PlatformSettingsService, EventSeatCatalogPort, EventsService, ChargeResult, MockPaymentService, PaymentProvider, DefaultPlatformSettingsProvider (+6 more)

### Community 3 - "Community 3"

Cohesion: 0.05
Nodes (36): AuthResponse, AuthResponseSchema, AuthUser, AuthUserSchema, CreateGateStaffRequest, CreateGateStaffRequestSchema, LoginRequest, LoginRequestSchema (+28 more)

### Community 4 - "Community 4"

Cohesion: 0.18
Nodes (22): Column, CreateDateColumn, AuditLog, Event, EventSeat, GateScan, LedgerEntry, Order (+14 more)

### Community 5 - "Community 5"

Cohesion: 0.07
Nodes (21): ConfirmSoldParams, ConfirmSoldResult, ExtendHoldParams, ExtendHoldResult, HoldSeatsParams, HoldSeatsResult, ioredis, LUA_DIR (+13 more)

### Community 6 - "Community 6"

Cohesion: 0.19
Nodes (18): checkForeignKeyIndexes(), checkMongooseSchemaIndexes(), checkPrimaryKeys(), checkSynchronizeFlag(), DbCheckReport, runDbChecks(), scanAndCheckMongooseIndexes(), checkFinancialLedgerIntegrity() (+10 more)

### Community 7 - "Community 7"

Cohesion: 0.19
Nodes (9): Body, CurrentUser, Delete, Param, Patch, Put, Req, AuthenticatedUser (+1 more)

### Community 8 - "Community 8"

Cohesion: 0.18
Nodes (6): EventsController, Headers, HttpCode, OrdersController, Post, Roles

### Community 9 - "Community 9"

Cohesion: 0.14
Nodes (11): ConnectedSocket, JoinEventPayload, OnModuleDestroy, OnModuleInit, SeatUpdatesBroadcastPayload, SeatUpdatesGateway, EventsGateway, MessageBody (+3 more)

### Community 10 - "Community 10"

Cohesion: 0.18
Nodes (6): AuthController, MediaController, Public, Res, Throttle, UseGuards

### Community 11 - "Community 11"

Cohesion: 0.14
Nodes (5): AdminController, Get, HealthController, Query, UserTicketsController

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
Nodes (6): OrganizerController, CheckoutController, Controller, GateController, TicketsController, UseInterceptors

### Community 19 - "Community 19"

Cohesion: 0.19
Nodes (7): GenerateArcParams, GenerateGridParams, GenerateTableClusterParams, TableClusterGroup, TableClusterTransform, buildSeatId(), rowToLabel()

### Community 20 - "Community 20"

Cohesion: 0.24
Nodes (2): AdminActor, AdminService

### Community 21 - "Community 21"

Cohesion: 0.18
Nodes (8): MigrationInterface, Utb2InitExtensions1794836828550, CONFIRM_SOLD_LUA, EXPIRE_DUE_LUA, EXTEND_HOLD_LUA, HOLD_SEATS_LUA, RELEASE_SEATS_LUA, UNSELL_SEATS_LUA

### Community 22 - "Community 22"

Cohesion: 0.27
Nodes (3): Inject, Optional, OrdersService

### Community 23 - "Community 23"

Cohesion: 0.20
Nodes (5): CanActivate, OwnershipGuard, Injectable, JwtPayload, JwtStrategy

### Community 24 - "Community 24"

Cohesion: 0.20
Nodes (9): checkoutLatencyMs, funnelConflicts, funnelHoldsWon, funnelOrdersCompleted, funnelServerErrors, options, seedData, TOTAL_VUS (+1 more)

### Community 25 - "Community 25"

Cohesion: 0.20
Nodes (8): holdsConflicted, holdsSucceeded, options, seedData, serverErrors, TOTAL_VUS, users, validSeatHoldRate

### Community 26 - "Community 26"

Cohesion: 0.20
Nodes (8): CreateResaleListingDto, CreateResaleListingSchema, LedgerEntryKind, PurchaseResaleListingDto, PurchaseResaleListingSchema, ResaleListingStatus, UpdateResaleListingDto, UpdateResaleListingSchema

### Community 27 - "Community 27"

Cohesion: 0.27
Nodes (1): TicketsService

### Community 28 - "Community 28"

Cohesion: 0.33
Nodes (1): MediaService

### Community 29 - "Community 29"

Cohesion: 0.22
Nodes (8): HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SearchIndexJob, SearchIndexJobSchema, TicketSeedRotationJob, TicketSeedRotationJobSchema

### Community 30 - "Community 30"

Cohesion: 0.36
Nodes (6): isSensitiveField(), LogRedactionInterceptor, NestInterceptor, redactSensitiveData(), sanitizeUrl(), SENSITIVE_KEYS

### Community 31 - "Community 31"

Cohesion: 0.25
Nodes (7): holdsConflicted, holdsWon, options, seedData, serverErrors, TOTAL_VUS, users

### Community 32 - "Community 32"

Cohesion: 0.25
Nodes (7): options, seedData, TOTAL_VUS, users, wsBroadcastLatencyMs, wsBroadcastsReceived, wsConnectionsEstablished

### Community 33 - "Community 33"

Cohesion: 0.25
Nodes (7): ALLOWED_MEDIA_MIME_TYPES, AllowedMediaMimeType, GenerateUploadUrlRequest, GenerateUploadUrlRequestSchema, GenerateUploadUrlResponse, GenerateUploadUrlResponseSchema, MediaPurpose

### Community 34 - "Community 34"

Cohesion: 0.25
Nodes (7): CheckoutRequest, CheckoutRequestSchema, OrderItemDto, OrderItemDtoSchema, OrderResponse, OrderResponseSchema, OrderStatus

### Community 35 - "Community 35"

Cohesion: 0.39
Nodes (6): InternalSeatNode, InternalVenueLayout, InvalidLayoutError, parseLayout(), serializeLayout(), validateSectionConstraints()

### Community 36 - "Community 36"

Cohesion: 0.43
Nodes (2): BloomService, OnApplicationBootstrap

### Community 37 - "Community 37"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 38 - "Community 38"

Cohesion: 0.43
Nodes (5): convexHull(), crossProduct(), SectionAggregate, sectionAggregates(), BoundingBox

### Community 39 - "Community 39"

Cohesion: 0.33
Nodes (2): AuditService, RecordAuditLogParams

### Community 40 - "Community 40"

Cohesion: 0.40
Nodes (1): GateService

### Community 41 - "Community 41"

Cohesion: 0.33
Nodes (3): HoldExpiryProcessor, OnModuleDestroy, OnModuleInit

### Community 42 - "Community 42"

Cohesion: 0.33
Nodes (1): ResaleService

### Community 43 - "Community 43"

Cohesion: 0.40
Nodes (2): AuditLogInterceptor, NestInterceptor

### Community 44 - "Community 44"

Cohesion: 0.40
Nodes (2): AnalyticsRequester, AnalyticsService

### Community 45 - "Community 45"

Cohesion: 0.40
Nodes (3): Catch, ExceptionFilter, GlobalHttpExceptionFilter

### Community 46 - "Community 46"

Cohesion: 0.40
Nodes (2): CheckoutService, SeatUpdatePubSubPayload

### Community 47 - "Community 47"

Cohesion: 0.40
Nodes (1): JwtAuthGuard

### Community 48 - "Community 48"

Cohesion: 0.40
Nodes (2): CanActivate, RolesGuard

### Community 49 - "Community 49"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb9InitVenuesEvents1794836850000

### Community 50 - "Community 50"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb3InitUsers1794837000000

### Community 51 - "Community 51"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb10InitOrders1794936850000

### Community 52 - "Community 52"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb14InitTicketsGateScans1795036850000

### Community 53 - "Community 53"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb15InitResaleLedger1795136850000

### Community 54 - "Community 54"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb16InitAdminAudit1795136850000

### Community 55 - "Community 55"

Cohesion: 0.40
Nodes (2): MigrationInterface, Utb17AddTicketUniqueSeatIdx1795236850000

### Community 56 - "Community 56"

Cohesion: 0.40
Nodes (4): Document, VenueLayoutDocument, VenueLayoutModel, VenueLayoutSchema

### Community 57 - "Community 57"

Cohesion: 0.40
Nodes (4): EntryVelocityBucket, HoldStats, OrganizerAnalyticsResponse, ResaleStats

### Community 58 - "Community 58"

Cohesion: 0.40
Nodes (4): HoldRequest, HoldRequestSchema, HoldResponse, HoldResponseSchema

### Community 59 - "Community 59"

Cohesion: 0.40
Nodes (1): VenuesService

### Community 60 - "Community 60"

Cohesion: 0.50
Nodes (1): AnalyticsController

### Community 61 - "Community 61"

Cohesion: 0.67
Nodes (1): HealthService

### Community 62 - "Community 62"

Cohesion: 0.50
Nodes (2): Env, envSchema

### Community 63 - "Community 63"

Cohesion: 0.50
Nodes (3): ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema

### Community 64 - "Community 64"

Cohesion: 0.50
Nodes (1): GoogleStrategy

### Community 65 - "Community 65"

Cohesion: 0.50
Nodes (1): UsersController

### Community 66 - "Community 66"

Cohesion: 0.50
Nodes (1): VenuesController

### Community 67 - "Community 67"

Cohesion: 0.67
Nodes (2): EventEmitter, MockRedisSubscriber

### Community 68 - "Community 68"

Cohesion: 1.00
Nodes (1): config

### Community 69 - "Community 69"

Cohesion: 1.00
Nodes (1): config

### Community 70 - "Community 70"

Cohesion: 1.00
Nodes (1): config

### Community 71 - "Community 71"

Cohesion: 1.00
Nodes (1): config

### Community 72 - "Community 72"

Cohesion: 1.00
Nodes (1): CurrentUser

### Community 75 - "Community 75"

Cohesion: 1.00
Nodes (1): CheckoutDto

### Community 76 - "Community 76"

Cohesion: 1.00
Nodes (1): CreateEventDto

### Community 77 - "Community 77"

Cohesion: 1.00
Nodes (1): CreateVenueDto

### Community 78 - "Community 78"

Cohesion: 1.00
Nodes (1): GenerateUploadUrlDto

### Community 79 - "Community 79"

Cohesion: 1.00
Nodes (1): LoginDto

### Community 80 - "Community 80"

Cohesion: 1.00
Nodes (1): RegisterDto

### Community 81 - "Community 81"

Cohesion: 1.00
Nodes (1): ScanTicketDto

### Community 82 - "Community 82"

Cohesion: 1.00
Nodes (1): config

### Community 83 - "Community 83"

Cohesion: 1.00
Nodes (1): config

### Community 85 - "Community 85"

Cohesion: 1.00
Nodes (1): config

### Community 86 - "Community 86"

Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps

- **213 isolated node(s):** `config`, `SENSITIVE_KEYS`, `AdminActor`, `RecordAuditLogParams`, `AnalyticsRequester` (+208 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 12`** (1 nodes): `AuthService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `AdminActor`, `AdminService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `TicketsService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `MediaService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `BloomService`, `OnApplicationBootstrap`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `AuditService`, `RecordAuditLogParams`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `GateService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `ResaleService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `AuditLogInterceptor`, `NestInterceptor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `AnalyticsRequester`, `AnalyticsService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `CheckoutService`, `SeatUpdatePubSubPayload`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `JwtAuthGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `CanActivate`, `RolesGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `MigrationInterface`, `Utb9InitVenuesEvents1794836850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `MigrationInterface`, `Utb3InitUsers1794837000000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `MigrationInterface`, `Utb10InitOrders1794936850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `MigrationInterface`, `Utb14InitTicketsGateScans1795036850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `MigrationInterface`, `Utb15InitResaleLedger1795136850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `MigrationInterface`, `Utb16InitAdminAudit1795136850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `MigrationInterface`, `Utb17AddTicketUniqueSeatIdx1795236850000`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `VenuesService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `AnalyticsController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `HealthService`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `Env`, `envSchema`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `GoogleStrategy`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `UsersController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `VenuesController`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (2 nodes): `EventEmitter`, `MockRedisSubscriber`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `CurrentUser`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `CheckoutDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `CreateEventDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `CreateVenueDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `GenerateUploadUrlDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `LoginDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `RegisterDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `ScanTicketDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthService` connect `Community 12` to `Community 22`, `Community 23`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `config`, `SENSITIVE_KEYS`, `AdminActor` to the rest of the system?**
  _213 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04440333024976873 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09191583610188261 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05731707317073171 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05384615384615385 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
