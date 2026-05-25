"use client";

import Image from "next/image";
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  useCopytrade,
  truncateAddress,
  hyperliquidExplorer,
  type TraderStats,
} from "../hooks/useHyperliquid";
import { useVaultStats, useDistributions, useLeaderboard } from "../hooks/useApi";

const FOLLOWED = [
  "0x8def9f50456c6c4e37fa5d3d57f108ed23992dae",
  "0x152e41f0b83e6cad4b5dc730c1d6279b7d67c9dc",
];

// ─── Helpers ───────────────────────────────────────────
function fmtUSD(n: number, withSign = false, decimals = 0) {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = withSign ? (n >= 0 ? "+" : "−") : n < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(abs >= 1e4 ? 1 : 2)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtCompactNum(n: number) {
  if (!isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 1 : 2)}K`;
  return n.toLocaleString();
}

function fmtRelative(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmtDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Live pulse dot ────────────────────────────────────
function LivePulse({ color = "#00ff88", size = 6 }: { color?: string; size?: number }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: color }} />
      <span className="relative rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}

// ─── Trader summary card ───────────────────────────────
function TraderSummary({ stats }: { stats: TraderStats }) {
  const profitable = stats.pnl24h >= 0;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
      <div className="flex items-center justify-between mb-4">
        <a
          href={hyperliquidExplorer(stats.address)}
          target="_blank" rel="noreferrer"
          className="text-[12.5px] font-medium number-mono text-white/80 hover:text-white transition-colors"
        >
          {truncateAddress(stats.address)}
        </a>
        <LivePulse />
      </div>
      <div className="space-y-2.5">
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-white/40 uppercase tracking-[0.1em]">Account</span>
          <span className="number-mono text-[14px] font-semibold text-white">{fmtUSD(stats.accountValue)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-white/40 uppercase tracking-[0.1em]">24h PnL</span>
          <span className={`number-mono text-[14px] font-semibold ${profitable ? "text-[#00ff88]" : "text-[#ff5566]"}`}>
            {profitable ? "+" : "−"}{fmtUSD(Math.abs(stats.pnl24h))}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-[11px] text-white/40 uppercase tracking-[0.1em]">Open</span>
          <span className="number-mono text-[14px] font-semibold text-white">{stats.positions.length}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────
export default function Dashboard() {
  const { stats: traderStats, totals } = useCopytrade(FOLLOWED);
  const { stats: vault, error: vaultError } = useVaultStats();
  const { distributions } = useDistributions();
  const { leaderboard } = useLeaderboard();

  const profitable = totals.pnl24h >= 0;

  // 7d distribution sum
  const last7dDistributions = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400_000;
    return distributions
      .filter((d) => new Date(d.created_at).getTime() >= cutoff)
      .reduce((s, d) => s + d.total_amount, 0);
  }, [distributions]);

  const totalSupply = vault?.totalSupply ?? 1_000_000_000;

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171717]">
      {/* ─── NAV ─── */}
      <nav className="sticky top-0 z-50 bg-[#f4f1ea]/80 backdrop-blur-xl"
        style={{ boxShadow: "0px 1px 0px rgba(0,0,0,0.04)" }}>
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="AgentBank" width={112} height={37} priority />
          </a>
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#999]">
            <a href="/" className="hover:text-[#171717] transition-colors">Home</a>
            <a href="/copytrade" className="hover:text-[#171717] transition-colors">Live</a>
            <a href="/dashboard" className="text-[#171717]">Dashboard</a>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#888] uppercase tracking-[0.12em]">
            <LivePulse />
            <span>{vaultError ? "Offline" : "Live"}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-[1200px] mx-auto px-6 py-10">
        {/* ─── Header ─── */}
        <div className="mb-8">
          <p className="eyebrow mb-3">Overview</p>
          <h1 className="text-[36px] sm:text-[44px] font-semibold heading-display">Dashboard</h1>
          <p className="text-[15px] text-[#888] mt-3 max-w-[560px] leading-[1.55]">
            Aggregate performance of the wallets we mirror, vault state, and the distribution ledger.
          </p>
        </div>

        {vaultError && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-800">
            Vault backend unreachable: {vaultError}. Showing live trader stats only.
          </div>
        )}

        {/* ─── Hero strip — dark ─── */}
        <div className="rounded-2xl overflow-hidden bg-[#171717] text-white relative mb-6"
          style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
          <motion.div
            className="absolute -top-24 left-1/3 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
            style={{ background: profitable ? "radial-gradient(circle, rgba(0,255,136,0.08), transparent 70%)" : "radial-gradient(circle, rgba(255,68,68,0.08), transparent 70%)" }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.85, 0.6] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/[0.05] relative">
            <Stat label="Combined AUM" value={fmtUSD(totals.accountValue)} />
            <Stat
              label="24h Realized PnL"
              value={`${profitable ? "+" : "−"}${fmtUSD(Math.abs(totals.pnl24h))}`}
              valueClass={profitable ? "text-[#00ff88]" : "text-[#ff5566]"}
              hint={`7d ${totals.pnl7d >= 0 ? "+" : "−"}${fmtUSD(Math.abs(totals.pnl7d))}`}
            />
            <Stat
              label="Total Distributed"
              value={vault ? fmtUSD(vault.totalDistributed) : "—"}
              hint={vault ? `7d ${fmtUSD(last7dDistributions)}` : undefined}
            />
            <Stat
              label="Holders"
              value={vault ? vault.totalHolders.toLocaleString() : "—"}
              hint={vault?.lastSnapshotAt ? `Snapshot ${fmtRelative(vault.lastSnapshotAt)}` : undefined}
            />
          </div>
        </div>

        {/* ─── Main grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left col: distributions + leaderboard */}
          <div className="lg:col-span-2 space-y-6">
            {/* Distribution history */}
            <Panel title="Distribution history" subtitle={`${distributions.length} ${distributions.length === 1 ? "distribution" : "distributions"}`}>
              {distributions.length === 0 ? (
                <EmptyRow text="No distributions yet." />
              ) : (
                <div className="divide-y divide-black/[0.05]">
                  {distributions.map((d) => (
                    <div key={d.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium tracking-[-0.01em]">{d.notes || "Distribution"}</p>
                        <p className="text-[12px] text-[#888] number-mono mt-0.5">
                          {fmtDate(d.created_at)} · {d.holder_count} holders
                        </p>
                      </div>
                      <span className="number-mono text-[14px] font-semibold text-[#00cc6a] shrink-0">
                        {fmtUSD(d.total_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Leaderboard */}
            <Panel title="Holder leaderboard" subtitle={`Top ${Math.min(leaderboard.length, 10)} by balance`}>
              {leaderboard.length === 0 ? (
                <EmptyRow text="No holders snapshotted yet." />
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-[#999] text-[10.5px] uppercase tracking-[0.1em]">
                        <th className="text-left px-1 py-2.5 font-medium w-10">#</th>
                        <th className="text-left px-1 py-2.5 font-medium">Wallet</th>
                        <th className="text-right px-1 py-2.5 font-medium">Balance</th>
                        <th className="text-right px-1 py-2.5 font-medium">% Supply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.slice(0, 10).map((h) => {
                        const pct = totalSupply > 0 ? (h.balance / totalSupply) * 100 : 0;
                        return (
                          <tr key={h.publicKey} className="border-t border-black/[0.04] hover:bg-black/[0.02] transition-colors">
                            <td className="px-1 py-3 number-mono text-[#999]">{h.rank}</td>
                            <td className="px-1 py-3 number-mono text-[12.5px]">{truncateAddress(h.publicKey, 5, 4)}</td>
                            <td className="px-1 py-3 number-mono text-right font-medium">{fmtCompactNum(h.balance)}</td>
                            <td className="px-1 py-3 number-mono text-right text-[#888]">{pct.toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>

          {/* Right col: vault info + followed traders */}
          <div className="space-y-6">
            <Panel title="Vault state">
              <dl className="space-y-3.5">
                <Row label="Total supply" value={`${fmtCompactNum(totalSupply)} $ABANK`} />
                <Row label="Holders" value={vault?.totalHolders?.toLocaleString() ?? "—"} />
                <Row label="Total distributed" value={vault ? fmtUSD(vault.totalDistributed) : "—"} />
                <Row label="Last snapshot" value={fmtRelative(vault?.lastSnapshotAt ?? null)} />
                <Row label="Last distribution" value={fmtRelative(vault?.lastDistributionAt ?? null)} />
              </dl>
            </Panel>

            {/* Dark panel: followed traders */}
            <div className="rounded-2xl bg-[#171717] text-white p-5"
              style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/50 font-medium">Mirroring</p>
                <a href="/copytrade" className="text-[11px] text-white/60 hover:text-white transition-colors inline-flex items-center gap-1">
                  Live page
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </a>
              </div>
              <div className="space-y-3">
                {traderStats.map((t) => <TraderSummary key={t.address} stats={t} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small subcomponents ───────────────────────────────
function Stat({ label, value, hint, valueClass = "text-white" }: { label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <div className="px-6 py-7">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-3">{label}</p>
      <p className={`number-mono text-[26px] font-semibold tracking-tight leading-none ${valueClass}`}>{value}</p>
      {hint && <p className="text-[11px] text-white/35 mt-2 number-mono">{hint}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/55 border border-black/[0.05] p-5"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 4px 16px rgba(0,0,0,0.02)" }}>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {subtitle && <span className="text-[11px] text-[#999] number-mono">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <dt className="text-[12px] text-[#888]">{label}</dt>
      <dd className="text-[13px] font-medium number-mono">{value}</dd>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="py-8 text-center text-[12.5px] text-[#999]">{text}</div>;
}
