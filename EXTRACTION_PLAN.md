# AgentBank Trading Backend — PerpsTrader Extraction Plan

## Executive Summary

Extract the core Hyperliquid trading engine from PerpsTrader (~8,500 lines across 10 files) into a standalone backend service for the AgentBank Next.js 16 frontend. The backend will be a Node.js/Express (or Fastify) server with SQLite storage, exposing REST + WebSocket APIs that the frontend consumes. All PerpsTrader-specific baggage (news agents, pumpfun, research engine, LangGraph, ChromaDB, Redis pub/sub, child process management) is stripped.

---

## Part 1: File-by-File Analysis

### 1. `hyperliquid-client.ts` (2053 lines)

**What it does:** Core SDK wrapper around `@nktkas/hyperliquid` for Hyperliquid testnet/mainnet. Handles wallet setup via EIP-712 (viem), HTTP transport, asset index discovery from chain metadata, and all order placement/cancellation with extensive anti-churn protections, rate limiting, circuit breakers, order deduplication, and fill-rate tracking.

**Dependencies:**
- `@nktkas/hyperliquid` (WalletClient, HttpTransport, PublicClient) — npm
- `viem/accounts` (privateKeyToAccount) — npm
- `../shared/logger` — internal
- `../shared/config` — internal
- `../infrastructure/token-bucket` (hyperliquidRateLimiter) — internal
- `../infrastructure/overfill-protection` — internal
- `../infrastructure/snapshot-service` — internal
- `../shared/message-bus` (Channel, messageBus) — internal
- `uuid` — npm

**What can be cut:**
- Message bus publish calls (lines that call `messageBus.publish(Channel.EXECUTION_*`)
- Snapshot service integration
- Some overly verbose logging
- References to `../infrastructure/snapshot-service`

**What must be kept (core):**
- `HyperliquidClient` class with constructor, `initialize()`, `placeOrder()`, `cancelOrder()`, `cancelAllOrders()`, `getAccountState()`, `getOpenOrders()`, `getAllMids()`, `getL2Book()`, `getRecentTrades()`, `placeStopOrder()`, `updateLeverage()`
- All interfaces: `HyperliquidPosition`, `HyperliquidAccountState`, `HyperliquidOrderResult`
- Anti-churn: pending order tracking, cooldowns, dynamic backoff, order deduplication, circuit breaker per-symbol
- Size/price validation and formatting
- Order book depth/spread validation
- Rate limit integration (token bucket)
- Overfill protection registration

**Key signatures:**
```typescript
class HyperliquidClient {
  constructor()
  async initialize(): Promise<void>
  isConfigured(): boolean
  async placeOrder(params: { symbol, side, size, price?, reduceOnly?, bypassCooldown?, orderType?, clientOrderId?, confidence? }): Promise<HyperliquidOrderResult>
  async cancelOrder(symbol: string, orderId: string, trackCancelledWindow?, forceCancel?): Promise<boolean>
  async cancelAllOrders(forceCancel?): Promise<boolean>
  async getAccountState(): Promise<HyperliquidAccountState>
  async getOpenOrders(): Promise<any[]>
  async getAllMids(): Promise<Record<string, number>>
  async getL2Book(symbol: string): Promise<any>
  async getRecentTrades(symbol: string): Promise<any[]>
  async placeStopOrder(params: { symbol, side, size, triggerPrice, tpsl, reduceOnly? }): Promise<HyperliquidOrderResult>
  async updateLeverage(symbol, leverage, isCross?): Promise<boolean>
  isCircuitBreakerActive(): boolean
  hasPendingOrder(symbol, side?): boolean
}
export singleton
```

**Verdict: COPY with surgical edits** — remove message-bus publishes, snapshot-service import, and replace `config.getSection('hyperliquid')` with direct env reads.

---

### 2. `execution-engine.ts` (1771 lines)

**What it does:** Orchestrates order execution from trading signals. Implements signal deduplication, managed exit plans (SL/TP monitoring), native stop-order submission, paper trading mode, position exit enforcement, and order failure categorization. Bridges between the exchange adapter and the paper portfolio.

**Dependencies:**
- `../shared/types` (TradingSignal, Trade, Portfolio, Position, RiskAssessment) — internal
- `../shared/config` — internal
- `../shared/logger` — internal
- `../shared/exchange/adapters/hyperliquid-adapter` (HyperliquidAdapter) — internal
- `./order-validator` — internal
- `../data-manager/data-manager` — **CUT** (only used for trade persistence)
- `../risk-manager/risk-manager` — **CUT** (only used for position tracking)
- `../shared/message-bus` — internal (for price subscriptions)
- `./paper-portfolio` (PaperPortfolioManager) — internal

**What can be cut:**
- `dataManager.saveTrade()` calls — replace with direct DB write
- `riskManager.registerPositionOpen()` / `clearPositionTracking()` calls — simplify or remove
- `circuitBreaker` / `safetyMonitor` dynamic imports — keep safety logic but simplify
- Signal deduplication from LangGraph context (the signal source)

**What must be kept:**
- `ExecutionEngine` class core: `executeSignal()`, `getPortfolio()`, `getPositions()`
- Signal validation and confidence thresholds
- Managed exit plan system (register, enforce, clear)
- Native stop-order tracking (SL/TP via exchange)
- Paper trading path within `executeSignal()`
- Order stats tracking
- Price subscription for SL/TP monitoring
- Failure cooldown logic

**Key signatures:**
```typescript
class ExecutionEngine {
  constructor()
  async executeSignal(signal: TradingSignal, riskAssessment: RiskAssessment): Promise<Trade>
  async getPortfolio(): Promise<Portfolio>
  async getPositions(): Promise<Position[]>
  updatePrice(symbol: string, price: number): void
  async unsubscribeFromMarketPrices(): Promise<void>
}
```

**Verdict: REWRITE** — significant decoupling needed. Keep the class skeleton and core logic, strip data-manager/risk-manager/message-bus dependencies, replace with direct DB + EventEmitter.

---

### 3. `market-ingester.ts` (1803 lines)

**What it does:** WebSocket client for Hyperliquid market data. Connects to HL WS API, subscribes to L2 order book, trades, and funding rate streams. Builds 1-second candles from trade data, batches writes to SQLite (market_data, order_book, market_trades, funding_rates, tracked_symbols, ingestion_traces, symbol_ingestion_health tables). Implements symbol discovery from HL meta, adaptive WS subscription management, backfill polling, coverage monitoring, and enrichment polling.

**Dependencies:**
- `axios` — npm
- `better-sqlite3` — npm
- `../shared/logger`, `../shared/config`, `../shared/message-bus` — internal
- `../shared/data-validation` — internal
- `./hyperliquid-all-markets` — internal
- `./reliability` — internal (buildTrackedSymbols, rankSymbolsForStreaming, etc.)
- `./types` — internal (MarketData, OrderBookSnapshot, FundingRate, Trade)

**What can be cut:**
- `messageBus.publish()` calls — replace with EventEmitter
- `hyperliquid-all-markets` helper — inline the market fetch
- `reliability` module imports — simplify symbol ranking
- `data-validation` import — keep validation logic inline
- Ingestion trace queue/table — optional debugging feature

**What must be kept:**
- `MarketIngester` class: `start()`, `stop()`, `connectWebSocket()`, `updateSymbolsList()`
- SQLite schema and batched writes (market_data, order_book, market_trades, funding_rates, tracked_symbols, symbol_ingestion_health)
- WebSocket connection management (connect, subscribe, reconnect, heartbeat)
- L2 book, trade, and funding rate parsing from WS messages
- Trade candle aggregation (1s → OHLCV)
- Symbol discovery and dynamic subscription management
- Write buffer flushing with transaction batching
- Market data cleanup (retention)

**Key signatures:**
```typescript
class MarketIngester {
  constructor()
  async start(): Promise<void>
  async stop(): Promise<void>
  async updateSymbolsList(): Promise<void>
  getAllTrackedSymbols(): string[]
  startSymbolUpdates(): void
}
export singleton
```

**Verdict: COPY with edits** — remove message-bus publishes, simplify market discovery, keep the core WS + SQLite engine intact.

---

### 4. `main.ts` (947 lines)

**What it does:** Master orchestrator. Starts all child processes (news-agent, prediction-agent, research-engine, safekeeping-fund, funding-arbitrage, pumpfun-agent, news-worker), initializes dashboard server, market ingester, trading loop (LangGraph `runTradingCycle`), circuit breaker, position recovery, trace analysis, dynamic symbol loading, and data readiness checks.

**Dependencies:** Almost everything in the project.

**What can be cut:** Nearly everything — this is the PerpsTrader-specific orchestrator. Child process management, LangGraph integration, research engine, news agents, pumpfun, ingest system, trace analysis, dashboard server.

**What must be kept (conceptually):**
- The `main()` boot sequence pattern (start ingester → start execution engine → start API server)
- Symbol management logic (`filterSymbolsWithSufficientData`, `getSymbolDataReadiness`)
- The trading cycle interval pattern

**Verdict: REWRITE entirely** — this becomes a simple `server.ts` that boots the ingester, execution engine, and API server.

---

### 5. `hyperliquid-adapter.ts` (482 lines)

**What it does:** Implements `IExchangeClient` interface by delegating to `HyperliquidClient` singleton. Maps HL-specific types to exchange-agnostic types. Provides candle fetching via axios directly to HL API, polling-based orderbook/candle subscriptions, market info lookup, and passthrough methods for HL-specific functionality.

**Dependencies:**
- `../types` (IExchangeClient, OrderParams, OrderResult, etc.) — internal
- `../../../execution-engine/hyperliquid-client` — internal
- `../../../shared/logger` — internal
- `axios` — npm

**What can be cut:**
- Nothing significant — this is already a clean abstraction layer.

**What must be kept:**
- The entire `HyperliquidAdapter` class
- All type mapping functions (`mapPosition`, `mapAccountState`, `mapOrderResult`)
- Candle fetching logic
- Polling subscriptions

**Key signatures:**
```typescript
class HyperliquidAdapter implements IExchangeClient {
  async placeOrder(params: OrderParams): Promise<OrderResult>
  async cancelOrder(paramsOrSymbol, orderId?, ...): Promise<void | boolean>
  async getPosition(symbol: string): Promise<Position | null>
  async getPositions(): Promise<Position[]>
  async getCandles(symbol, timeframe, limit?): Promise<Candle[]>
  async getAccountState(): Promise<AccountState>
  subscribeOrderbook(symbol, callback): Subscription
  subscribeCandles(symbol, timeframe, callback): Subscription
  async getMarketInfo(symbol): Promise<MarketInfo>
  async healthCheck(): Promise<boolean>
  // + passthrough methods
}
```

**Verdict: COPY as-is** — clean adapter, minimal changes needed.

---

### 6. `message-bus.ts` (435 lines)

**What it does:** Redis Pub/Sub message bus using `ioredis`. Provides publish/subscribe with local delivery (same-process subscribers get messages directly), request/response RPC pattern, auto-reconnect, and channel enum.

**Dependencies:**
- `ioredis` — npm
- `events` (EventEmitter) — Node built-in
- `./logger` — internal

**What can be cut:** Redis entirely. For agentbank, we don't need cross-process messaging.

**What must be kept (conceptually):**
- The `Channel` enum (for event naming conventions)
- The `Message<T>` interface
- The publish/subscribe pattern

**Verdict: REPLACE with EventEmitter** — create a lightweight `EventBus` class using Node's EventEmitter. No Redis needed. Keep the Channel enum for event names but only the trading-relevant channels:
  - `MARKET_DATA`, `ORDER_BOOK_UPDATE`
  - `EXECUTION_SUBMIT`, `EXECUTION_FILLED`, `EXECUTION_FAILED`, `EXECUTION_CANCELLED`
  - `POSITION_OPENED`, `POSITION_CLOSED`, `POSITION_UPDATED`

---

### 7. `config.ts` (164 lines)

**What it does:** ConfigManager loading from env vars + optional `config/config.json`. Sections: app, hyperliquid, searchApi, glm, database, risk, safety, trading, solana, pumpfun.

**Dependencies:**
- `dotenv/config` — npm
- `fs`, `path` — Node built-in
- `./types` (Config type) — internal

**What can be cut:**
- `searchApi` section
- `glm` section (LLM config — not needed in standalone backend)
- `solana` section
- `pumpfun` section
- Config file loading (just use env vars)

**What must be kept:**
- `hyperliquid` section (privateKey, testnet, baseUrl, mainAddress)
- `database` section (SQLite path)
- `risk` section
- `safety` section
- `trading` section (symbols, timeframes)

**Verdict: REWRITE** — simple env-var-only config with typed getters. Drop config.json support.

---

### 8. `paper-portfolio.ts` (391 lines)

**What it does:** Singleton paper trading portfolio. Simulates positions with $30k starting balance. Tracks cash, positions, realized P&L, trade history, portfolio snapshots. Loads/saves state to DB via `dataManager.getAIInsights()` / `dataManager.saveAIInsight()`.

**Dependencies:**
- `../shared/types` (Trade, Portfolio, Position) — internal
- `../data-manager/data-manager` — **CUT**
- `../shared/logger` — internal

**What can be cut:**
- `dataManager` dependency for state persistence — replace with direct SQLite write

**What must be kept:**
- `PaperPortfolioManager` singleton with `executeTrade()`, `getPortfolio()`, `getPositions()`, `getOpenPositions()`, `getTrades()`, `getRealizedPnL()`, `reset()`
- All position tracking logic (open/close/reduce/increase)
- P&L calculation
- Trade record creation
- Portfolio snapshot system

**Key signatures:**
```typescript
class PaperPortfolioManager {
  static getInstance(): PaperPortfolioManager
  async executeTrade(symbol, side, size, price, strategyId?, leverage?): Promise<Trade>
  getPortfolio(currentPrices: Map<string, number>): Portfolio
  getPositions(): PaperPosition[]
  getAvailableBalance(): number
  getTrades(limit?): Trade[]
  getRealizedPnL(): number
  removePosition(symbol: string): void
  reset(): void
}
```

**Verdict: COPY with edit** — replace `dataManager` calls with direct SQLite persistence.

---

### 9. `batch-processor.ts` (308 lines)

**What it does:** Collects orders over a configurable time window and groups them by symbol+direction to reduce order churn. Provides priority calculation, batch creation, and queue stats.

**Dependencies:**
- `../shared/types` (TradingSignal, RiskAssessment) — internal
- `../shared/logger` — internal

**What can be cut:** Nothing — it's already self-contained.

**What must be kept:** The entire `BatchProcessor` class.

**Key signatures:**
```typescript
class BatchProcessor {
  constructor(config?: Partial<BatchProcessorConfig>)
  onBatchReady(callback): void
  addOrder(signal, riskAssessment): boolean
  async flush(): Promise<BatchedOrder[]>
  getQueueStats(): { pendingCount, bySymbol, oldestOrderAgeMs }
  shouldBatch(signal, riskAssessment): boolean
  setEnabled(enabled): void
  clearQueue(): void
}
```

**Verdict: COPY as-is** — zero changes needed.

---

### 10. `order-validator.ts` (299 lines)

**What it does:** Pre-flight order validation checking market conditions (spread, depth, volatility) by fetching L2 order book data from `HyperliquidClient`. Applies confidence decay based on market conditions. Caches conditions for 5 seconds.

**Dependencies:**
- `../shared/logger` — internal
- `./hyperliquid-client` — internal

**What can be cut:** Nothing — it's self-contained.

**What must be kept:** The entire `OrderValidator` class with `validateMarketConditions()`, `validateConfidence()`, `quickValidate()`, `estimateMarketImpact()`.

**Key signatures:**
```typescript
class OrderValidator {
  async validateMarketConditions(symbol: string): Promise<ValidationResult>
  async validateConfidence(symbol, baseConfidence, size): Promise<ValidationResult>
  quickValidate(symbol, baseConfidence): ValidationResult
  estimateMarketImpact(conditions, size): number
  getCachedConditions(symbol): MarketConditions | undefined
  clearCache(symbol?): void
}
```

**Verdict: COPY as-is** — zero changes needed.

---

### Bonus: `shared/exchange/types.ts` (136 lines)

**What it does:** Exchange-agnostic type definitions. `IExchangeClient` interface, `OrderParams`, `OrderResult`, `Position`, `AccountState`, `Candle`, `MarketInfo`, subscription types.

**Verdict: COPY as-is** — these are the foundation types.

### Bonus: `infrastructure/token-bucket.ts` (282 lines)

**What it does:** Token bucket rate limiter with configurable capacity, refill rate, burst allowance, and exponential backoff with jitter.

**Verdict: COPY as-is** — needed by hyperliquid-client.

### Bonus: `infrastructure/overfill-protection.ts` (404 lines)

**What it does:** Overfill detection and protection. Tracks order states, detects duplicate fills and quantity overfills.

**Verdict: COPY as-is** — needed by hyperliquid-client.

---

## Part 2: Standalone Backend Architecture

### Directory Structure

```
agentbank/
├── app/                          # Next.js 16 frontend (existing)
│   ├── dashboard/page.tsx
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
│
├── backend/                      # NEW: Trading backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   │
│   ├── src/
│   │   ├── server.ts             # NEW: Express/Fastify entry point
│   │   │
│   │   ├── config/
│   │   │   └── index.ts          # REWRITTEN: env-var-only config
│   │   │
│   │   ├── core/
│   │   │   ├── event-bus.ts      # NEW: EventEmitter-based pub/sub (replaces Redis message-bus)
│   │   │   ├── logger.ts         # COPIED: from PerpsTrader shared/logger
│   │   │   └── types.ts          # COPIED: from PerpsTrader shared/types (TradingSignal, Trade, etc.)
│   │   │
│   │   ├── exchange/
│   │   │   ├── types.ts          # COPIED: shared/exchange/types.ts (IExchangeClient, etc.)
│   │   │   ├── hyperliquid-client.ts  # COPIED+EDITED: remove message-bus, snapshot-service
│   │   │   ├── hyperliquid-adapter.ts # COPIED: as-is
│   │   │   └── factory.ts        # COPIED+SIMPLIFIED: no PaperBroker, no trading-mode
│   │   │
│   │   ├── execution/
│   │   │   ├── execution-engine.ts    # REWRITTEN: decoupled from data-manager, risk-manager
│   │   │   ├── paper-portfolio.ts     # COPIED+EDITED: direct SQLite persistence
│   │   │   ├── order-validator.ts     # COPIED: as-is
│   │   │   ├── batch-processor.ts     # COPIED: as-is
│   │   │   └── position-recovery.ts   # COPIED+EDITED: from PerpsTrader
│   │   │
│   │   ├── market/
│   │   │   ├── market-ingester.ts     # COPIED+EDITED: remove message-bus, simplify discovery
│   │   │   └── types.ts               # COPIED: market data types
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── token-bucket.ts        # COPIED: as-is
│   │   │   └── overfill-protection.ts # COPIED: as-is
│   │   │
│   │   ├── db/
│   │   │   ├── database.ts            # NEW: SQLite connection manager
│   │   │   ├── schema.sql             # NEW: table creation SQL
│   │   │   └── migrations/            # NEW: migration files
│   │   │
│   │   └── api/
│   │       ├── routes/
│   │       │   ├── trading.ts         # NEW: order placement, cancellation
│   │       │   ├── portfolio.ts       # NEW: positions, account state, P&L
│   │       │   ├── market.ts          # NEW: market data, candles, orderbook
│   │       │   └── system.ts          # NEW: health, status, config
│   │       ├── middleware/
│   │       │   ├── auth.ts            # NEW: API key auth
│   │       │   └── cors.ts            # NEW: CORS for Next.js frontend
│   │       └── websocket.ts           # NEW: WS server for real-time streaming
│   │
│   └── data/                     # SQLite database files (gitignored)
│       └── trading.db
│
├── package.json                  # Root (Next.js frontend)
└── README.md
```

### Copy vs Rewrite Summary

| Source File | Action | Effort | Notes |
|---|---|---|---|
| `hyperliquid-client.ts` | COPY + edit | Low | Remove 3 imports, ~10 message-bus publish calls |
| `execution-engine.ts` | REWRITE | High | Decouple from data-manager, risk-manager, circuit-breaker |
| `market-ingester.ts` | COPY + edit | Medium | Remove message-bus, simplify market discovery |
| `main.ts` | REWRITE | N/A | Replace with simple `server.ts` boot |
| `hyperliquid-adapter.ts` | COPY as-is | None | Clean adapter |
| `message-bus.ts` | REPLACE | Low | 50-line EventEmitter wrapper |
| `config.ts` | REWRITE | Low | Simplified env-var config |
| `paper-portfolio.ts` | COPY + edit | Low | Replace dataManager with direct SQLite |
| `batch-processor.ts` | COPY as-is | None | Self-contained |
| `order-validator.ts` | COPY as-is | None | Self-contained |
| `exchange/types.ts` | COPY as-is | None | Foundation types |
| `token-bucket.ts` | COPY as-is | None | Self-contained |
| `overfill-protection.ts` | COPY as-is | None | Self-contained |

### Decoupling Strategy

#### From Redis (Message Bus)
- Create `EventBus` class wrapping Node.js `EventEmitter`
- Keep the `Channel` enum (subset: market data, execution, position events)
- All internal communication goes through EventBus
- No external process messaging needed

#### From ChromaDB / Vector Store
- Not used by any of the 10 core files — no action needed

#### From `data-manager`
- Execution engine calls `dataManager.saveTrade()` and `dataManager.getMarketData()` — replace with direct SQLite queries in `db/database.ts`
- Paper portfolio calls `dataManager.getAIInsights()` / `saveAIInsight()` — replace with direct SQLite table `paper_portfolio_state`

#### From `risk-manager`
- Execution engine calls `riskManager.registerPositionOpen()` / `clearPositionTracking()` — these are tracking-only; replace with in-memory map + optional DB log
- Risk assessment is passed in as parameter, not computed here

#### From `circuit-breaker`
- Execution engine dynamically imports `circuit-breaker` for safety checks — keep simplified version inline (max daily loss, max trades per day, volatility stop)

### API Surface for Next.js Frontend

```
REST API (port 3001):

# Trading
POST   /api/trading/order          Place order { symbol, side, size, price?, type, confidence? }
DELETE /api/trading/order/:id       Cancel order
DELETE /api/trading/orders/:symbol  Cancel all orders for symbol
POST   /api/trading/signal          Execute a trading signal (full pipeline)

# Portfolio
GET    /api/portfolio               Get portfolio state { equity, positions, balances, dailyPnL }
GET    /api/portfolio/positions     Get open positions
GET    /api/portfolio/trades        Get recent trades ?limit=50
GET    /api/portfolio/pnl           Get P&L history ?period=24h|7d|30d

# Market Data
GET    /api/market/candles/:symbol  Get OHLCV candles ?timeframe=1m&limit=100
GET    /api/market/orderbook/:symbol Get L2 order book
GET    /api/market/prices           Get all mid prices
GET    /api/market/symbols          Get tracked symbols with metadata
GET    /api/market/funding/:symbol  Get funding rate history

# System
GET    /api/system/health           Health check
GET    /api/system/status           System status (connected, mode, uptime)
GET    /api/system/config           Get non-sensitive config

WebSocket (port 3001):
WS     /ws                          Real-time streaming
  - Subscribe to: price updates, orderbook, trade fills, position changes
  - Messages: { type: "subscribe", channel: "prices" | "orderbook:BTC" | "fills", ... }
```

### Database Schema (SQLite)

```sql
-- Core trading tables
CREATE TABLE IF NOT EXISTS market_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL,
  volume REAL NOT NULL, vwap REAL, bid REAL, ask REAL, bidSize REAL, askSize REAL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_symbol_time ON market_data(symbol, timestamp);

CREATE TABLE IF NOT EXISTS order_book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL, timestamp INTEGER NOT NULL,
  bids TEXT NOT NULL, asks TEXT NOT NULL, midPrice REAL NOT NULL, spread REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS market_trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL, price REAL NOT NULL, size REAL NOT NULL,
  side TEXT NOT NULL, symbol TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS funding_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL, timestamp INTEGER NOT NULL,
  fundingRate REAL NOT NULL, nextFundingTime INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tracked_symbols (
  symbol TEXT PRIMARY KEY, name TEXT, category TEXT,
  volume24h REAL DEFAULT 0, maxLeverage REAL, szDecimals INTEGER,
  onlyIsolated INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1,
  firstSeen INTEGER, lastUpdated INTEGER
);

CREATE TABLE IF NOT EXISTS symbol_ingestion_health (
  symbol TEXT PRIMARY KEY,
  lastMarketDataTs INTEGER DEFAULT 0, lastQuoteTs INTEGER DEFAULT 0,
  lastTradeTs INTEGER DEFAULT 0, dataPoints INTEGER DEFAULT 0,
  updatedAt INTEGER NOT NULL
);

-- Trading execution tables (NEW)
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL, side TEXT NOT NULL, size REAL NOT NULL, price REAL NOT NULL,
  pnl REAL DEFAULT 0, fee REAL DEFAULT 0,
  timestamp TEXT NOT NULL, type TEXT DEFAULT 'MARKET', status TEXT DEFAULT 'FILLED',
  entryExit TEXT, strategyId TEXT, orderId TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  clientOrderId TEXT, symbol TEXT NOT NULL, side TEXT NOT NULL,
  size REAL NOT NULL, price REAL, orderType TEXT DEFAULT 'limit',
  status TEXT DEFAULT 'PENDING', filledPrice REAL, filledSize REAL,
  confidence REAL, reduceOnly INTEGER DEFAULT 0,
  submittedAt TEXT, filledAt TEXT, error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS positions (
  symbol TEXT PRIMARY KEY,
  side TEXT NOT NULL, size REAL NOT NULL, entryPrice REAL NOT NULL,
  markPrice REAL, unrealizedPnL REAL DEFAULT 0,
  leverage INTEGER DEFAULT 10, marginUsed REAL,
  entryTime TEXT NOT NULL, updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paper_portfolio_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  cashBalance REAL NOT NULL,
  realizedPnL REAL DEFAULT 0,
  dailyStartValue REAL NOT NULL,
  positions TEXT NOT NULL DEFAULT '[]',
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL, totalValue REAL NOT NULL,
  realizedPnL REAL, unrealizedPnL REAL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON portfolio_snapshots(timestamp);
```

### npm Dependencies for Backend

```json
{
  "dependencies": {
    "@nktkas/hyperliquid": "^0.x",
    "viem": "^2.x",
    "better-sqlite3": "^11.x",
    "@types/better-sqlite3": "^7.x",
    "express": "^4.x" OR "fastify": "^5.x",
    "ws": "^8.x",
    "uuid": "^10.x",
    "dotenv": "^16.x",
    "cors": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "@types/express": "^5.x",
    "@types/ws": "^8.x",
    "@types/cors": "^2.x"
  }
}
```

### Implementation Phases

**Phase 1: Foundation (Day 1)**
- Set up `backend/` directory with package.json, tsconfig
- Copy infrastructure files (token-bucket, overfill-protection, logger)
- Create config module (env-only)
- Create event-bus (EventEmitter)
- Create database module (schema + migrations)
- Copy exchange types

**Phase 2: Exchange Layer (Day 2)**
- Copy `hyperliquid-client.ts` with message-bus removal
- Copy `hyperliquid-adapter.ts` as-is
- Copy `order-validator.ts` as-is
- Test HL connectivity independently

**Phase 3: Execution (Day 3)**
- Copy `paper-portfolio.ts` with SQLite persistence
- Copy `batch-processor.ts` as-is
- Rewrite `execution-engine.ts` (strip data-manager, risk-manager, circuit-breaker deps)
- Wire to event bus

**Phase 4: Market Data (Day 4)**
- Copy `market-ingester.ts` with message-bus removal
- Set up SQLite tables for market data
- Test WS connectivity and data flow

**Phase 5: API Server (Day 5)**
- Create Express/Fastify server with REST routes
- Create WebSocket server for real-time streaming
- Wire execution engine + market data to API endpoints
- CORS configuration for Next.js frontend

**Phase 6: Frontend Integration (Day 6)**
- Replace mock data in `dashboard/page.tsx` with API calls
- Add SWR/React Query for data fetching
- Wire WebSocket for live updates
- Add order placement UI
