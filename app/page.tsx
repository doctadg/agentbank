"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Lenis from "lenis";
import { useCopytrade, truncateAddress, parseFillSide } from "./hooks/useHyperliquid";

const FOLLOWED_TRADERS = [
  "0x8def9f50456c6c4e37fa5d3d57f108ed23992dae",
  "0x152e41f0b83e6cad4b5dc730c1d6279b7d67c9dc",
];

const Icon = ({ d, size = 22, fill = "none" }: { d: string; size?: number; fill?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  wallet: "M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2H5a2 2 0 0 0 0 4h15v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 12.5h2",
  shield: "M12 21s7-3.5 7-9V5l-7-2-7 2v7c0 5.5 7 9 7 9z",
  cpu: "M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M6 6h12v12H6zM10 10h4v4h-4z",
  trending: "M3 17l6-6 4 4 8-8M14 7h7v7",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M15 9.5C15 8.12 13.66 7 12 7s-3 1.12-3 2.5S10.34 12 12 12s3 1.12 3 2.5S13.66 17 12 17s-3-1.12-3-2.5",
  snapshot: "M3 7h3l2-3h8l2 3h3v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  gift: "M3 11h18v10H3zM12 21V8M3 8h18v3H3zM12 8s-2-5-5-5a2 2 0 0 0 0 4h5zM12 8s2-5 5-5a2 2 0 0 1 0 4h-5z",
};

type Step = { num: string; title: string; desc: string; icon: string };

const STEPS: Step[] = [
  { num: "01", title: "Acquire $ABANK", desc: "Available on pump.fun and Solana DEXs.", icon: ICONS.wallet },
  { num: "02", title: "Hold in your wallet", desc: "No staking contract, no lock-up, no transfers required.", icon: ICONS.shield },
  { num: "03", title: "Agent trades on Hyperliquid", desc: "An automated strategy mirrors a curated set of top-performing wallets.", icon: ICONS.cpu },
  { num: "04", title: "Profits distributed", desc: "Trading profits flow to holders, weighted by balance and holding duration.", icon: ICONS.trending },
];

const EARN_STEPS = [
  { title: "Hold $ABANK in a Solana wallet", desc: "Compatible with Phantom, Solflare, and Backpack.", icon: ICONS.coin },
  { title: "On-chain balance snapshots", desc: "Holdings are read directly from the chain on a recurring schedule.", icon: ICONS.snapshot },
  { title: "Weighted distribution", desc: "Reward = (holding days × average balance) ÷ total weight × distribution.", icon: ICONS.gift },
];

const ease = [0.16, 1, 0.3, 1];

function Fade({ children, className = "", delay = 0, direction = "up" }: {
  children: React.ReactNode; className?: string; delay?: number; direction?: "up" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const offset = { up: { y: 20 }, left: { x: -24 }, right: { x: 24 } }[direction];

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.05, rootMargin: "-20px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [mounted]);

  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={mounted ? { opacity: 0, ...offset } : { opacity: 1, x: 0, y: 0 }}
        animate={visible ? { opacity: 1, x: 0, y: 0 } : mounted ? { opacity: 0, ...offset } : { opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.5, ease: ease as any, delay }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function FollowingGlimpse() {
  const { stats, totals, combinedFills, loading } = useCopytrade(FOLLOWED_TRADERS, 8000);
  const profitable = totals.pnl24h >= 0;

  return (
    <section id="following" className="relative py-24 px-6 bg-[#171717] text-white overflow-hidden">
      <div className="absolute inset-0 opacity-[0.035]"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      <div className="relative max-w-[1080px] mx-auto">
        <div className="md:flex md:items-end md:justify-between gap-8 mb-10">
          <div>
            <Fade>
              <p className="eyebrow mb-4 text-white/45">
                <span className="inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                  Live · Currently mirroring
                </span>
              </p>
            </Fade>
            <Fade delay={0.1}>
              <h2 className="text-[32px] sm:text-[44px] font-semibold heading-section text-white mb-3 tracking-[-0.02em]">
                Two top-performing Hyperliquid wallets.
              </h2>
            </Fade>
            <Fade delay={0.15}>
              <p className="text-[15px] text-white/55 leading-[1.6] max-w-[520px]">
                The agent observes fills and position changes, then mirrors qualifying trades.
              </p>
            </Fade>
          </div>

          <Fade delay={0.2}>
            <div className="mt-6 md:mt-0 inline-flex items-center gap-4 rounded-xl px-5 py-4 bg-white/[0.03] border border-white/[0.07]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-1">Combined 24h PnL</p>
                <p className={`number-mono text-[22px] font-semibold tracking-tight ${profitable ? "text-[#00ff88]" : "text-[#ff5566]"}`}>
                  {totals.pnl24h === 0 && loading ? "…" : `${profitable ? "+" : "−"}$${Math.abs(totals.pnl24h).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                </p>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-1">AUM</p>
                <p className="number-mono text-[22px] font-semibold tracking-tight text-white">
                  ${totals.accountValue >= 1e6 ? `${(totals.accountValue / 1e6).toFixed(1)}M` : Math.round(totals.accountValue).toLocaleString()}
                </p>
              </div>
            </div>
          </Fade>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {stats.map((s, i) => {
            const profit = s.pnl24h >= 0;
            const last = s.lastFill;
            const side = last ? parseFillSide(last) : null;
            return (
              <Fade key={s.address} delay={0.1 + i * 0.06}>
                <a
                  href="/copytrade"
                  className="block group relative rounded-xl bg-white/[0.025] border border-white/[0.06] p-6 hover:border-white/[0.14] hover:bg-white/[0.035] transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[11px] font-semibold number-mono text-white/70">
                        T{i + 1}
                      </span>
                      <span className="number-mono text-[12.5px] font-medium text-white/80">{truncateAddress(s.address)}</span>
                    </div>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
                      <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-medium">Live</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-1.5">Account</p>
                      <p className="number-mono text-[15px] font-semibold text-white">
                        {s.accountValue >= 1e6 ? `$${(s.accountValue / 1e6).toFixed(1)}M` : s.accountValue >= 1e3 ? `$${Math.round(s.accountValue / 1e3)}K` : `$${s.accountValue.toFixed(0)}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-1.5">24h PnL</p>
                      <p className={`number-mono text-[15px] font-semibold ${profit ? "text-[#00ff88]" : "text-[#ff5566]"}`}>
                        {s.pnl24h === 0 && loading ? "…" : `${profit ? "+" : "−"}$${Math.abs(s.pnl24h) >= 1e3 ? `${(Math.abs(s.pnl24h) / 1e3).toFixed(1)}K` : Math.abs(s.pnl24h).toFixed(0)}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35 font-medium mb-1.5">Open</p>
                      <p className="number-mono text-[15px] font-semibold text-white">{s.positions.length}</p>
                    </div>
                  </div>

                  {last && (
                    <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded ${
                          side === "long" || side === "buy" ? "text-[#00ff88] bg-[#00ff88]/10" : "text-[#ff5566] bg-[#ff5566]/10"
                        }`}>{last.dir}</span>
                        <span className="text-[12.5px] font-medium number-mono text-white/90">{last.coin}</span>
                      </div>
                      <span className="number-mono text-[10.5px] text-white/40 shrink-0">
                        {Math.max(0, Math.floor((Date.now() - last.time) / 1000))}s ago
                      </span>
                    </div>
                  )}
                </a>
              </Fade>
            );
          })}
        </div>

        <Fade delay={0.3}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[12px] text-white/40">
              {combinedFills.length > 0 ? <>{combinedFills.length} fills in the last 48h</> : loading ? "Connecting to Hyperliquid…" : "Awaiting next fill"}
            </p>
            <a href="/copytrade" className="inline-flex items-center gap-2 text-[13px] font-medium text-white/80 hover:text-white transition-colors group">
              View live feed
              <span className="transition-transform group-hover:translate-x-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </span>
            </a>
          </div>
        </Fade>
      </div>
    </section>
  );
}

export default function Home() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
    const id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); lenis.destroy(); };
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171717]">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#f4f1ea]/80 backdrop-blur-xl border-b border-black/[0.05]">
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center opacity-90 hover:opacity-100 transition-opacity">
            <Image src="/logo.png" alt="AgentBank" width={140} height={46} priority />
          </a>
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#888]">
            <a href="#how" className="hover:text-[#171717] transition-colors">How it works</a>
            <a href="#following" className="hover:text-[#171717] transition-colors">Following</a>
            <a href="#earn" className="hover:text-[#171717] transition-colors">Distribution</a>
            <a href="#fees" className="hover:text-[#171717] transition-colors">Fees</a>
            <a href="/copytrade" className="hover:text-[#171717] transition-colors">Live</a>
            <a href="/dashboard" className="hover:text-[#171717] transition-colors">Dashboard</a>
          </div>
          <a href="/dashboard" className="btn-primary inline-flex items-center text-[12.5px] px-4 py-1.5">
            Launch app
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-40 pb-28 px-6">
        <div className="relative max-w-[820px] mx-auto text-center">
          <Fade delay={0.05}>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-8 border border-black/[0.08] bg-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
              <span className="text-[11.5px] font-medium text-[#666] tracking-[0.02em]">Live on Hyperliquid</span>
            </div>
          </Fade>
          <Fade delay={0.1}>
            <h1 className="text-[42px] sm:text-[60px] md:text-[72px] font-medium heading-display text-[#171717] mb-7 tracking-[-0.025em] leading-[1.05]">
              Automated trading,<br />distributed to holders.
            </h1>
          </Fade>
          <Fade delay={0.2}>
            <p className="text-[17px] leading-[1.55] text-[#666] max-w-[540px] mx-auto mb-10">
              An on-chain trading agent mirrors a curated set of top Hyperliquid wallets. Profits are distributed to $ABANK holders, weighted by balance and duration.
            </p>
          </Fade>
          <Fade delay={0.3}>
            <div className="flex gap-2.5 justify-center">
              <a href="/dashboard" className="btn-primary inline-flex items-center gap-2">
                Open dashboard
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
              <a href="#how" className="btn-secondary">How it works</a>
            </div>
          </Fade>
        </div>
      </section>

      <FollowingGlimpse />

      {/* HOW IT WORKS */}
      <section id="how" className="py-28 px-6">
        <div className="max-w-[1080px] mx-auto">
          <Fade><p className="eyebrow mb-4 text-[#999]">Overview</p></Fade>
          <Fade delay={0.05}><h2 className="text-[34px] sm:text-[44px] font-semibold heading-section mb-4 tracking-[-0.02em]">How it works</h2></Fade>
          <Fade delay={0.1}><p className="text-[15.5px] text-[#888] mb-14 max-w-[460px] leading-[1.55]">From acquiring the token to receiving your share of trading profits.</p></Fade>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STEPS.map((s, i) => (
              <Fade key={s.num} delay={i * 0.06}>
                <div className="relative h-full rounded-xl p-7 bg-white/60 border border-black/[0.06] hover:border-black/[0.12] transition-colors duration-300">
                  <span className="absolute top-6 right-6 number-mono text-[10.5px] font-semibold text-[#bbb] tracking-[0.08em]">{s.num}</span>
                  <div className="w-11 h-11 rounded-lg bg-[#171717] flex items-center justify-center text-white mb-5">
                    <Icon d={s.icon} size={20} />
                  </div>
                  <h3 className="text-[18px] font-semibold mb-1.5 tracking-[-0.015em]">{s.title}</h3>
                  <p className="text-[14px] text-[#666] leading-[1.55]">{s.desc}</p>
                </div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* EARN — dark section */}
      <section id="earn" className="relative py-28 px-6 bg-[#171717] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        <div className="relative max-w-[1080px] mx-auto">
          <div className="md:flex md:items-start md:gap-20">
            <div className="md:w-[36%] mb-12 md:mb-0 md:sticky md:top-28">
              <Fade><p className="eyebrow mb-4 text-white/45">Distribution</p></Fade>
              <Fade delay={0.05}>
                <h2 className="text-[34px] sm:text-[44px] font-semibold text-white heading-section mb-5 tracking-[-0.02em]">
                  How distributions work.
                </h2>
              </Fade>
              <Fade delay={0.1}>
                <p className="text-[15px] text-white/55 leading-[1.6]">
                  Holdings are read from the chain on a fixed schedule. Trading profits are distributed proportionally to balance and holding duration, with no claim step required.
                </p>
              </Fade>
            </div>
            <div className="md:flex-1">
              <div className="space-y-2.5">
                {EARN_STEPS.map((item, i) => (
                  <Fade key={item.title} delay={0.05 + i * 0.06}>
                    <div className="relative rounded-xl p-6 bg-white/[0.025] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.035] transition-colors duration-300 flex items-start gap-5">
                      <span className="absolute top-6 right-6 number-mono text-[10.5px] font-semibold text-white/25 tracking-[0.08em]">0{i + 1}</span>
                      <div className="w-11 h-11 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 text-white/80 border border-white/[0.08]">
                        <Icon d={item.icon} size={19} />
                      </div>
                      <div className="flex-1 pr-8">
                        <p className="text-[15.5px] font-medium text-white/95 mb-1 tracking-[-0.01em]">{item.title}</p>
                        <p className="text-[13px] text-white/50 leading-[1.6]">{item.desc}</p>
                      </div>
                    </div>
                  </Fade>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TOKENOMICS */}
      <section className="py-28 px-6">
        <div className="max-w-[1080px] mx-auto">
          <div className="mb-14 max-w-[480px]">
            <Fade><p className="eyebrow mb-4 text-[#999]">Token</p></Fade>
            <Fade delay={0.05}><h2 className="text-[34px] sm:text-[44px] font-semibold heading-section mb-4 tracking-[-0.02em]">$ABANK</h2></Fade>
            <Fade delay={0.1}><p className="text-[15.5px] text-[#888] leading-[1.55]">Fixed supply of 1,000,000,000 on Solana.</p></Fade>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <Fade delay={0.15}>
              <div className="rounded-xl bg-[#171717] p-10 text-white relative overflow-hidden">
                <p className="text-[72px] font-semibold number-mono text-white mb-2 tracking-[-0.03em]" style={{ lineHeight: 1 }}>100<span className="text-[36px] text-white/50 ml-1">%</span></p>
                <p className="text-[16px] font-medium mb-4 text-white/90">Trading profits to holders</p>
                <p className="text-white/45 text-[13.5px] leading-[1.6] mb-8">
                  Profits from the trading agent are distributed proportionally across all $ABANK holders. Share scales with balance and duration.
                </p>
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.07]">
                  <div><p className="text-[10px] text-white/35 uppercase tracking-[0.14em] mb-1.5 font-medium">Token</p><p className="number-mono font-semibold text-[13.5px]">$ABANK</p></div>
                  <div><p className="text-[10px] text-white/35 uppercase tracking-[0.14em] mb-1.5 font-medium">Chain</p><p className="font-semibold text-[13.5px]">Solana</p></div>
                  <div><p className="text-[10px] text-white/35 uppercase tracking-[0.14em] mb-1.5 font-medium">Launch</p><p className="font-semibold text-[13.5px]">pump.fun</p></div>
                </div>
              </div>
            </Fade>
            <div>
              {[
                { label: "Holder rewards", desc: "Trading profits distributed by balance and duration", pct: "100%" },
                { label: "Supply", desc: "Fixed at 1,000,000,000 $ABANK on Solana", pct: "1B" },
                { label: "Distribution", desc: "Periodic on-chain balance snapshots", pct: "Auto" },
              ].map((t, i) => (
                <Fade key={t.label} delay={i * 0.06}>
                  <div className="flex items-start justify-between py-6 gap-4 border-b border-black/[0.06]">
                    <div>
                      <p className="text-[15px] font-semibold mb-1 tracking-[-0.01em]">{t.label}</p>
                      <p className="text-[13px] text-[#888] leading-[1.6]">{t.desc}</p>
                    </div>
                    <span className="number-mono font-semibold text-[13.5px] text-[#171717] shrink-0 tracking-tight">{t.pct}</span>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEES */}
      <section id="fees" className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <Fade>
            <div className="bg-[#171717] p-12 md:p-16 text-white flex flex-col justify-center min-h-[340px] relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.035]"
                style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
              <div className="relative">
                <p className="eyebrow mb-4 text-white/45">Fees</p>
                <h3 className="text-[34px] sm:text-[42px] font-semibold heading-section mb-3 tracking-[-0.02em]">Fee structure</h3>
                <p className="text-white/50 text-[15px] leading-[1.6] max-w-[360px]">Performance-aligned. No hidden costs, no entry or exit fees.</p>
              </div>
            </div>
          </Fade>
          <div className="bg-[#f4f1ea] p-8 md:p-12 flex flex-col justify-center gap-3">
            {[
              { pct: "2", label: "Management", desc: "Annual fee on vault size. Covers infrastructure and operations." },
              { pct: "20", label: "Performance", desc: "On profits only. No profit, no performance fee." },
            ].map((f, i) => (
              <Fade key={f.label} delay={i * 0.08}>
                <div className="rounded-xl p-6 bg-white/55 border border-black/[0.06] hover:border-black/[0.12] transition-colors duration-300">
                  <div className="flex items-start gap-5">
                    <p className="text-[36px] font-semibold number-mono text-[#171717] tracking-[-0.02em]" style={{ lineHeight: 1 }}>{f.pct}<span className="text-[15px] ml-0.5 text-[#999] font-medium">%</span></p>
                    <div><p className="text-[16px] font-medium mb-1 tracking-[-0.01em]">{f.label}</p><p className="text-[13px] text-[#888] leading-[1.6]">{f.desc}</p></div>
                  </div>
                </div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6">
        <div className="relative max-w-[620px] mx-auto text-center">
          <Fade><p className="eyebrow mb-5 text-[#999]">Get started</p></Fade>
          <Fade delay={0.05}><h2 className="text-[38px] sm:text-[52px] font-semibold heading-display mb-5 tracking-[-0.025em] leading-[1.05]">Ready when you are.</h2></Fade>
          <Fade delay={0.1}><p className="text-[16px] text-[#666] mb-10 leading-[1.55] max-w-[440px] mx-auto">Acquire $ABANK, hold in any Solana wallet, and receive your share of distributions.</p></Fade>
          <Fade delay={0.15}>
            <a href="/dashboard" className="btn-primary text-[14px] px-7 py-3.5 inline-flex items-center gap-2">
              Launch app
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
          </Fade>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/[0.05] py-10 px-6">
        <div className="max-w-[1080px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <a href="/" className="flex items-center opacity-90 hover:opacity-100 transition-opacity">
            <Image src="/logo.png" alt="AgentBank" width={120} height={40} />
          </a>
          <div className="flex items-center gap-5 text-[12px] text-[#999]">
            <a href="#how" className="hover:text-[#171717] transition-colors">How it works</a>
            <a href="#fees" className="hover:text-[#171717] transition-colors">Fees</a>
            <a href="/copytrade" className="hover:text-[#171717] transition-colors">Live</a>
            <a href="https://x.com/agentbankx" target="_blank" rel="noreferrer" aria-label="X (@agentbankx)" className="w-8 h-8 rounded-full flex items-center justify-center text-[#888] hover:text-[#171717] hover:bg-black/[0.04] transition-all">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          </div>
          <p className="text-[11px] text-[#bbb] tracking-wide">© 2026 AgentBank</p>
        </div>
      </footer>
    </div>
  );
}
