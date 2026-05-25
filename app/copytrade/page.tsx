"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import {
  useCopytrade,
  truncateAddress,
  hyperliquidExplorer,
  isLong,
  parseFillSide,
  type HLFill,
  type HLPosition,
  type TraderStats,
} from "../hooks/useHyperliquid";

// ─── The traders we follow ─────────────────────────────
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

function fmtNum(n: number, decimals = 4) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

function fmtTimeAgo(ms: number) {
  const diff = Date.now() - ms;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${Math.max(0, secs)}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function useTick(ms = 1000) { const [, set] = useState(0); useEffect(() => { const iv = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(iv); }, [ms]); }

// ─── Magnetic button ───────────────────────────────────
function MagBtn({ children, className = "", href = "#", ...props }: { children: React.ReactNode; className?: string; href?: string; } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const x = useMotionValue(0); const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <motion.a ref={ref} href={href} className={className} style={{ x: sx, y: sy }}
      onMouseMove={(e) => { if (!ref.current) return; const r = ref.current.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * 0.15); y.set((e.clientY - r.top - r.height / 2) * 0.15); }}
      onMouseLeave={() => { x.set(0); y.set(0); }} whileTap={{ scale: 0.97 }} {...(props as any)}>
      {children}
    </motion.a>
  );
}

// ─── Tape number with subtle flash on change ───────────
function Tape({ value, prefix = "", suffix = "", decimals = 0, className = "" }: { value: number; prefix?: string; suffix?: string; decimals?: number; className?: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (prev.current !== value && isFinite(value) && isFinite(prev.current)) {
      const dir = value > prev.current ? "up" : value < prev.current ? "down" : null;
      if (dir) {
        setFlash(dir);
        const t = setTimeout(() => setFlash(null), 700);
        return () => clearTimeout(t);
      }
    }
    prev.current = value;
  }, [value]);

  const safe = isFinite(value) ? value : 0;
  const flashCls = flash === "up" ? "text-[#00ff88]" : flash === "down" ? "text-[#ff5566]" : "";
  return (
    <span className={`number-mono transition-colors duration-300 ${flashCls} ${className}`}>
      {prefix}{Math.abs(safe).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

// ─── Live dot ──────────────────────────────────────────
function LivePulse({ color = "#00ff88", size = 8 }: { color?: string; size?: number }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: color }} />
      <span className="relative rounded-full" style={{ width: size, height: size, background: color }} />
    </span>
  );
}

// ─── Trader card ───────────────────────────────────────
function TraderCard({ stats, idx, loading }: { stats: TraderStats; idx: number; loading: boolean }) {
  const profitable = stats.pnl24h >= 0;
  const last = stats.lastFill;
  const lastSide = last ? parseFillSide(last) : null;
  useTick(1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl overflow-hidden bg-[#171717] text-white"
      style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      {/* glow */}
      <motion.div
        className="absolute -top-32 -right-32 w-[300px] h-[300px] rounded-full blur-2xl"
        style={{ background: profitable ? "radial-gradient(circle, rgba(0,255,136,0.18), transparent 70%)" : "radial-gradient(circle, rgba(255,68,68,0.15), transparent 70%)" }}
        animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-[12px] font-semibold number-mono text-white/70 ring-1 ring-white/[0.08]">
              T{idx + 1}
            </span>
            <a
              href={hyperliquidExplorer(stats.address)}
              target="_blank" rel="noreferrer"
              className="group inline-flex items-center gap-1.5 text-[13px] font-medium number-mono text-white/80 hover:text-white transition-colors"
              title={stats.address}
            >
              {truncateAddress(stats.address)}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 group-hover:opacity-100 transition-opacity"><path d="M7 17L17 7M7 7h10v10" /></svg>
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <LivePulse color="#00ff88" size={6} />
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-medium">Live</span>
          </div>
        </div>

        {/* Account Value */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-2">Account Value</p>
          <Tape value={stats.accountValue} prefix="$" decimals={0} className="text-[36px] font-semibold tracking-tight text-white leading-none" />
        </div>

        {/* PnL 24h */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-1.5">24h PnL</p>
            <p className={`number-mono text-[15px] font-semibold ${profitable ? "text-[#00ff88]" : "text-[#ff5566]"}`}>
              {profitable ? "+" : "−"}{fmtUSD(Math.abs(stats.pnl24h), false, 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-1.5">Win Rate</p>
            <p className="number-mono text-[15px] font-semibold text-white">{(stats.winRate * 100).toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-1.5">Open</p>
            <p className="number-mono text-[15px] font-semibold text-white">{stats.positions.length}</p>
          </div>
        </div>

        {/* Last action */}
        <div className="pt-4 border-t border-white/[0.07]">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-2">Last Action</p>
          {last ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded ${
                  lastSide === "long" || lastSide === "buy" ? "text-[#00ff88] bg-[#00ff88]/10" : "text-[#ff5566] bg-[#ff5566]/10"
                }`}>{last.dir}</span>
                <span className="text-[13px] font-medium number-mono text-white">{last.coin}</span>
                <span className="text-[12px] text-white/50 number-mono">@ ${fmtNum(parseFloat(last.px), 4)}</span>
              </div>
              <span className="text-[11px] text-white/40 number-mono shrink-0">{fmtTimeAgo(last.time)} ago</span>
            </div>
          ) : (
            <p className="text-[12px] text-white/35">{loading ? "Loading…" : "No recent fills"}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stats strip (top) ─────────────────────────────────
function HeroStrip({ totals }: { totals: ReturnType<typeof useCopytrade>["totals"] }) {
  const profitable = totals.pnl24h >= 0;
  return (
    <div className="rounded-2xl overflow-hidden bg-[#171717] text-white relative"
      style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
      <motion.div
        className="absolute -top-24 left-1/3 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
        style={{ background: profitable ? "radial-gradient(circle, rgba(0,255,136,0.08), transparent 70%)" : "radial-gradient(circle, rgba(255,68,68,0.08), transparent 70%)" }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.85, 0.6] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="flex items-center justify-between gap-2 px-6 py-3 border-b border-white/[0.07] relative">
        <a href="https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket" target="_blank" rel="noreferrer" className="text-[10.5px] uppercase tracking-[0.14em] text-white/40 font-medium hover:text-white/60 transition-colors">
          wss://api.hyperliquid.xyz/ws
        </a>
        <span className="flex items-center gap-1.5">
          <LivePulse color="#00ff88" size={6} />
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-medium">Streaming</span>
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/[0.05] relative">
        <div className="px-6 py-7">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-3">Combined AUM</p>
          <Tape value={totals.accountValue} prefix="$" decimals={0} className="text-[28px] font-semibold tracking-tight text-white leading-none" />
        </div>
        <div className="px-6 py-7">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-3">24h Realized PnL</p>
          <p className={`number-mono text-[28px] font-semibold tracking-tight leading-none ${profitable ? "text-[#00ff88]" : "text-[#ff5566]"}`}>
            {profitable ? "+" : "−"}{fmtUSD(Math.abs(totals.pnl24h), false, 0)}
          </p>
          <p className="text-[11px] text-white/35 mt-2 number-mono">7d <span className={totals.pnl7d >= 0 ? "text-[#00ff88]/80" : "text-[#ff5566]/80"}>{totals.pnl7d >= 0 ? "+" : "−"}{fmtUSD(Math.abs(totals.pnl7d), false, 0)}</span></p>
        </div>
        <div className="px-6 py-7">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-3">Open Notional</p>
          <Tape value={totals.totalNtlPos} prefix="$" decimals={0} className="text-[28px] font-semibold tracking-tight text-white leading-none" />
          <p className="text-[11px] text-white/35 mt-2 number-mono">{totals.openPositions} positions</p>
        </div>
        <div className="px-6 py-7">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-3">24h Volume</p>
          <Tape value={totals.volume24h} prefix="$" decimals={0} className="text-[28px] font-semibold tracking-tight text-white leading-none" />
          <p className="text-[11px] text-white/35 mt-2 number-mono">{totals.fills24h} fills</p>
        </div>
      </div>
    </div>
  );
}

// ─── Position row ──────────────────────────────────────
function PositionRow({ p, trader }: { p: HLPosition; trader: string }) {
  const long = isLong(p);
  const pnl = parseFloat(p.unrealizedPnl);
  const roe = parseFloat(p.returnOnEquity);
  const profitable = pnl >= 0;
  return (
    <motion.tr
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      className="hover:bg-[#f4f1ea]/50 transition-colors group" style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[13.5px] tracking-tight">{p.coin}</span>
          <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded ${
            long ? "text-[#0a8a4d] bg-[#00ff88]/10" : "text-[#c0392b] bg-[#ff4444]/10"
          }`}>{long ? "long" : "short"}</span>
        </div>
      </td>
      <td className="px-5 py-3.5 text-right number-mono text-[13px] text-[#4d4d4d]">{fmtUSD(parseFloat(p.positionValue))}</td>
      <td className="px-5 py-3.5 text-right number-mono text-[12.5px] text-[#999]">{fmtNum(parseFloat(p.entryPx), 4)}</td>
      <td className="px-5 py-3.5 text-right number-mono text-[12.5px] text-[#999]">{p.leverage.value}x</td>
      <td className="px-5 py-3.5 text-right">
        <div className={`number-mono text-[13px] font-semibold ${profitable ? "text-[#0a8a4d]" : "text-[#c0392b]"}`}>
          {profitable ? "+" : "−"}{fmtUSD(Math.abs(pnl))}
        </div>
        <div className={`number-mono text-[10.5px] ${profitable ? "text-[#0a8a4d]/70" : "text-[#c0392b]/70"}`}>
          {profitable ? "+" : ""}{(roe * 100).toFixed(1)}%
        </div>
      </td>
      <td className="px-5 py-3.5 text-right hidden md:table-cell">
        <a href={hyperliquidExplorer(trader)} target="_blank" rel="noreferrer" className="number-mono text-[11px] text-[#999] hover:text-[#171717] transition-colors">
          {truncateAddress(trader, 4, 4)}
        </a>
      </td>
    </motion.tr>
  );
}

// ─── Fill row in feed ──────────────────────────────────
function FillCard({ fill, trader, isNew }: { fill: HLFill; trader: string; isNew: boolean }) {
  const side = parseFillSide(fill);
  const isClose = fill.dir.startsWith("Close");
  const pnl = parseFloat(fill.closedPnl);
  const hasPnl = isClose && pnl !== 0;
  const profitable = pnl >= 0;
  const sideColor = side === "long" || side === "buy" ? "#0a8a4d" : "#c0392b";

  useTick(1000);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="relative flex gap-4 group"
    >
      <div className="relative shrink-0 flex flex-col items-center">
        <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center ring-4 ring-[#f4f1ea]" style={{ background: sideColor, color: "white" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={side === "long" || side === "buy" ? "M5 17l7-7 7 7M5 7h14" : "M5 7l7 7 7-7M5 17h14"} />
          </svg>
          {isNew && <span className="absolute -inset-1 rounded-full ring-2 animate-ping" style={{ borderColor: sideColor }} />}
        </div>
        <div className="flex-1 w-px bg-gradient-to-b from-black/[0.06] via-black/[0.04] to-transparent mt-1 mb-2 min-h-[16px]" />
      </div>
      <div className="flex-1 mb-3 rounded-xl bg-white/55 border border-black/[0.05] px-4 py-3 hover:border-[#00ff88]/30 hover:bg-white/85 transition-all duration-300"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded" style={{ color: sideColor, background: `${sideColor}1A` }}>
              {fill.dir}
            </span>
            <span className="text-[13px] font-semibold tracking-tight">{fill.coin}</span>
            <span className="text-[12px] text-[#999] number-mono">{fmtNum(parseFloat(fill.sz), 4)} @ ${fmtNum(parseFloat(fill.px), 4)}</span>
          </div>
          <span className="number-mono text-[11px] text-[#999] shrink-0">{fmtTimeAgo(fill.time)} ago</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <a href={hyperliquidExplorer(trader)} target="_blank" rel="noreferrer" className="number-mono text-[10.5px] text-[#bbb] hover:text-[#666] transition-colors">
            {truncateAddress(trader, 6, 4)}
          </a>
          {hasPnl && (
            <span className={`number-mono text-[12px] font-semibold ${profitable ? "text-[#0a8a4d]" : "text-[#c0392b]"}`}>
              {profitable ? "+" : "−"}{fmtUSD(Math.abs(pnl))}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────
export default function CopyTradePage() {
  const { stats, totals, combinedFills, combinedPositions, loading, error } = useCopytrade(FOLLOWED, 10000);
  const latestFillTid = combinedFills[0]?.fill.tid;

  // tab state for bottom panel
  const [tab, setTab] = useState<"fills" | "positions">("fills");

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171717]">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-[#f4f1ea]/75 backdrop-blur-xl" style={{ boxShadow: "0px 1px 0px rgba(0,0,0,0.04)" }}>
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center opacity-90 hover:opacity-100 transition-opacity">
            <Image src="/logo.png" alt="AgentBank" width={140} height={46} priority />
          </a>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#888]">
            <a href="/" className="hover:text-[#171717] transition-colors">Home</a>
            <a href="/copytrade" className="text-[#171717]">Copytrade</a>
            <a href="/dashboard" className="hover:text-[#171717] transition-colors">Dashboard</a>
          </div>
          <MagBtn href="/dashboard" className="btn-primary inline-flex items-center gap-2 text-[12.5px] px-4 py-1.5">
            <LivePulse size={6} />
            Launch App
          </MagBtn>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-14 pb-8 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div>
              <p className="eyebrow mb-3">Agentic Copytrading</p>
              <h1 className="text-[36px] sm:text-[48px] font-semibold heading-display">Following the best on Hyperliquid</h1>
              <p className="text-[15.5px] text-[#888] mt-3 max-w-[640px] leading-[1.55]">
                The agent identifies and mirrors the most profitable wallets on Hyperliquid. Every fill, every position, every dollar — streamed live.
              </p>
            </div>
          </div>

          <HeroStrip totals={totals} />

          {error && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">
              Hyperliquid API: {error}
            </div>
          )}
        </div>
      </section>

      {/* Trader cards */}
      <section className="px-6 pb-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <p className="eyebrow">Following</p>
            <span className="number-mono text-[11px] text-[#bbb]">· {stats.length} wallets</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.map((s, i) => (
              <TraderCard key={s.address} stats={s} idx={i} loading={loading} />
            ))}
          </div>
        </div>
      </section>

      {/* Tabs: fills feed + positions */}
      <section className="px-6 pb-20">
        <div className="max-w-[1200px] mx-auto">
          <div className="rounded-2xl bg-white/55 border border-black/[0.05]" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.03)" }}>
            <div className="flex items-center justify-between px-5 pt-4">
              <div className="flex gap-1">
                {[
                  { k: "fills" as const, label: "Live Fills", count: combinedFills.length },
                  { k: "positions" as const, label: "Open Positions", count: combinedPositions.length },
                ].map((t) => (
                  <button key={t.k} onClick={() => setTab(t.k)}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all ${
                      tab === t.k ? "bg-[#171717] text-white" : "text-[#666] hover:text-[#171717] hover:bg-black/[0.04]"
                    }`}>
                    {t.label}
                    <span className={`number-mono text-[10.5px] ${tab === t.k ? "text-white/55" : "text-[#aaa]"}`}>{t.count}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <LivePulse size={5} />
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#888] font-medium">Streaming</span>
              </div>
            </div>

            {tab === "fills" ? (
              <div className="p-5 pt-4">
                {loading && combinedFills.length === 0 ? (
                  <div className="space-y-3">
                    {[0,1,2,3,4].map((i) => (
                      <div key={i} className="flex gap-4 animate-pulse">
                        <div className="w-9 h-9 rounded-full bg-black/[0.05] shrink-0" />
                        <div className="flex-1 rounded-xl bg-black/[0.03] h-16" />
                      </div>
                    ))}
                  </div>
                ) : combinedFills.length === 0 ? (
                  <div className="py-16 text-center text-[13px] text-[#999]">No recent fills.</div>
                ) : (
                  <AnimatePresence initial={false}>
                    {combinedFills.slice(0, 30).map((row) => (
                      <FillCard key={`${row.fill.tid}-${row.trader}`} fill={row.fill} trader={row.trader} isNew={row.fill.tid === latestFillTid} />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[#999] text-[10.5px] uppercase tracking-[0.1em]">
                      <th className="text-left px-5 py-3 font-medium">Asset</th>
                      <th className="text-right px-5 py-3 font-medium">Notional</th>
                      <th className="text-right px-5 py-3 font-medium">Entry</th>
                      <th className="text-right px-5 py-3 font-medium">Lev</th>
                      <th className="text-right px-5 py-3 font-medium">PnL / ROE</th>
                      <th className="text-right px-5 py-3 font-medium hidden md:table-cell">Trader</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedPositions.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-[13px] text-[#999]">No open positions.</td></tr>
                    ) : combinedPositions.map((row, i) => (
                      <PositionRow key={`${row.trader}-${row.pos.coin}-${i}`} p={row.pos} trader={row.trader} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
