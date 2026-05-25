import { config } from '../config';

/**
 * Helius getTokenAccounts response shape (DAS API):
 * https://docs.helius.dev/das-api/get-token-accounts
 */
interface HeliusTokenAccount {
  address: string;        // token account
  mint: string;
  owner: string;          // wallet
  amount: number;         // raw amount
  delegated_amount: number;
  frozen: boolean;
}

interface HeliusGetTokenAccountsResponse {
  jsonrpc: '2.0';
  id: string;
  result: {
    total: number;
    limit: number;
    cursor?: string;
    token_accounts: HeliusTokenAccount[];
  };
  error?: { code: number; message: string };
}

interface MintInfo {
  decimals: number;
  supply: number;
}

export interface HolderBalance {
  /** Wallet (owner) — base58 */
  owner: string;
  /** UI amount (raw / 10^decimals), rounded to whole tokens */
  balance: number;
}

async function rpcCall<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(config.heliusRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'agentbank', method, params }),
  });
  if (!res.ok) throw new Error(`Helius RPC ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`Helius RPC error: ${json.error.message}`);
  return json.result as T;
}

/** Read mint decimals + supply via standard JSON-RPC getTokenSupply. */
export async function getMintInfo(mint: string): Promise<MintInfo> {
  const r = await rpcCall<{ value: { amount: string; decimals: number } }>('getTokenSupply', [mint]);
  return {
    decimals: r.value.decimals,
    supply: Number(r.value.amount) / 10 ** r.value.decimals,
  };
}

/**
 * Walk every token account for a mint via Helius DAS getTokenAccounts (cursor-paginated),
 * aggregate by owner. Returns the full holder set as ui-amount balances.
 *
 * For a normal SPL token with N holders, this is N/1000 round-trips.
 * Each call is one Helius credit, so safe at any reasonable holder count.
 */
export async function getAllHolders(mint: string): Promise<HolderBalance[]> {
  const mintInfo = await getMintInfo(mint);
  const owners = new Map<string, bigint>(); // owner -> raw amount

  let cursor: string | undefined;
  let safety = 0;
  do {
    const result = await rpcCall<HeliusGetTokenAccountsResponse['result']>('getTokenAccounts', {
      mint,
      limit: 1000,
      cursor,
      displayOptions: { showZeroBalance: false },
    });
    for (const ta of result.token_accounts) {
      if (!ta.amount || ta.amount <= 0) continue;
      const prev = owners.get(ta.owner) ?? 0n;
      owners.set(ta.owner, prev + BigInt(ta.amount));
    }
    cursor = result.cursor;
    safety++;
    if (safety > 200) throw new Error('Helius pagination runaway');
  } while (cursor);

  const divisor = 10 ** mintInfo.decimals;
  return [...owners.entries()]
    .map(([owner, raw]) => ({
      owner,
      // round to whole tokens — the snapshot table stores REAL
      balance: Math.round(Number(raw) / divisor),
    }))
    .filter((h) => h.balance > 0);
}
