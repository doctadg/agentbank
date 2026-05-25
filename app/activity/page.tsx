"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import {
  useAgentActivity,
  useAgentActivityStats,
  type AgentEvent,
  type AgentEventType,
} from "../hooks/useApi";

// ─── Helpers ───────────────────────────────────────────
function fmtUSD(n: number, withSign = false) {
  const abs = Math.abs(n);
  const sign = withSign ? (n >= 0 ? "+" : "−") : n < 0 ? "−" : "";
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtTimeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmtAbsoluteTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Magnetic button ───────────────────────────────────
function MagBtn({ children, className = "", href = "#", ...props }: {
  children: React.ReactNode; className?: string; href?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
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

// ─── Live ticker text (re-renders timestamps) ──────────
function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

// ─── Type theme ────────────────────────────────────────
type TypeTheme = { label: string; bg: string; fg: string; ring: string; iconBg: string };

const TYPE_THEMES: Record<AgentEventType, TypeTheme> = {
  trade_open:   { label: "Open",         bg: "bg-[#00ff88]/10",  fg: "text-[#0a8a4d]", ring: "ring-[#00ff88]/30",  iconBg: "bg-[#0a8a4d]" },
  trade_close:  { label: "Close",        bg: "bg-[#171717]/[0.06]", fg: "text-[#171717]", ring: "ring-black/15",      iconBg: "bg-[#171717]" },
  signal:       { label: "Signal",       bg: "bg-[#f5a623]/10",  fg: "text-[#a06b00]", ring: "ring-[#f5a623]/30",  iconBg: "bg-[#a06b00]" },
  reasoning:    { label: "Reasoning",    bg: "bg-[#6c5ce7]/10",  fg: "text-[#5644c0]", ring: "ring-[#6c5ce7]/30",  iconBg: "bg-[#5644c0]" },
  distribution: { label: "Distribution", bg: "bg-[#00cc6a]/12",  fg: "text-[#067a3c]", ring: "ring-[#00cc6a]/30",  iconBg: "bg-[#067a3c]" },
  snapshot:     { label: "Snapshot",     bg: "bg-[#0aa3ff]/10",  fg: "text-[#0066b3]", ring: "ring-[#0aa3ff]/30",  iconBg: "bg-[#0066b3]" },
  system:       { label: "System",       bg: "bg-[#999]/12",     fg: "text-[#555]",    ring: "ring-black/10",      iconBg: "bg-[#555]" },
};

// ─── Icons ─────────────────────────────────────────────
const Stroke = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

function EventIcon({ type, side }: { type: AgentEventType; side: AgentEvent["side"] }) {
  switch (type) {
    case "trade_open":
      return side === "short"
        ? <Stroke d="M5 7l7 7 7-7M5 17h14" />
        : <Stroke d="M5 17l7-7 7 7M5 7h14" />;
    case "trade_close":
      return <Stroke d="M5 5l14 14M19 5L5 19" />;
    case "signal":
      return <Stroke d="M21 21l-6-6M11 17a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />;
    case "reasoning":
      return <Stroke d="M9 21h6M12 17v4M12 3a6 6 0 0 1 4 10.5V15a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1.5A6 6 0 0 1 12 3z" />;
    case "distribution":
      return <Stroke d="M3 11h18v10H3zM12 21V8M3 8h18v3H3zM12 8s-2-5-5-5a2 2 0 0 0 0 4h5zM12 8s2-5 5-5a2 2 0 0 1 0 4h-5z" />;
    case "snapshot":
      return <Stroke d="M3 7h3l2-3h8l2 3h3v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />;
    case "system":
      return <Stroke d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />;
  }
}

// ─── Filter chips ──────────────────────────────────────
type FilterKey = "all" | "trades" | "signal" | "reasoning" | "distribution" | "snapshot" | "system";

const FILTERS: { key: FilterKey; label: string; types: AgentEventType[] }[] = [
  { key: "all",          label: "All",           types: [] },
  { key: "trades",       label: "Trades",        types: ["trade_open", "trade_close"] },
  { key: "signal",       label: "Signals",       types: ["signal"] },
  { key: "reasoning",    label: "Reasoning",     types: ["reasoning"] },
  { key: "distribution", label: "Distributions", types: ["distribution"] },
  { key: "snapshot",     label: "Snapshots",     types: ["snapshot"] },
  { key: "system",       label: "System",        types: ["system"] },
];

// ─── Event card ────────────────────────────────────────
function EventCard({ event, isLatest }: { event: AgentEvent; isLatest: boolean }) {
  const theme = TYPE_THEMES[event.type];
  const pnlGreen = (event.pnl ?? 0) >= 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="relative flex gap-5 group"
    >
      {/* Rail + icon */}
      <div className="relative shrink-0 flex flex-col items-center">
        <div className={`relative z-10 w-11 h-11 rounded-full ${theme.iconBg} text-white flex items-center justify-center ring-4 ring-[#f4f1ea] shadow-[0_4px_12px_rgba(0,0,0,0.08)]`}>
          <EventIcon type={event.type} side={event.side} />
          {isLatest && (
            <span className="absolute -inset-1 rounded-full ring-2 ring-[#00ff88]/40 animate-ping" />
          )}
        </div>
        <div className="flex-1 w-px bg-gradient-to-b from-black/[0.06] via-black/[0.04] to-transparent mt-1 mb-2 min-h-[24px]" />
      </div>

      {/* Card */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="flex-1 mb-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-black/[0.05] p-5 hover:border-[#00ff88]/30 hover:bg-white/85 transition-all duration-300"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 4px 16px rgba(0,0,0,0.02)" }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10.5px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full ${theme.bg} ${theme.fg}`}>
              {theme.label}
            </span>
            {event.symbol && (
              <span className="text-[11px] font-semibold number-mono text-[#171717] tracking-tight">
                {event.symbol}
              </span>
            )}
            {event.side && (
              <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded ${
                event.side === "long" ? "text-[#0a8a4d] bg-[#00ff88]/10" : "text-[#c0392b] bg-[#ff4444]/10"
              }`}>
                {event.side}
              </span>
            )}
          </div>
          <span className="number-mono text-[11px] text-[#999] shrink-0 tracking-tight" title={new Date(event.created_at).toLocaleString()}>
            {fmtTimeAgo(event.created_at)}
          </span>
        </div>

        <p className="text-[14.5px] font-medium text-[#171717] tracking-[-0.01em] leading-snug">
          {event.message}
        </p>

        {(event.pnl !== null || event.price !== null || event.size !== null) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[12px]">
            {event.pnl !== null && (
              <span className={`number-mono font-semibold ${pnlGreen ? "text-[#0a8a4d]" : "text-[#c0392b]"}`}>
                {fmtUSD(event.pnl, true)}
              </span>
            )}
            {event.price !== null && (
              <span className="text-[#999]">
                Price <span className="number-mono text-[#4d4d4d] font-medium">${event.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              </span>
            )}
            {event.size !== null && (
              <span className="text-[#999]">
                Size <span className="number-mono text-[#4d4d4d] font-medium">{fmtUSD(event.size)}</span>
              </span>
            )}
          </div>
        )}

        {event.detail && (
          <p className="text-[12.5px] text-[#666] leading-[1.6] mt-3 pt-3 border-t border-black/[0.05]">
            {event.detail}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Stats strip ───────────────────────────────────────
function StatsStrip({ stats }: { stats: ReturnType<typeof useAgentActivityStats>["stats"] }) {
  const items = [
    { label: "Events (24h)", value: stats?.last24h ?? "—" },
    { label: "Trades opened", value: stats?.byType?.trade_open ?? 0 },
    { label: "Trades closed", value: stats?.byType?.trade_close ?? 0 },
    { label: "Signals", value: stats?.byType?.signal ?? 0 },
  ];
  return (
    <div className="rounded-2xl overflow-hidden bg-[#171717] text-white"
      style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/[0.06]">
        {items.map((it) => (
          <div key={it.label} className="px-6 py-6">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-2.5">{it.label}</p>
            <p className="number-mono text-[24px] font-semibold tracking-tight">{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────
export default function ActivityPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const activeFilter = FILTERS.find((f) => f.key === filter)!;
  const { events, loading, error } = useAgentActivity(activeFilter.types, 80, 5000);
  const { stats } = useAgentActivityStats(10000);

  // Tick every second to refresh "Xs ago" labels
  useTick(1000);

  // Track latest event id for the ping
  const latestId = events[0]?.id;
  const counts = useMemo(() => {
    const c: Partial<Record<FilterKey, number>> = {};
    for (const f of FILTERS) {
      if (f.key === "all") continue;
      c[f.key] = f.types.reduce((acc, t) => acc + (stats?.byType?.[t] ?? 0), 0);
    }
    return c;
  }, [stats]);

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171717]">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-[#f4f1ea]/75 backdrop-blur-xl" style={{ boxShadow: "0px 1px 0px rgba(0,0,0,0.04)" }}>
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center opacity-90 hover:opacity-100 transition-opacity">
            <Image src="/logo.png" alt="AgentBank" width={140} height={46} priority />
          </a>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#888]">
            <a href="/" className="hover:text-[#171717] transition-colors">Home</a>
            <a href="/activity" className="text-[#171717]">Activity</a>
            <a href="/dashboard" className="hover:text-[#171717] transition-colors">Dashboard</a>
          </div>
          <MagBtn href="/dashboard" className="btn-primary inline-flex items-center gap-2 text-[12.5px] px-4 py-1.5">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-[#00ff88] animate-ping opacity-60" />
              <span className="relative rounded-full w-1.5 h-1.5 bg-[#00ff88]" />
            </span>
            Launch App
          </MagBtn>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-16 pb-10 px-6">
        <div className="max-w-[860px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div>
              <p className="eyebrow mb-3">Agent</p>
              <h1 className="text-[36px] sm:text-[48px] font-semibold heading-display">Activity</h1>
              <p className="text-[15.5px] text-[#888] mt-3 max-w-[520px] leading-[1.55]">
                A live feed of every move the agent makes — open, close, signal, reasoning, and distribution events as they happen.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start md:self-end">
              <span className="relative flex w-2 h-2">
                <span className="absolute inset-0 rounded-full bg-[#00ff88] animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-[#00ff88]" />
              </span>
              <span className="text-[12px] font-medium text-[#666] uppercase tracking-[0.12em]">Live · auto-refresh 5s</span>
            </div>
          </div>

          <StatsStrip stats={stats} />
        </div>
      </section>

      {/* Filters */}
      <section className="px-6 sticky top-14 z-40 bg-[#f4f1ea]/85 backdrop-blur-md py-3 border-y border-black/[0.04]">
        <div className="max-w-[860px] mx-auto flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = f.key === "all" ? stats?.last24h : counts[f.key];
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all duration-200 ${
                  active
                    ? "bg-[#171717] text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                    : "text-[#666] hover:text-[#171717] hover:bg-black/[0.04]"
                }`}
              >
                {f.label}
                {count !== undefined && count !== null && (
                  <span className={`number-mono text-[10.5px] tracking-tight ${active ? "text-white/55" : "text-[#aaa]"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Feed */}
      <section className="px-6 py-10">
        <div className="max-w-[860px] mx-auto">
          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">
              Backend connection failed: {error}
            </div>
          )}

          {loading && events.length === 0 ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-5 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-black/[0.05] shrink-0" />
                  <div className="flex-1 rounded-2xl bg-black/[0.03] h-24" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-14 h-14 rounded-full bg-black/[0.04] flex items-center justify-center mb-4 text-[#999]">
                <Stroke d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={22} />
              </div>
              <p className="text-[15px] font-medium mb-1">No activity yet</p>
              <p className="text-[13px] text-[#999]">The agent will start posting here as soon as it makes a move.</p>
            </div>
          ) : (
            <div>
              <AnimatePresence initial={false}>
                {events.map((ev) => (
                  <EventCard key={ev.id} event={ev} isLatest={ev.id === latestId} />
                ))}
              </AnimatePresence>
              <div className="text-center pt-4">
                <p className="text-[11.5px] text-[#aaa] number-mono tracking-tight">— end of feed · {events.length} events —</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
