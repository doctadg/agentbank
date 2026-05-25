/**
 * AgentBank Configuration
 *
 * Environment-variable-only configuration. No hardcoded secrets.
 */

import path from 'path';

export const config = {
  // Hyperliquid
  hyperliquidPrivateKey: process.env.HYPERLIQUID_PRIVATE_KEY || '',
  hyperliquidTestnet: process.env.HYPERLIQUID_TESTNET !== 'false',
  hyperliquidBaseUrl: process.env.HYPERLIQUID_TESTNET !== 'false'
    ? 'https://api.hyperliquid-testnet.xyz'
    : 'https://api.hyperliquid.xyz',

  // Server
  port: parseInt(process.env.PORT || '4000', 10),

  // Database
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/agentbank.db'),
  databasePath: process.env.DB_PATH || path.join(__dirname, '../../data/agentbank.db'),

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'agentbank-dev-secret-change-me',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Solana
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  abankMint: process.env.ABANK_MINT || '',
  vaultWallet: process.env.VAULT_WALLET || '',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Paper Trading
  paperTrading: process.env.PAPER_TRADING === 'true' || !process.env.HYPERLIQUID_PRIVATE_KEY,

  // Market data
  marketDataIntervalMs: parseInt(process.env.MARKET_DATA_INTERVAL_MS || '5000', 10),

  // Derived
  get isConfigured(): boolean {
    return !!this.hyperliquidPrivateKey;
  },
} as const;

export type Config = typeof config;
