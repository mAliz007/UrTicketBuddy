# Graph Report - . (2026-11-15)

## Corpus Check

- Corpus is ~21,298 words - fits in a single context window. You may not need a graph.

## Summary

- 119 nodes · 101 edges · 19 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 58 · imports_from: 14 · references: 14 · method: 10 · implements: 2 · imports: 2 · calls: 1

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 68 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `6a08c6b`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `HoldExpiryProcessor` - 6 edges
2. `EventsGateway` - 5 edges
3. `HealthController` - 4 edges
4. `HealthService` - 4 edges
5. `RedisScriptsWrapper` - 3 edges
6. `AppModule` - 2 edges
7. `HealthModule` - 2 edges
8. `SeatState` - 2 edges
9. `AppDataSource` - 2 edges
10. `config` - 1 edges

## Surprising Connections (you probably didn't know these)

- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"

Cohesion: 0.13
Nodes (8): Env, envSchema, ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema, PaginatedResult, PaginationQuery, PaginationQuerySchema

### Community 1 - "Community 1"

Cohesion: 0.18
Nodes (10): SeatState, SeatStateColors, TicketStatus, UserRole, RoomJoinPayload, RoomJoinSchema, RoomLeavePayload, RoomLeaveSchema (+2 more)

### Community 2 - "Community 2"

Cohesion: 0.20
Nodes (5): HealthService, Injectable, HoldExpiryProcessor, OnModuleDestroy, OnModuleInit

### Community 3 - "Community 3"

Cohesion: 0.31
Nodes (6): ConnectedSocket, EventsGateway, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 4 - "Community 4"

Cohesion: 0.22
Nodes (8): HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SearchIndexJob, SearchIndexJobSchema, TicketSeedRotationJob, TicketSeedRotationJobSchema

### Community 5 - "Community 5"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 6 - "Community 6"

Cohesion: 0.33
Nodes (3): Controller, Get, HealthController

### Community 7 - "Community 7"

Cohesion: 0.33
Nodes (3): RedisScriptsWrapper, SeatHoldParams, SeatHoldResult

### Community 8 - "Community 8"

Cohesion: 0.40
Nodes (3): HealthModule, Module, AppModule

### Community 9 - "Community 9"

Cohesion: 0.50
Nodes (2): AppDataSource, env

### Community 10 - "Community 10"

Cohesion: 0.50
Nodes (3): EventSeatCatalogPort, PaymentProvider, PlatformSettingsPort

### Community 12 - "Community 12"

Cohesion: 1.00
Nodes (1): config

### Community 13 - "Community 13"

Cohesion: 1.00
Nodes (1): config

### Community 14 - "Community 14"

Cohesion: 1.00
Nodes (1): config

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

## Knowledge Gaps

- **43 isolated node(s):** `config`, `EventSeatCatalogPort`, `PlatformSettingsPort`, `PaymentProvider`, `config` (+38 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (2 nodes): `AppDataSource`, `env`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `config`
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

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **What connects `config`, `EventSeatCatalogPort`, `PlatformSettingsPort` to the rest of the system?**
  _43 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
