import path from 'path';
export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/agentbank.db'),
  databasePath: process.env.DB_PATH || path.join(__dirname, '../../data/agentbank.db'),
  jwtSecret: process.env.JWT_SECRET || 'agentbank-dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  abankMint: process.env.ABANK_MINT || '',
  adminApiKey: process.env.ADMIN_API_KEY || 'abank-admin-dev-key',
};
