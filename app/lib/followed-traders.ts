/**
 * Wallets the agent mirrors.
 *
 * Picked from the official Hyperliquid leaderboard
 * (https://stats-data.hyperliquid.xyz/Mainnet/leaderboard) — filtered to
 * accounts $0.5M–$50M with >$100K monthly PnL, >5% monthly ROI, and meaningful
 * trading volume (we skip wallets that posted big ROI on tiny volume — likely
 * one-shots or vault deposits).
 *
 * Edit this file to add/remove wallets. Imported by:
 *   - app/copytrade/page.tsx  (live spectator dashboard)
 *   - app/dashboard/page.tsx  (overview)
 *   - app/page.tsx            (landing glimpse)
 */
export const FOLLOWED_TRADERS: readonly string[] = [
  // Original two (high AUM, active perps traders)
  "0x8def9f50456c6c4e37fa5d3d57f108ed23992dae",
  "0x152e41f0b83e6cad4b5dc730c1d6279b7d67c9dc",
  // High-volume scalpers (>$500M monthly volume)
  "0x7fdafde5cfb5465924316eced2d3715494c517d1",
  "0x77375a8c9d13bf79afb2a87f1b0ac1dfd5f5bf66",
  "0x4e23288cee4960f9f962195c22948e4bc7ae20c3",
  // Medium-volume positional traders (40%+ monthly ROI)
  "0xb8ebd6ed57f4102be5b1caf60d01dd1c9f270f94",
  "0xdbcc96bcada067864902aad14e029fe7c422f147",
  // Smaller account, very active (mimic-able size profile)
  "0x632b0a6bb6b6184b97f61a6c773077cab99d1838",
];
