# Graph Report - . (2026-11-16)

## Corpus Check

- Corpus is ~29,768 words - fits in a single context window. You may not need a graph.

## Summary

- 164 nodes · 161 edges · 23 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 93 · method: 18 · imports_from: 16 · references: 14 · imports: 12 · calls: 6 · implements: 2

## Input Scope

- Requested: all
- Resolved: all (source: configured-default)
- Included files: 75 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed

## Graph Freshness

- Built from Git commit: `e6135c6`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.

## God Nodes (most connected - your core abstractions)

1. `RedisScriptsWrapper` - 16 edges
2. `HoldExpiryProcessor` - 6 edges
3. `EventsGateway` - 5 edges
4. `HealthController` - 4 edges
5. `HealthService` - 4 edges
6. `RedisKeys` - 3 edges
7. `AppModule` - 2 edges
8. `HealthModule` - 2 edges
9. `SeatState` - 2 edges
10. `AppDataSource` - 2 edges

## Surprising Connections (you probably didn't know these)

- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"

Cohesion: 0.07
Nodes (28): CONFIRM_SOLD_LUA, ConfirmSoldParams, ConfirmSoldResult, EXPIRE_DUE_LUA, EXTEND_HOLD_LUA, ExtendHoldParams, ExtendHoldResult, HOLD_SEATS_LUA (+20 more)

### Community 1 - "Community 1"

Cohesion: 0.14
Nodes (5): createSeatLockClient(), getCounts(), getSnapshot(), RedisScriptsWrapper, registerRedisScripts()

### Community 2 - "Community 2"

Cohesion: 0.18
Nodes (10): SeatState, SeatStateColors, TicketStatus, UserRole, RoomJoinPayload, RoomJoinSchema, RoomLeavePayload, RoomLeaveSchema (+2 more)

### Community 3 - "Community 3"

Cohesion: 0.20
Nodes (5): HealthService, Injectable, HoldExpiryProcessor, OnModuleDestroy, OnModuleInit

### Community 4 - "Community 4"

Cohesion: 0.31
Nodes (6): ConnectedSocket, EventsGateway, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer

### Community 5 - "Community 5"

Cohesion: 0.22
Nodes (8): HoldExpiryJob, HoldExpiryJobSchema, OrderNotificationJob, OrderNotificationJobSchema, SearchIndexJob, SearchIndexJobSchema, TicketSeedRotationJob, TicketSeedRotationJobSchema

### Community 6 - "Community 6"

Cohesion: 0.29
Nodes (4): GeneratedSeat, GridSectionConfig, Point, RadialSectionConfig

### Community 7 - "Community 7"

Cohesion: 0.33
Nodes (3): Controller, Get, HealthController

### Community 8 - "Community 8"

Cohesion: 0.40
Nodes (3): HealthModule, Module, AppModule

### Community 9 - "Community 9"

Cohesion: 0.50
Nodes (2): AppDataSource, env

### Community 10 - "Community 10"

Cohesion: 0.40
Nodes (4): HoldRequest, HoldRequestSchema, HoldResponse, HoldResponseSchema

### Community 11 - "Community 11"

Cohesion: 0.50
Nodes (3): EventSeatCatalogPort, PaymentProvider, PlatformSettingsPort

### Community 13 - "Community 13"

Cohesion: 0.50
Nodes (2): Env, envSchema

### Community 14 - "Community 14"

Cohesion: 0.50
Nodes (3): ErrorCode, ErrorEnvelope, ErrorEnvelopeSchema

### Community 15 - "Community 15"

Cohesion: 0.50
Nodes (3): PaginatedResult, PaginationQuery, PaginationQuerySchema

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

### Community 23 - "Community 23"

Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps

- **66 isolated node(s):** `config`, `EventSeatCatalogPort`, `PlatformSettingsPort`, `PaymentProvider`, `config` (+61 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (2 nodes): `AppDataSource`, `env`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (2 nodes): `Env`, `envSchema`
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
- **Thin community `Community 23`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `RedisScriptsWrapper` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `registerRedisScripts()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `config`, `EventSeatCatalogPort`, `PlatformSettingsPort` to the rest of the system?**
  _66 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07308377896613191 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
