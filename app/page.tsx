"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useMotionValue, useScroll, useTransform } from "framer-motion";
import Lenis from "lenis";

const STEPS = [
  { num: "01", title: "Get the Token", desc: "Buy $ABANK on pump.fun or any Solana DEX.", icon: "🪙" },
  { num: "02", title: "Hold It", desc: "Keep $ABANK in your wallet. No staking, no locking, no risk.", icon: "🤝" },
  { num: "03", title: "AI Trades", desc: "Our autonomous agent executes on Hyperliquid 24/7.", icon: "⚡" },
  { num: "04", title: "Earn", desc: "100% of trading profits go to holders. The longer you hold, the more you earn.", icon: "💰" },
];

const ease = [0.16, 1, 0.3, 1];

function Fade({ children, className = "", delay = 0, direction = "up" }: {
  children: React.ReactNode; className?: string; delay?: number; direction?: "up" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const offset = { up: { y: 30 }, left: { x: -40 }, right: { x: 40 } }[direction];

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
        transition={{ duration: 0.6, ease: ease as any, delay }}
      >
        {children}
      </motion.div>
    </div>
  );
}

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

function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-[#00ff88]/20"
          style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }} />
      ))}
    </div>
  );
}

function Marquee({ children, speed = 25 }: { children: React.ReactNode; speed?: number }) {
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <motion.div className="inline-flex gap-8" animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: speed, repeat: Infinity, ease: "linear" }}>
        {children}{children}
      </motion.div>
    </div>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
    const id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); lenis.destroy(); };
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171717]">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#f4f1ea]/80 backdrop-blur-xl"
        style={{ boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.04)" }}>
        <div className="max-w-[1080px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <Image src="/logo.png" alt="AgentBank" width={150} height={50} priority />
          </a>
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#999]">
            <a href="#how" className="hover:text-[#171717] transition-colors">How It Works</a>
            <a href="#earn" className="hover:text-[#171717] transition-colors">Earn</a>
            <a href="#fees" className="hover:text-[#171717] transition-colors">Fees</a>
            <a href="/dashboard" className="hover:text-[#171717] transition-colors">Dashboard</a>
          </div>
          <MagBtn href="/dashboard" className="btn-primary inline-flex items-center gap-2 text-[13px] px-5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            Launch App
          </MagBtn>
        </div>
      </nav>

      {/* HERO */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative pt-44 pb-28 px-6 overflow-hidden">
        <Particles />
        <div className="relative max-w-[720px] mx-auto text-center">
          <Fade delay={0.1}>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 bg-white/50"
              style={{ boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.06)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="text-[12px] font-medium text-[#999] tracking-wide">Live on Hyperliquid</span>
            </div>
          </Fade>
          <Fade delay={0.2}>
            <h1 className="text-[40px] sm:text-[56px] md:text-[72px] font-extralight heading-display text-[#171717] mb-6" style={{ lineHeight: 1.0 }}>
              The AI trading vault that earns while you sleep
            </h1>
          </Fade>
          <Fade delay={0.35}>
            <p className="text-[17px] leading-relaxed text-[#4d4d4d] max-w-[480px] mx-auto mb-10">
              Hold $ABANK in your wallet. Our autonomous agent trades on Hyperliquid and distributes profits to holders. No staking, no locking.
            </p>
          </Fade>
          <Fade delay={0.6}>
            <div className="flex gap-3 justify-center">
              <MagBtn href="/dashboard" className="btn-primary flex items-center gap-2">
                Enter the Vault
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </MagBtn>
              <MagBtn href="#how" className="btn-secondary">How It Works</MagBtn>
            </div>
          </Fade>
        </div>
      </motion.section>

      {/* MARQUEE */}
      <div className="py-6 border-y border-black/[0.04] bg-white/30">
        <Marquee speed={30}>
          {["$ABANK", "Solana", "Hyperliquid", "AI Trading", "Holder Rewards", "100% Profits", "No Staking", "Autonomous"].map((t) => (
            <span key={t} className="text-[13px] font-medium text-[#999] flex items-center gap-3">
              <span className="w-1 h-1 rounded-full bg-[#00ff88]" />{t}
            </span>
          ))}
        </Marquee>
      </div>

      {/* HOW IT WORKS — left aligned, alternating cards */}
      <section id="how" className="py-24 px-6">
        <div className="max-w-[1080px] mx-auto">
          <Fade direction="left"><p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] mb-3">Simple</p></Fade>
          <Fade direction="left" delay={0.1}><h2 className="text-[32px] sm:text-[48px] font-semibold heading-section mb-4">How It Works</h2></Fade>
          <Fade direction="left" delay={0.15}><p className="text-[16px] text-[#999] mb-16 max-w-[400px]">Four steps from buying the token to collecting your share of AI trading profits.</p></Fade>
          <div className="space-y-6">
            {STEPS.map((s, i) => (
              <Fade key={s.num} delay={i * 0.1} direction={i % 2 === 0 ? "left" : "right"}>
                <div className={`flex flex-col md:flex-row items-start gap-6 ${i % 2 === 1 ? "md:flex-row-reverse md:text-right" : ""}`}>
                  <div className="flex-1 rounded-2xl p-8 bg-white/60 backdrop-blur-sm group hover:bg-white/80 transition-all duration-500"
                    style={{ boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.02)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[28px]">{s.icon}</span>
                      <span className="number-mono text-[11px] text-[#999] font-medium">{s.num}</span>
                    </div>
                    <h3 className="text-[22px] font-semibold mb-2 tracking-tight">{s.title}</h3>
                    <p className="text-[15px] text-[#4d4d4d] leading-relaxed">{s.desc}</p>
                  </div>
                  <div className="hidden md:flex items-center justify-center w-20 shrink-0">
                    <motion.div className="text-[64px] font-bold number-mono text-[#171717]/[0.04]"
                      whileHover={{ scale: 1.2, color: "rgba(0,255,136,0.08)" }} transition={{ type: "spring", stiffness: 300 }}>
                      {s.num}
                    </motion.div>
                  </div>
                  <div className="hidden md:block flex-1" />
                </div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* EARN — dark section, center */}
      <section id="earn" className="relative py-28 px-6 bg-[#171717] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <motion.div className="absolute w-[400px] h-[400px] rounded-full bg-[#00ff88]/[0.04] blur-[120px]"
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{ top: "10%", right: "5%" }} />
        <div className="relative max-w-[720px] mx-auto text-center text-white">
          <Fade><p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00ff88] mb-4">100% to Holders</p></Fade>
          <Fade delay={0.1}>
            <h2 className="text-[36px] sm:text-[56px] font-semibold heading-display mb-6" style={{ lineHeight: 1.05 }}>
              Every cent of profit<br />goes to you
            </h2>
          </Fade>
          <Fade delay={0.2}>
            <p className="text-[17px] text-white/40 max-w-[480px] mx-auto mb-12 leading-relaxed">
              There are no hidden fees eating into your returns. 100% of the agent&apos;s trading profits are distributed to $ABANK holders based on holding duration.
            </p>
          </Fade>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { value: "100%", label: "Profits to Holders", desc: "Zero taken from trading returns" },
              { value: "∞", label: "Hold Duration", desc: "The longer you hold, the more you earn" },
              { value: "0", label: "Lock Period", desc: "Your tokens, your wallet, always" },
            ].map((item, i) => (
              <Fade key={item.label} delay={0.15 + i * 0.1}>
                <motion.div className="rounded-xl p-6 bg-white/[0.04] border border-white/[0.06] hover:border-[#00ff88]/20 transition-colors duration-500"
                  whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <p className="text-[36px] font-bold number-mono text-[#00ff88] mb-2" style={{ lineHeight: 1 }}>{item.value}</p>
                  <p className="text-[15px] font-medium text-white/80 mb-1">{item.label}</p>
                  <p className="text-[13px] text-white/25">{item.desc}</p>
                </motion.div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* TOKENOMICS — right aligned, two-col */}
      <section className="py-24 px-6">
        <div className="max-w-[1080px] mx-auto">
          <div className="md:flex md:justify-end">
            <div className="md:max-w-[480px]">
              <Fade direction="right"><p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] mb-3">Token</p></Fade>
              <Fade direction="right" delay={0.1}><h2 className="text-[32px] sm:text-[48px] font-semibold heading-section mb-4">Tokenomics</h2></Fade>
              <Fade direction="right" delay={0.15}><p className="text-[16px] text-[#999] mb-10">$ABANK on Solana · 1,000,000,000 supply</p></Fade>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <Fade direction="left" delay={0.2}>
              <div className="rounded-2xl bg-[#171717] p-10 text-white relative overflow-hidden"
                style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
                <motion.div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-[#00ff88]/[0.06]"
                  animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
                <p className="text-[72px] font-bold number-mono text-[#00ff88] mb-2" style={{ lineHeight: 1 }}>100%</p>
                <p className="text-[20px] font-medium mb-3">Agent Profits → Holders</p>
                <div className="h-[3px] rounded-full bg-white/10 overflow-hidden">
                  <motion.div className="h-full bg-[#00ff88] rounded-full"
                    initial={{ width: "0%" }} whileInView={{ width: "100%" }} viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }} />
                </div>
                <p className="text-white/25 text-[14px] mt-6 leading-relaxed">
                  Trading profits from the AI agent are distributed proportionally to all $ABANK holders. Your share grows with how long you hold.
                </p>
                <div className="mt-8 grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.06]">
                  <div><p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mb-1">Token</p><p className="number-mono font-semibold text-[14px]">$ABANK</p></div>
                  <div><p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mb-1">Chain</p><p className="font-semibold text-[14px]">Solana</p></div>
                  <div><p className="text-[10px] text-white/30 uppercase tracking-[0.12em] mb-1">Launch</p><p className="font-semibold text-[14px]">pump.fun</p></div>
                </div>
              </div>
            </Fade>
            <div className="space-y-0">
              {[
                { label: "Holder Rewards", desc: "100% of AI trading profits, distributed by holding duration", pct: "100%" },
                { label: "Supply", desc: "1,000,000,000 $ABANK tokens on Solana", pct: "1B" },
                { label: "Distribution", desc: "Periodic snapshots of on-chain balances", pct: "Auto" },
              ].map((t, i) => (
                <Fade key={t.label} delay={i * 0.08} direction="right">
                  <div className="flex items-start justify-between py-5 gap-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                    <div><p className="text-[15px] font-semibold mb-1">{t.label}</p><p className="text-[13px] text-[#999] leading-relaxed">{t.desc}</p></div>
                    <span className="number-mono font-semibold text-[14px] text-[#00cc6a] shrink-0">{t.pct}</span>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEES — split bg */}
      <section id="fees" className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <Fade direction="left">
            <div className="bg-[#171717] p-12 md:p-16 text-white flex flex-col justify-center min-h-[320px]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00ff88] mb-4">Transparent</p>
              <h3 className="text-[32px] sm:text-[40px] font-semibold heading-section mb-3">Fee Structure</h3>
              <p className="text-white/30 text-[15px] leading-relaxed">Aligned incentives. No hidden costs.</p>
            </div>
          </Fade>
          <div className="bg-[#f4f1ea] p-8 md:p-12 flex flex-col justify-center gap-4">
            {[
              { pct: "2", label: "Management", desc: "Annual fee on vault size. Covers infrastructure and agent operations." },
              { pct: "20", label: "Performance", desc: "On profits only. If the vault doesn't earn, you don't pay." },
            ].map((f, i) => (
              <Fade key={f.label} delay={i * 0.1} direction="right">
                <motion.div className="rounded-xl p-6 border border-black/[0.04] group hover:border-[#00ff88]/20 transition-all duration-500"
                  style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.02)" }} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300 }}>
                  <div className="flex items-start gap-4">
                    <p className="text-[36px] font-bold number-mono text-[#171717]" style={{ lineHeight: 1 }}>{f.pct}<span className="text-[16px] ml-0.5">%</span></p>
                    <div><p className="text-[17px] font-medium mb-1">{f.label}</p><p className="text-[13px] text-[#999] leading-relaxed">{f.desc}</p></div>
                  </div>
                </motion.div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00ff88]/[0.03] via-transparent to-transparent" />
        <motion.div className="absolute w-[600px] h-[600px] rounded-full bg-[#00ff88]/[0.03] blur-[200px]"
          animate={{ x: [-100, 100, -100], y: [-50, 50, -50] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          style={{ top: "-20%", left: "30%" }} />
        <div className="relative max-w-[560px] mx-auto text-center">
          <Fade><p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] mb-4">Get Started</p></Fade>
          <Fade delay={0.1}><h2 className="text-[36px] sm:text-[52px] font-semibold heading-display mb-4" style={{ lineHeight: 1.05 }}>Ready to earn?</h2></Fade>
          <Fade delay={0.2}><p className="text-[17px] text-[#4d4d4d] mb-10 leading-relaxed">Hold $ABANK. Let the agent work. Collect your share.</p></Fade>
          <Fade delay={0.3}>
            <MagBtn href="/dashboard" className="btn-primary text-[15px] px-8 py-3.5 inline-flex items-center gap-2">
              Launch App
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </MagBtn>
          </Fade>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }} className="py-12 px-6">
        <div className="max-w-[1080px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <a href="/" className="flex items-center"><Image src="/logo.png" alt="AgentBank" width={120} height={40} /></a>
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
