"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";
import Lenis from "lenis";

// ─── Data ───────────────────────────────────────────────
const STEPS = [
  { num: "01", title: "Get the Token", desc: "Buy $ABANK on pump.fun or any Solana DEX." },
  { num: "02", title: "Stake It", desc: "Lock your tokens in the AgentBank vault." },
  { num: "03", title: "AI Trades", desc: "Our agent executes on Hyperliquid around the clock." },
  { num: "04", title: "Earn Daily", desc: "Profits are split and distributed to stakers every day." },
];

const TOKENOMICS = [
  { label: "Staking Rewards", pct: 60, color: "#171717" },
  { label: "Trading Treasury", pct: 20, color: "#555" },
  { label: "Liquidity", pct: 10, color: "#999" },
  { label: "Team", pct: 10, color: "#ccc" },
];

const STATS = [
  { label: "Total Value Locked", value: 2400000, prefix: "$", change: "+12.4%" },
  { label: "Daily APY", value: 0.12, suffix: "%", decimals: 2, change: "+0.02%" },
  { label: "Stakers", value: 1847, prefix: "", change: "+143" },
  { label: "Profit Paid Out", value: 487000, prefix: "$", change: "+$8.4K" },
];

const ease = [0.16, 1, 0.3, 1];

// ─── Counter ────────────────────────────────────────────
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
          const p = Math.min((now - t0) / 2200, 1);
          setVal((1 - Math.pow(1 - p, 4)) * target);
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

// ─── Scroll-triggered fade (SSR-safe: renders visible, animates after mount) ──
function Fade({ children, className = "", delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

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

  // SSR: render visible. After mount: animate from hidden when scrolled into view.
  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={mounted ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
        animate={visible ? { opacity: 1, y: 0 } : mounted ? { opacity: 0, y: 20 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: ease as any, delay }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─── Sparkline ──────────────────────────────────────────
function Sparkline() {
  const points = [0,15,10,25,20,35,30,45,40,55,48,60,55,70,65,78,72,85,80,90,88,95,92,100];
  const w = 500, h = 80, step = w / (points.length - 1);
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (p / 100) * h}`).join(" ");
  const areaD = `${pathD} L ${w} ${h} L 0 ${h} Z`;
  const ref = useRef<SVGSVGElement>(null);
  const [draw, setDraw] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setDraw(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <svg ref={ref} viewBox={`0 0 ${w} ${h}`} className="w-full h-20 mt-4" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff88" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#cg)" opacity={draw ? 1 : 0} style={{ transition: "opacity 0.8s" }} />
      <path d={pathD} fill="none" stroke="#00ff88" strokeWidth="2" strokeLinecap="round"
        strokeDasharray={draw ? 1000 : 0} strokeDashoffset={draw ? 0 : 1000}
        style={{ transition: "stroke-dashoffset 1.5s ease-out" }} />
    </svg>
  );
}

// ─── Magnetic Button ────────────────────────────────────
function MagBtn({ children, className = "", href = "#", ...props }: {
  children: React.ReactNode; className?: string; href?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <motion.a
      ref={ref}
      href={href}
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

// ═════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════
export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
    const id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); lenis.destroy(); };
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171717]">

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#f4f1ea]/80 backdrop-blur-xl"
        style={{ boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.04)" }}>
        <div className="max-w-[1080px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-[#171717] flex items-center justify-center text-[#00ff88] text-[10px] font-bold number-mono">A</span>
            Agent<span className="text-[#00ff88]">Bank</span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#999]">
            <a href="#vault" className="hover:text-[#171717] transition-colors">Vault</a>
            <a href="#how" className="hover:text-[#171717] transition-colors">How It Works</a>
            <a href="#tokenomics" className="hover:text-[#171717] transition-colors">Tokenomics</a>
            <a href="/stake" className="hover:text-[#171717] transition-colors">Stake</a>
            <a href="/dashboard" className="hover:text-[#171717] transition-colors">Dashboard</a>
          </div>
          <MagBtn href="/dashboard" className="btn-primary inline-flex items-center gap-2 text-[13px] px-5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            Launch App
          </MagBtn>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="pt-36 pb-24 px-6">
        <div className="max-w-[720px] mx-auto text-center">

          {/* Badge */}
          <Fade delay={0.1}>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8"
              style={{ boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.06)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[12px] font-medium text-[#999] tracking-wide">Live on Hyperliquid</span>
            </div>
          </Fade>

          {/* Headline — Stripe weight 300 + Vercel tight tracking */}
          <Fade delay={0.2}>
            <h1 className="text-[40px] sm:text-[56px] md:text-[72px] font-extralight heading-display text-[#171717] mb-6" style={{ lineHeight: 1.0 }}>
              The AI trading vault that earns while you sleep
            </h1>
          </Fade>

          {/* Subtitle */}
          <Fade delay={0.35}>
            <p className="text-[17px] leading-relaxed text-[#4d4d4d] max-w-[480px] mx-auto mb-10">
              Stake $ABANK, let our autonomous agent trade on Hyperliquid, and collect daily profit distributions. No management. No complexity.
            </p>
          </Fade>

          {/* Live PnL card */}
          <Fade delay={0.5}>
            <div className="inline-block">
              <div className="bg-[#171717] rounded-xl px-8 py-6 card-elevated">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                  <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium">Vault Profit (All Time)</p>
                </div>
                <p className="text-[40px] sm:text-[48px] md:text-[56px] font-bold number-mono text-[#00ff88]" style={{ lineHeight: 1.1 }}>
                  <Counter target={487231} prefix="$" />
                </p>
                <Sparkline />
              </div>
            </div>
          </Fade>

          {/* CTAs — Revolut pill style */}
          <Fade delay={0.65}>
            <div className="flex gap-3 justify-center mt-10">
              <MagBtn href="/dashboard" className="btn-primary flex items-center gap-2">
                Enter the Vault
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </MagBtn>
              <MagBtn href="#how" className="btn-secondary">How It Works</MagBtn>
            </div>
          </Fade>
        </div>
      </section>

      {/* Divider */}
      <div className="divider" />

      {/* ─── VAULT STATS ─── — dark terminal grid */}
      <section id="vault" className="py-24 px-6">
        <div className="max-w-[1080px] mx-auto">
          <Fade>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] text-center mb-3">Performance</p>
          </Fade>
          <Fade delay={0.1}>
            <h2 className="text-[32px] sm:text-[40px] font-semibold heading-section text-center mb-3">Vault Stats</h2>
          </Fade>
          <Fade delay={0.15}>
            <p className="text-[14px] text-[#999] text-center mb-10">Real-time metrics from the trading vault</p>
          </Fade>

          {/* Dark terminal card */}
          <Fade delay={0.2}>
            <div className="bg-[#171717] rounded-2xl overflow-hidden card-elevated">
              {/* Terminal header bar */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-[11px] text-white/20 number-mono">agentbank_vault.stats</span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/[0.04]">
                {STATS.map((s, i) => (
                  <div key={s.label} className="px-6 py-7 group hover:bg-white/[0.02] transition-colors duration-300">
                    <p className="text-[10px] text-white/25 uppercase tracking-[0.15em] font-medium mb-3">{s.label}</p>
                    <p className="text-[28px] sm:text-[32px] font-bold number-mono tracking-tight text-white" style={{ lineHeight: 1.1 }}>
                      <Counter target={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} />
                    </p>
                    <div className="flex items-center gap-1.5 mt-3">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M6 10V2M6 2L2 6M6 2L10 6" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[12px] text-[#00ff88] number-mono font-medium">{s.change}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Fade>
        </div>
      </section>

      <div className="divider" />

      {/* ─── HOW IT WORKS ─── — horizontal timeline flow */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-[1080px] mx-auto">
          <Fade><p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] text-center mb-3">Simple</p></Fade>
          <Fade delay={0.1}><h2 className="text-[32px] sm:text-[40px] font-semibold heading-section text-center mb-3">How It Works</h2></Fade>
          <Fade delay={0.15}><p className="text-[14px] text-[#999] text-center mb-16">Four steps from token to daily profit</p></Fade>

          {/* Desktop: horizontal timeline */}
          <div className="hidden lg:block">
            {/* Connecting line */}
            <div className="relative">
              <div className="absolute top-[28px] left-[60px] right-[60px] h-[1px] bg-[#171717]/10" />
              <div className="grid grid-cols-4 gap-6">
                {STEPS.map((s, i) => (
                  <Fade key={s.num} delay={i * 0.12}>
                    <div className="relative text-center">
                      {/* Circle node */}
                      <div className="relative z-10 w-[56px] h-[56px] mx-auto mb-6 rounded-full bg-[#f4f1ea] flex items-center justify-center"
                        style={{ boxShadow: "0px 0px 0px 4px #f4f1ea, 0px 0px 0px 5px rgba(0,0,0,0.06)" }}>
                        <span className="number-mono text-[16px] font-bold text-[#171717]">{s.num}</span>
                      </div>
                      {/* Arrow between (except last) */}
                      {i < STEPS.length - 1 && (
                        <div className="absolute top-[26px] -right-[13px] z-10">
                          <svg width="24" height="6" viewBox="0 0 24 6" fill="none">
                            <path d="M0 3H18M18 3L14 1M18 3L14 5" stroke="rgba(0,0,0,0.12)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                      <h3 className="text-[18px] font-semibold mb-2 tracking-tight">{s.title}</h3>
                      <p className="text-[14px] text-[#4d4d4d] leading-relaxed max-w-[200px] mx-auto">{s.desc}</p>
                    </div>
                  </Fade>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile: vertical timeline */}
          <div className="lg:hidden space-y-0">
            {STEPS.map((s, i) => (
              <Fade key={s.num} delay={i * 0.08}>
                <div className="flex gap-5">
                  {/* Timeline rail */}
                  <div className="flex flex-col items-center">
                    <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center shrink-0"
                      style={{ boxShadow: "0px 0px 0px 3px #f4f1ea, 0px 0px 0px 4px rgba(0,0,0,0.06)" }}>
                      <span className="number-mono text-[13px] font-bold">{s.num}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-[1px] flex-1 min-h-[24px] bg-[#171717]/10" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-8">
                    <h3 className="text-[17px] font-semibold mb-1 tracking-tight">{s.title}</h3>
                    <p className="text-[14px] text-[#4d4d4d] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ─── TOKENOMICS ─── */}
      <section id="tokenomics" className="py-24 px-6">
        <div className="max-w-[720px] mx-auto">
          <Fade><p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] text-center mb-3">Token</p></Fade>
          <Fade delay={0.1}><h2 className="text-[32px] sm:text-[40px] font-semibold heading-section text-center mb-3">Tokenomics</h2></Fade>
          <Fade delay={0.15}><p className="text-[14px] text-[#999] text-center mb-14">$ABANK on Solana · 1,000,000,000 supply</p></Fade>

          {/* Visual bar */}
          <Fade delay={0.2}>
            <div className="h-[6px] rounded-full overflow-hidden flex mb-10">
              {TOKENOMICS.map((t) => (
                <div key={t.label} className="h-full" style={{ width: `${t.pct}%`, backgroundColor: t.color }} />
              ))}
            </div>
          </Fade>

          {/* Breakdown */}
          <div className="space-y-0">
            {TOKENOMICS.map((t, i) => (
              <Fade key={t.label} delay={i * 0.06}>
                <div className="flex items-center justify-between py-4"
                  style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <div className="flex items-center gap-3">
                    <span className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-[14px] font-medium">{t.label}</span>
                  </div>
                  <span className="number-mono font-semibold text-[14px]">{t.pct}%</span>
                </div>
              </Fade>
            ))}
          </div>

          {/* Token info */}
          <Fade delay={0.4}>
            <div className="mt-12 grid grid-cols-3 gap-8 text-center">
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-[0.15em] mb-1 font-medium">Token</p>
                <p className="number-mono font-semibold text-[15px]">$ABANK</p>
              </div>
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-[0.15em] mb-1 font-medium">Chain</p>
                <p className="font-semibold text-[15px]">Solana</p>
              </div>
              <div>
                <p className="text-[10px] text-[#999] uppercase tracking-[0.15em] mb-1 font-medium">Launch</p>
                <p className="font-semibold text-[15px]">pump.fun</p>
              </div>
            </div>
          </Fade>
        </div>
      </section>

      <div className="divider" />

      {/* ─── FEES ─── */}
      <section className="py-24 px-6">
        <div className="max-w-[720px] mx-auto">
          <Fade><p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] text-center mb-3">Transparent</p></Fade>
          <Fade delay={0.1}><h2 className="text-[32px] sm:text-[40px] font-semibold heading-section text-center mb-3">Fee Structure</h2></Fade>
          <Fade delay={0.15}><p className="text-[14px] text-[#999] text-center mb-14">Aligned incentives. No hidden costs.</p></Fade>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { pct: "2", label: "Management", desc: "Annual fee on vault size. Covers infrastructure and agent operations." },
              { pct: "20", label: "Performance", desc: "On profits only. If the vault doesn't earn, you don't pay." },
            ].map((f, i) => (
              <Fade key={f.label} delay={i * 0.1}>
                <div className="bg-[#171717] rounded-xl p-8 text-white group overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#00ff88]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative">
                    <p className="text-[48px] font-bold number-mono mb-2" style={{ lineHeight: 1 }}>{f.pct}<span className="text-[20px] ml-1">%</span></p>
                    <p className="text-[17px] font-medium mb-2">{f.label}</p>
                    <p className="text-white/30 text-[14px] leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" />

      {/* ─── CTA ─── */}
      <section className="py-28 px-6">
        <div className="max-w-[560px] mx-auto text-center">
          <Fade><p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] mb-4">Get Started</p></Fade>
          <Fade delay={0.1}>
            <h2 className="text-[36px] sm:text-[48px] font-semibold heading-display mb-4">Ready to earn?</h2>
          </Fade>
          <Fade delay={0.2}>
            <p className="text-[16px] text-[#4d4d4d] mb-10 leading-relaxed">
              Join 1,847 stakers already earning daily from AI-driven trading.
            </p>
          </Fade>
          <Fade delay={0.3}>
            <MagBtn href="/dashboard" className="btn-primary text-[15px] px-8 py-3.5 inline-flex items-center gap-2">
              Launch App
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </MagBtn>
          </Fade>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }} className="py-12 px-6">
        <div className="max-w-[1080px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#171717] flex items-center justify-center text-[#00ff88] text-[9px] font-bold number-mono">A</span>
            <span className="text-[14px] font-semibold">Agent<span className="text-[#00ff88]">Bank</span></span>
          </div>
          <div className="flex gap-7 text-[13px] text-[#999]">
            {["Docs", "Twitter", "Telegram", "GitHub"].map((l) => (
              <a key={l} href="#" className="hover:text-[#171717] transition-colors">{l}</a>
            ))}
          </div>
          <p className="text-[11px] text-[#bbb]">© 2026 AgentBank</p>
        </div>
      </footer>
    </div>
  );
}
