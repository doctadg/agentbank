import path from 'path';

const DEFAULT_HELIUS = 'https://mainnet.helius-rpc.com/?api-key=01ae6b0d-555d-4fa4-a511-295b66fdeb10';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/agentbank.db'),
  databasePath: process.env.DB_PATH || path.join(__dirname, '../../data/agentbank.db'),
  jwtSecret: process.env.JWT_SECRET || 'agentbank-dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  /** Used for both standard JSON-RPC and Helius RPC (Helius URL is a superset). */
  solanaRpcUrl: process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || DEFAULT_HELIUS,
  heliusRpcUrl: process.env.HELIUS_RPC_URL || process.env.SOLANA_RPC_URL || DEFAULT_HELIUS,
  /** When empty, holder snapshots fall back to the seeded mock set. */
  abankMint: process.env.ABANK_MINT || '',
  adminApiKey: process.env.ADMIN_API_KEY || 'abank-admin-dev-key',

  agent: {
    /** Comma-separated list of leader wallets to mirror. */
    followed: (process.env.AGENT_FOLLOWED_WALLETS ||
      '0x8def9f50456c6c4e37fa5d3d57f108ed23992dae,' +
      '0x152e41f0b83e6cad4b5dc730c1d6279b7d67c9dc,' +
      '0x7fdafde5cfb5465924316eced2d3715494c517d1,' +
      '0x77375a8c9d13bf79afb2a87f1b0ac1dfd5f5bf66,' +
      '0x4e23288cee4960f9f962195c22948e4bc7ae20c3,' +
      '0xb8ebd6ed57f4102be5b1caf60d01dd1c9f270f94,' +
      '0xdbcc96bcada067864902aad14e029fe7c422f147,' +
      '0x632b0a6bb6b6184b97f61a6c773077cab99d1838'
    ).split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    /** Notional vault size in USD for paper sizing. */
    startingEquity: parseFloat(process.env.AGENT_START_EQUITY || '100000'),
    /** Mirror at this fraction of leader's account-% allocation (1 = exact mirror). */
    sizingMultiplier: parseFloat(process.env.AGENT_SIZE_MULT || '1'),
    /** Cap any single mirror order at this fraction of vault notional. */
    maxOrderPct: parseFloat(process.env.AGENT_MAX_ORDER_PCT || '0.10'),
    /** Skip orders smaller than this dollar notional (noise floor). */
    minOrderUsd: parseFloat(process.env.AGENT_MIN_ORDER_USD || '25'),
    /** Set to '1' to disable mirroring (read-only mode). */
    paused: process.env.AGENT_PAUSED === '1',
  },
};
