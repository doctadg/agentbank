"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";
import Lenis from "lenis";

// ─── Data ───────────────────────────────────────────────
const STEPS = [
  { num: "01", title: "Get the Token", desc: "Buy $ABANK on pump.fun or any Solana DEX." },
  { num: "02", title: "Hold It", desc: "Keep $ABANK in your wallet. No staking, no locking." },
  { num: "03", title: "AI Trades", desc: "Our agent executes on Hyperliquid around the clock." },
  { num: "04", title: "Earn Daily", desc: "Profits are distributed to holders based on how long you held." },
];

const TOKENOMICS = [
  { label: "Holder Rewards", pct: 60, color: "#171717" },
  { label: "Trading Treasury", pct: 20, color: "#555" },
  { label: "Liquidity", pct: 10, color: "#999" },
  { label: "Team", pct: 10, color: "#ccc" },
];

const ease = [0.16, 1, 0.3, 1];

// ─── Scroll-triggered fade (SSR-safe) ──
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
  useEffect(() => {
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
          <a href="/" className="flex items-center">
            <Image src="/logo.png" alt="AgentBank" width={150} height={50} priority />
          </a>
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#999]">
            <a href="#how" className="hover:text-[#171717] transition-colors">How It Works</a>
            <a href="#tokenomics" className="hover:text-[#171717] transition-colors">Tokenomics</a>
            <a href="/dashboard" className="hover:text-[#171717] transition-colors">Dashboard</a>
          </div>
          <MagBtn href="/dashboard" className="btn-primary inline-flex items-center gap-2 text-[13px] px-5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            Launch App
          </MagBtn>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="pt-44 pb-28 px-6">
        <div className="max-w-[720px] mx-auto text-center">

          {/* Badge */}
          <Fade delay={0.1}>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8"
              style={{ boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.06)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[12px] font-medium text-[#999] tracking-wide">Live on Hyperliquid</span>
            </div>
          </Fade>

          {/* Headline */}
          <Fade delay={0.2}>
            <h1 className="text-[40px] sm:text-[56px] md:text-[72px] font-extralight heading-display text-[#171717] mb-6" style={{ lineHeight: 1.0 }}>
              The AI trading vault that earns while you sleep
            </h1>
          </Fade>

          {/* Subtitle */}
          <Fade delay={0.35}>
            <p className="text-[17px] leading-relaxed text-[#4d4d4d] max-w-[480px] mx-auto mb-10">
              Hold $ABANK in your wallet. Our autonomous agent trades on Hyperliquid and distributes profits to holders — no staking, no locking, no complexity.
            </p>
          </Fade>

          {/* Hero logo */}
          <Fade delay={0.5}>
            <div className="mb-12">
              <Image src="/logo.png" alt="AgentBank" width={360} height={120} priority className="mx-auto opacity-[0.06]" />
            </div>
          </Fade>

          {/* CTAs */}
          <Fade delay={0.6}>
            <div className="flex gap-3 justify-center">
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

      <div className="divider" />

      {/* ─── HOW IT WORKS ─── */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-[1080px] mx-auto">
          <Fade><p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] text-center mb-3">Simple</p></Fade>
          <Fade delay={0.1}><h2 className="text-[32px] sm:text-[40px] font-semibold heading-section text-center mb-3">How It Works</h2></Fade>
          <Fade delay={0.15}><p className="text-[14px] text-[#999] text-center mb-16">Four steps from token to daily profit</p></Fade>

          {/* Desktop: horizontal timeline */}
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute top-[28px] left-[60px] right-[60px] h-[1px] bg-[#171717]/10" />
              <div className="grid grid-cols-4 gap-6">
                {STEPS.map((s, i) => (
                  <Fade key={s.num} delay={i * 0.12}>
                    <div className="relative text-center">
                      <div className="relative z-10 w-[56px] h-[56px] mx-auto mb-6 rounded-full bg-[#f4f1ea] flex items-center justify-center"
                        style={{ boxShadow: "0px 0px 0px 4px #f4f1ea, 0px 0px 0px 5px rgba(0,0,0,0.06)" }}>
                        <span className="number-mono text-[16px] font-bold text-[#171717]">{s.num}</span>
                      </div>
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
                  <div className="flex flex-col items-center">
                    <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center shrink-0"
                      style={{ boxShadow: "0px 0px 0px 3px #f4f1ea, 0px 0px 0px 4px rgba(0,0,0,0.06)" }}>
                      <span className="number-mono text-[13px] font-bold">{s.num}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-[1px] flex-1 min-h-[24px] bg-[#171717]/10" />
                    )}
                  </div>
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
              Hold $ABANK. Let the agent work. Collect your share.
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
          <a href="/" className="flex items-center">
            <Image src="/logo.png" alt="AgentBank" width={120} height={40} />
          </a>
          <div className="flex gap-7 text-[13px] text-[#999]">
            {["Twitter", "Telegram", "GitHub"].map((l) => (
              <a key={l} href="#" className="hover:text-[#171717] transition-colors">{l}</a>
            ))}
          </div>
          <p className="text-[11px] text-[#bbb]">© 2026 AgentBank</p>
        </div>
      </footer>
    </div>
  );
}
