// Reward distribution transactions on Solana.
// Add new tx signatures here as distributions go out — the /rewards page reads this list.

export const REWARD_SIGNATURES: string[] = [
  "4teGnk5JsMgo3HakbhMQiB1ohb4e5RJBvzb12qPcUYci2mhfeDvngYcQcubHPCGZywtJEqeaJ5KGE5snStRdN8wB",
  "26AWzGEvVRR1fYQTezLzuspYU9HZ1oaD1p1v97uCauXP4BLm97f4mUDriC4CQim98njheqvLZx379J4Nr3LbHM48",
  "2EPY8uaAkysdLzdPw1K2jazBQmkV8CLvcmziPbrRc4DrszYiihmRuBt8AaEPKrnSBeb4YDavERjJSE9uxuWoSMX6",
  "gka6upLwHbk1VzTZypV8RpXGYkNiGQ5Q1RWZjWpqBEthJKDmJrhb6HZeQyjTZqkQPYX9ptRL6C8QzcVdoNrK5qS",
  "2LJzHKgb2GiHeEUWgB1DrWSModRgihtZaFx5jeprkQbpVSNRxSPmRjcJi9bTZj2k7X7HGy9wva3oajVDBQ4LQtBs",
];

// Helius Enhanced Transactions response shape (the subset we use).
export interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard?: string;
}

export interface HeliusParsedTx {
  signature: string;
  timestamp: number; // unix seconds
  slot: number;
  fee: number;
  feePayer: string;
  type: string;
  source: string;
  description: string;
  tokenTransfers: HeliusTokenTransfer[];
  transactionError: unknown;
}

export interface RewardDistribution {
  signature: string;
  timestamp: number;
  treasury: string;        // fromUserAccount common to all transfers
  mint: string;            // primary mint (the one with most transfers)
  totalAmount: number;     // sum of tokenAmount across recipient transfers
  recipientCount: number;
  transfers: HeliusTokenTransfer[];
  error: string | null;
}

const HELIUS_BASE = "https://api.helius.xyz/v0/transactions";

/**
 * Fetch parsed transactions from Helius. Cached aggressively because these are
 * immutable historical transactions — once mined they never change.
 */
export async function fetchRewardDistributions(): Promise<RewardDistribution[]> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    return REWARD_SIGNATURES.map((sig) => ({
      signature: sig,
      timestamp: 0,
      treasury: "",
      mint: "",
      totalAmount: 0,
      recipientCount: 0,
      transfers: [],
      error: "HELIUS_API_KEY not configured",
    }));
  }

  const res = await fetch(`${HELIUS_BASE}?api-key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions: REWARD_SIGNATURES }),
    // 24h cache — finalized Solana txs never change, but allow occasional refresh
    // in case the user adds new sigs to the list.
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Helius ${res.status}: ${text}`);
  }

  const parsed = (await res.json()) as HeliusParsedTx[];
  const bySig = new Map(parsed.map((p) => [p.signature, p]));

  return REWARD_SIGNATURES.map((sig) => {
    const tx = bySig.get(sig);
    if (!tx) {
      return {
        signature: sig,
        timestamp: 0, treasury: "", mint: "", totalAmount: 0,
        recipientCount: 0, transfers: [], error: "Transaction not found",
      };
    }

    const transfers = tx.tokenTransfers ?? [];

    // Pick the dominant mint (the one with the most transfers — the reward token)
    const mintCounts = new Map<string, number>();
    for (const t of transfers) mintCounts.set(t.mint, (mintCounts.get(t.mint) ?? 0) + 1);
    let mint = "";
    let topCount = 0;
    for (const [m, c] of mintCounts) if (c > topCount) { mint = m; topCount = c; }

    const rewardTransfers = transfers.filter((t) => t.mint === mint);
    const total = rewardTransfers.reduce((s, t) => s + t.tokenAmount, 0);

    // Treasury = the most-common sender (in case multiple senders, take majority)
    const senderCounts = new Map<string, number>();
    for (const t of rewardTransfers) senderCounts.set(t.fromUserAccount, (senderCounts.get(t.fromUserAccount) ?? 0) + 1);
    let treasury = "";
    let topSender = 0;
    for (const [s, c] of senderCounts) if (c > topSender) { treasury = s; topSender = c; }

    return {
      signature: sig,
      timestamp: tx.timestamp,
      treasury,
      mint,
      totalAmount: total,
      recipientCount: rewardTransfers.length,
      transfers: rewardTransfers,
      error: null,
    };
  });
}
