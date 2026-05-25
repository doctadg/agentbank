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
};
