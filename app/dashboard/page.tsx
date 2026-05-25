"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";
import { usePortfolio, useTrades, useMarketPrices, useSystemStatus } from "../hooks/useApi";

// ─── Formatting helpers ────────────────────────────────
function fmtUSD(n: number) {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number, sign = true) {
  const s = sign && n >= 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}

function fmtTimeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Counter ───────────────────────────────────────────
function Counter({ target, prefix = "$", suffix = "", decimals = 0 }: {
  target: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - t0) / 1800, 1);
          setVal((1 - Math.pow(1 - p, 3)) * target);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="number-mono">
      {prefix}{val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

// ─── Bar Chart ─────────────────────────────────────────
interface BarData { label: string; value: number }
function BarChart({ data }: { data: BarData[] }) {
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShow(true); obs.disconnect(); }
    }, { threshold: 0.2 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  if (data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-[13px] text-[#999]">No P&L data yet</div>;
  }

  return (
    <div ref={ref} className="flex items-end justify-between gap-2 h-40">
      {data.map((d, i) => {
        const h = (Math.abs(d.value) / max) * 100;
        const green = d.value >= 0;
        return (
          <div key={d.label} className="flex flex-col items-center gap-2 flex-1">
            <div className="w-full relative" style={{ height: "140px" }}>
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t transition-all duration-700 ease-out"
                style={{
                  width: "60%",
                  height: show ? `${h}%` : "0%",
                  backgroundColor: green ? "#171717" : "#ff4444",
                  opacity: green ? 1 : 0.6,
                  transitionDelay: `${i * 100}ms`,
                }}
              />
            </div>
            <span className="text-[11px] text-[#999] font-medium">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Magnetic Button ───────────────────────────────────
function MagBtn({ children, className = "", ...props }: {
  children: React.ReactNode; className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement> & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <motion.a
      ref={ref}
      className={className}
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * 0.15);
        y.set((e.clientY - r.top - r.height / 2) * 0.15);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      whileTap={{ scale: 0.97 }}
      {...(props as any)}
    >
      {children}
    </motion.a>
  );
}

// ─── Status indicator ──────────────────────────────────
function StatusDot({ status }: { status: string }) {
  const color = status === "running" ? "bg-[#00ff88]" : status === "error" ? "bg-red-500" : "bg-yellow-500";
  return <span className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse`} />;
}

// ═════════════════════════════════════════════════════════
// DASHBOARD PAGE
// ═════════════════════════════════════════════════════════
export default function Dashboard() {
  const [tab, setTab] = useState<"positions" | "trades">("positions");
  const { data: portfolio, loading: pLoading, error: pError } = usePortfolio();
  const { trades, loading: tLoading } = useTrades(20);
  const { status } = useSystemStatus();

  // Build chart data from trades — group daily P&L for last 7 days
  const chartData: { label: string; value: number }[] = (() => {
    if (!trades.length) return [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const result: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const dayPnl = trades
        .filter(t => {
          const ts = new Date(t.timestamp).getTime();
          return ts >= dayStart && ts < dayEnd;
        })
        .reduce((sum, t) => sum + (t.pnl || 0), 0);
      result.push({ label: days[d.getDay()], value: dayPnl });
    }
    return result;
  })();

  const isLoading = pLoading && !portfolio;

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171717]">

      {/* ─── NAV ─── */}
      <nav className="sticky top-0 z-50 bg-[#f4f1ea]/80 backdrop-blur-xl"
        style={{ boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.04)" }}>
        <div className="max-w-[1080px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="AgentBank" width={112} height={37} priority />
          </a>
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#999]">
            <a href="/" className="hover:text-[#171717] transition-colors">Home</a>
            <a href="/activity" className="hover:text-[#171717] transition-colors">Activity</a>
            <a href="/dashboard" className="text-[#171717]">Dashboard</a>
            <a href="/stake" className="hover:text-[#171717] transition-colors">Stake</a>
          </div>
          <MagBtn href="#" className="inline-flex items-center gap-2 text-[13px] px-5 py-2 rounded-full bg-[#171717] text-white font-medium hover:bg-black transition-colors">
            <StatusDot status={status?.status || "loading"} />
            {status?.status === "running" ? "Live" : status?.status || "Connecting"}
          </MagBtn>
        </div>
      </nav>

      <div className="max-w-[1080px] mx-auto px-6 py-8">

        {/* ─── Header ─── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] mb-1">Vault Overview</p>
            <h1 className="text-[32px] font-semibold heading-section">Dashboard</h1>
          </div>
          <div className="flex gap-2">
            {["24h", "7d", "30d", "All"].map((label, i) => (
              <button key={label} className={`text-[12px] px-4 py-2 rounded-full font-medium transition-all duration-200 ${
                i === 0
                  ? "bg-[#171717] text-white"
                  : "text-[#999] hover:text-[#171717]"
              }`} style={i !== 0 ? { boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.06)" } : {}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Connection error banner ─── */}
        {pError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[13px] text-red-700">
            Backend connection failed: {pError}. Make sure the backend is running on port 4000.
          </div>
        )}

        {/* ─── Top Stats — dark terminal card ─── */}
        <div className="bg-[#171717] rounded-2xl overflow-hidden card-elevated mb-6">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-[11px] text-white/20 number-mono">agentbank_portfolio.live</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/[0.04]">
            {[
              { label: "Portfolio Value", value: portfolio?.totalValue || 0, prefix: "$", change: portfolio ? fmtPct(portfolio.dailyPnL) : "—" },
              { label: "Today's P&L", value: portfolio?.dailyPnL || 0, prefix: portfolio?.dailyPnL && portfolio.dailyPnL >= 0 ? "+$" : "$", change: portfolio ? fmtPct(portfolio.dailyPnL) : "—" },
              { label: "Open Positions", value: portfolio?.positionCount || 0, prefix: "", change: `${portfolio?.positions?.filter(p => p.side === "long").length || 0}L / ${portfolio?.positions?.filter(p => p.side === "short").length || 0}S` },
              { label: "Unrealized P&L", value: portfolio?.unrealizedPnL || 0, prefix: portfolio?.unrealizedPnL && portfolio.unrealizedPnL >= 0 ? "+$" : "$", change: "Open positions" },
            ].map((s) => {
              const green = s.value >= 0;
              return (
                <div key={s.label} className="px-6 py-7 hover:bg-white/[0.02] transition-colors duration-300">
                  <p className="text-[10px] text-white/25 uppercase tracking-[0.15em] font-medium mb-3">{s.label}</p>
                  <p className="text-[28px] sm:text-[32px] font-bold number-mono tracking-tight text-white" style={{ lineHeight: 1.1 }}>
                    {isLoading ? (
                      <span className="text-white/20">—</span>
                    ) : (
                      <Counter target={Math.abs(s.value)} prefix={s.prefix} />
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d={green ? "M6 10V2M6 2L2 6M6 2L10 6" : "M6 2V10M6 10L2 6M6 10L10 6"} stroke={green ? "#00ff88" : "#ff4444"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className={`text-[12px] number-mono font-medium ${green ? "text-[#00ff88]" : "text-[#ff4444]"}`}>{s.change}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Main Grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* Chart */}
          <div className="lg:col-span-2 bg-white/70 rounded-xl p-6 shadow-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[14px] font-semibold">Daily P&L</h3>
              <span className="text-[12px] text-[#999] font-medium">Last 7 Days</span>
            </div>
            <BarChart data={chartData} />
          </div>

          {/* Vault Info */}
          <div className="bg-white/70 rounded-xl p-6 shadow-border">
            <div className="flex items-center gap-2 mb-6">
              <StatusDot status={status?.status || "loading"} />
              <h3 className="text-[14px] font-semibold">Vault Info</h3>
            </div>
            <div className="space-y-0">
              {[
                { label: "Environment", value: status?.environment || "—" },
                { label: "Available Balance", value: portfolio ? fmtUSD(portfolio.availableBalance) : "—" },
                { label: "Used Margin", value: portfolio ? fmtUSD(portfolio.usedBalance) : "—" },
                { label: "Unrealized P&L", value: portfolio ? fmtUSD(portfolio.unrealizedPnL) : "—", green: (portfolio?.unrealizedPnL || 0) >= 0 },
                { label: "Uptime", value: status ? `${Math.floor(status.uptime / 60)}m ${status.uptime % 60}s` : "—" },
                { label: "Version", value: status?.version || "—" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-3"
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <span className="text-[12px] text-[#999]">{item.label}</span>
                  <span className={`text-[13px] font-semibold number-mono ${item.green === false ? "text-[#ff4444]" : item.green ? "text-[#00cc6a]" : "text-[#171717]"}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Tabs: Positions / Trades ─── */}
        <div className="bg-white/70 rounded-2xl overflow-hidden shadow-border">
          {/* Tab bar */}
          <div className="flex" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
            <button
              onClick={() => setTab("positions")}
              className={`px-6 py-3.5 text-[13px] font-medium transition-colors ${
                tab === "positions" ? "text-[#171717] border-b-2 border-[#171717]" : "text-[#999] hover:text-[#171717]"
              }`}
            >
              Open Positions ({portfolio?.positionCount || 0})
            </button>
            <button
              onClick={() => setTab("trades")}
              className={`px-6 py-3.5 text-[13px] font-medium transition-colors ${
                tab === "trades" ? "text-[#171717] border-b-2 border-[#171717]" : "text-[#999] hover:text-[#171717]"
              }`}
            >
              Recent Trades
            </button>
          </div>

          {tab === "positions" ? (
            portfolio?.positions && portfolio.positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[#999] text-[11px] uppercase tracking-wider">
                      <th className="text-left px-6 py-3 font-medium">Pair</th>
                      <th className="text-left px-6 py-3 font-medium">Side</th>
                      <th className="text-right px-6 py-3 font-medium">Size</th>
                      <th className="text-right px-6 py-3 font-medium">Leverage</th>
                      <th className="text-right px-6 py-3 font-medium">P&L</th>
                      <th className="text-right px-6 py-3 font-medium">Entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map((p, i) => {
                      const green = p.unrealizedPnL >= 0;
                      return (
                        <tr key={i} className="hover:bg-[#f4f1ea]/50 transition-colors"
                          style={{ borderTop: "1px solid rgba(0,0,0,0.03)" }}>
                          <td className="px-6 py-4 font-semibold">{p.symbol}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                              p.side === "long" || p.side === "Long"
                                ? "bg-[#00ff88]/10 text-[#00aa55]"
                                : "bg-[#ff4444]/10 text-[#ff4444]"
                            }`}>
                              {p.side}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right number-mono text-[#4d4d4d]">{fmtUSD(p.size)}</td>
                          <td className="px-6 py-4 text-right number-mono text-[#999]">{p.leverage}x</td>
                          <td className={`px-6 py-4 text-right number-mono font-medium ${green ? "text-[#00aa55]" : "text-[#ff4444]"}`}>
                            {green ? "+" : ""}{fmtUSD(p.unrealizedPnL)}
                          </td>
                          <td className="px-6 py-4 text-right number-mono text-[#999]">{fmtUSD(p.entryPrice)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-[13px] text-[#999]">
                <p className="mb-1">No open positions</p>
                <p className="text-[11px] text-[#bbb]">Paper trading active — waiting for signals</p>
              </div>
            )
          ) : trades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[#999] text-[11px] uppercase tracking-wider">
                    <th className="text-left px-6 py-3 font-medium">Time</th>
                    <th className="text-left px-6 py-3 font-medium">Pair</th>
                    <th className="text-left px-6 py-3 font-medium">Side</th>
                    <th className="text-right px-6 py-3 font-medium">Price</th>
                    <th className="text-right px-6 py-3 font-medium">Size</th>
                    <th className="text-right px-6 py-3 font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 20).map((t, i) => {
                    const green = (t.pnl || 0) >= 0;
                    return (
                      <tr key={i} className="hover:bg-[#f4f1ea]/50 transition-colors"
                        style={{ borderTop: "1px solid rgba(0,0,0,0.03)" }}>
                        <td className="px-6 py-4 text-[#999]">{fmtTimeAgo(t.timestamp)}</td>
                        <td className="px-6 py-4 font-semibold">{t.symbol}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                            t.side === "buy" || t.side === "Buy"
                              ? "bg-[#00ff88]/10 text-[#00aa55]"
                              : "bg-[#ff4444]/10 text-[#ff4444]"
                          }`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right number-mono text-[#4d4d4d]">{fmtUSD(t.price)}</td>
                        <td className="px-6 py-4 text-right number-mono text-[#4d4d4d]">{fmtUSD(t.size)}</td>
                        <td className={`px-6 py-4 text-right number-mono font-medium ${green ? "text-[#00aa55]" : "text-[#ff4444]"}`}>
                          {green ? "+" : ""}{fmtUSD(t.pnl || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-[13px] text-[#999]">
              <p>No trades yet</p>
            </div>
          )}
        </div>

        {/* ─── Footer spacer ─── */}
        <div className="h-16" />
      </div>
    </div>
  );
}
