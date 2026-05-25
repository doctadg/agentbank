"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useMotionValue, useScroll, useTransform } from "framer-motion";
import Lenis from "lenis";

const Icon = ({ d, size = 22, fill = "none" }: { d: string; size?: number; fill?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  // wallet — get the token
  wallet: "M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2H5a2 2 0 0 0 0 4h15v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 12.5h2",
  // shield — hold it
  shield: "M12 21s7-3.5 7-9V5l-7-2-7 2v7c0 5.5 7 9 7 9z",
  // cpu / chip — AI trades
  cpu: "M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M6 6h12v12H6zM10 10h4v4h-4z",
  // trending up — earn
  trending: "M3 17l6-6 4 4 8-8M14 7h7v7",
  // coin — hold $ABANK
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M15 9.5C15 8.12 13.66 7 12 7s-3 1.12-3 2.5S10.34 12 12 12s3 1.12 3 2.5S13.66 17 12 17s-3-1.12-3-2.5",
  // camera / snapshot — we snapshot balances
  snapshot: "M3 7h3l2-3h8l2 3h3v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  // gift — distributed by weight
  gift: "M3 11h18v10H3zM12 21V8M3 8h18v3H3zM12 8s-2-5-5-5a2 2 0 0 0 0 4h5zM12 8s2-5 5-5a2 2 0 0 1 0 4h-5z",
};

type Step = { num: string; title: string; desc: string; icon: string };

const STEPS: Step[] = [
  { num: "01", title: "Get the Token", desc: "Buy $ABANK on pump.fun or any Solana DEX.", icon: ICONS.wallet },
  { num: "02", title: "Hold It", desc: "Keep $ABANK in your wallet. No staking, no locking, no risk.", icon: ICONS.shield },
  { num: "03", title: "AI Trades", desc: "Our autonomous agent executes on Hyperliquid 24/7.", icon: ICONS.cpu },
  { num: "04", title: "Earn", desc: "100% of trading profits go to holders. The longer you hold, the more you earn.", icon: ICONS.trending },
];

const EARN_STEPS = [
  { title: "Hold $ABANK in any Solana wallet", desc: "Phantom, Solflare, Backpack — doesn't matter. Just hold.", icon: ICONS.coin },
  { title: "We snapshot on-chain balances", desc: "Periodic reads from the blockchain. Your holdings are tracked automatically.", icon: ICONS.snapshot },
  { title: "Profits distributed by holding weight", desc: "Reward = (your holding days x your avg balance) / (total weight) x distribution amount.", icon: ICONS.gift },
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
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#f4f1ea]/75 backdrop-blur-xl"
        style={{ boxShadow: "0px 1px 0px rgba(0,0,0,0.04)" }}>
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center opacity-90 hover:opacity-100 transition-opacity">
            <Image src="/logo.png" alt="AgentBank" width={140} height={46} priority />
          </a>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#888]">
            <a href="#how" className="hover:text-[#171717] transition-colors">How It Works</a>
            <a href="#earn" className="hover:text-[#171717] transition-colors">Earn</a>
            <a href="#fees" className="hover:text-[#171717] transition-colors">Fees</a>
            <a href="/activity" className="hover:text-[#171717] transition-colors">Activity</a>
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

      {/* HERO */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative pt-40 pb-32 px-6 overflow-hidden">
        <Particles />
        <div className="relative max-w-[760px] mx-auto text-center">
          <Fade delay={0.1}>
            <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-9 bg-white/60 backdrop-blur-sm"
              style={{ boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.05)" }}>
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-[#00ff88] animate-ping opacity-60" />
                <span className="relative rounded-full w-1.5 h-1.5 bg-[#00ff88]" />
              </span>
              <span className="text-[11.5px] font-medium text-[#666] tracking-[0.02em]">Live on Hyperliquid</span>
            </div>
          </Fade>
          <Fade delay={0.2}>
            <h1 className="text-[42px] sm:text-[60px] md:text-[76px] font-medium heading-display text-[#171717] mb-7">
              The AI trading vault<br />that earns while you sleep
            </h1>
          </Fade>
          <Fade delay={0.35}>
            <p className="text-[17px] leading-[1.55] text-[#666] max-w-[500px] mx-auto mb-11">
              Hold $ABANK in your wallet. Our autonomous agent trades on Hyperliquid and distributes profits to holders. No staking, no locking.
            </p>
          </Fade>
          <Fade delay={0.6}>
            <div className="flex gap-2.5 justify-center">
              <MagBtn href="/dashboard" className="btn-primary flex items-center gap-2">
                Enter the Vault
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </MagBtn>
              <MagBtn href="#how" className="btn-secondary">How It Works</MagBtn>
            </div>
          </Fade>
        </div>
      </motion.section>

      {/* MARQUEE */}
      <div className="py-5 border-y border-black/[0.05] bg-white/20 backdrop-blur-sm">
        <Marquee speed={40}>
          {["$ABANK", "Solana", "Hyperliquid", "AI Trading", "Holder Rewards", "100% Profits", "No Staking", "Autonomous"].map((t) => (
            <span key={t} className="text-[12px] font-medium text-[#999] flex items-center gap-3 tracking-[0.02em] uppercase">
              <span className="w-1 h-1 rounded-full bg-[#00ff88]" />{t}
            </span>
          ))}
        </Marquee>
      </div>

      {/* HOW IT WORKS */}
      <section id="how" className="py-28 px-6">
        <div className="max-w-[1080px] mx-auto">
          <Fade direction="left"><p className="eyebrow mb-4">Simple</p></Fade>
          <Fade direction="left" delay={0.1}><h2 className="text-[34px] sm:text-[48px] font-semibold heading-section mb-4">How It Works</h2></Fade>
          <Fade direction="left" delay={0.15}><p className="text-[15.5px] text-[#888] mb-14 max-w-[420px] leading-[1.55]">Four steps from buying the token to collecting your share of AI trading profits.</p></Fade>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {STEPS.map((s, i) => (
              <Fade key={s.num} delay={i * 0.07} direction={i % 2 === 0 ? "left" : "right"}>
                <motion.div
                  className="relative h-full rounded-2xl p-7 bg-white/55 backdrop-blur-sm border border-black/[0.05] group hover:border-[#00ff88]/35 hover:bg-white/85 transition-all duration-500"
                  style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 4px 16px rgba(0,0,0,0.02)" }}
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                >
                  <span className="absolute top-6 right-6 number-mono text-[10.5px] font-semibold text-[#c2c2c2] tracking-[0.08em]">{s.num}</span>
                  <div className="w-11 h-11 rounded-xl bg-[#171717] flex items-center justify-center text-[#00ff88] mb-5 group-hover:scale-[1.04] transition-transform duration-500"
                    style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                    <Icon d={s.icon} size={20} />
                  </div>
                  <h3 className="text-[19px] font-semibold mb-1.5 tracking-[-0.015em]">{s.title}</h3>
                  <p className="text-[14px] text-[#666] leading-[1.55]">{s.desc}</p>
                </motion.div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* EARN — dark section */}
      <section id="earn" className="relative py-28 px-6 bg-[#171717] overflow-hidden">
        {/* subtle radial glow + faint dots */}
        <div className="absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(ellipse 60% 50% at 30% 0%, rgba(0,255,136,0.06), transparent 70%)" }} />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <motion.div
          className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,255,136,0.05), transparent 70%)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative max-w-[1080px] mx-auto">
          <div className="md:flex md:items-start md:gap-20">
            <div className="md:w-[36%] mb-12 md:mb-0 md:sticky md:top-28">
              <Fade><p className="eyebrow mb-4" style={{ color: "#00ff88" }}>How You Earn</p></Fade>
              <Fade delay={0.1}>
                <h2 className="text-[34px] sm:text-[46px] font-semibold text-white heading-section mb-5">
                  Your tokens.<br />Your profit.
                </h2>
              </Fade>
              <Fade delay={0.15}>
                <p className="text-[15px] text-white/45 leading-[1.6]">
                  Buy $ABANK. Hold it. That&apos;s it. The agent trades, snapshots track your balance, and you get paid based on how long you held. No staking contract. No lock-up. No middleman.
                </p>
              </Fade>
            </div>
            <div className="md:flex-1">
              <div className="space-y-2.5">
                {EARN_STEPS.map((item, i) => (
                  <Fade key={item.title} delay={0.1 + i * 0.07} direction="right">
                    <motion.div
                      className="relative rounded-2xl p-6 bg-white/[0.025] border border-white/[0.07] hover:border-[#00ff88]/30 hover:bg-white/[0.04] transition-all duration-500 flex items-start gap-5"
                      whileHover={{ x: 4 }}
                      transition={{ type: "spring", stiffness: 280, damping: 22 }}
                      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)" }}
                    >
                      <span className="absolute top-6 right-6 number-mono text-[10.5px] font-semibold text-white/25 tracking-[0.08em]">0{i + 1}</span>
                      <div className="w-11 h-11 rounded-xl bg-[#00ff88]/[0.09] flex items-center justify-center shrink-0 text-[#00ff88] border border-[#00ff88]/[0.12]">
                        <Icon d={item.icon} size={19} />
                      </div>
                      <div className="flex-1 pr-8">
                        <p className="text-[15.5px] font-medium text-white/95 mb-1 tracking-[-0.01em]">{item.title}</p>
                        <p className="text-[13px] text-white/45 leading-[1.6]">{item.desc}</p>
                      </div>
                    </motion.div>
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
          <div className="md:flex md:justify-end">
            <div className="md:max-w-[480px]">
              <Fade direction="right"><p className="eyebrow mb-4">Token</p></Fade>
              <Fade direction="right" delay={0.1}><h2 className="text-[34px] sm:text-[48px] font-semibold heading-section mb-4">Tokenomics</h2></Fade>
              <Fade direction="right" delay={0.15}><p className="text-[15.5px] text-[#888] mb-12 leading-[1.55]">$ABANK on Solana · 1,000,000,000 supply</p></Fade>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <Fade direction="left" delay={0.2}>
              <div className="rounded-2xl bg-[#171717] p-10 text-white relative overflow-hidden"
                style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
                <motion.div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-[#00ff88]/[0.06] blur-2xl"
                  animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
                <p className="text-[80px] font-semibold number-mono text-[#00ff88] mb-2" style={{ lineHeight: 1 }}>100%</p>
                <p className="text-[18px] font-medium mb-4 text-white/95">Agent Profits → Holders</p>
                <div className="h-[2px] rounded-full bg-white/10 overflow-hidden">
                  <motion.div className="h-full bg-[#00ff88] rounded-full"
                    initial={{ width: "0%" }} whileInView={{ width: "100%" }} viewport={{ once: true }}
                    transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }} />
                </div>
                <p className="text-white/35 text-[13.5px] mt-6 leading-[1.6]">
                  Trading profits from the AI agent are distributed proportionally to all $ABANK holders. Your share grows with how long you hold.
                </p>
                <div className="mt-9 grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.07]">
                  <div><p className="text-[10px] text-white/35 uppercase tracking-[0.14em] mb-1.5 font-medium">Token</p><p className="number-mono font-semibold text-[13.5px]">$ABANK</p></div>
                  <div><p className="text-[10px] text-white/35 uppercase tracking-[0.14em] mb-1.5 font-medium">Chain</p><p className="font-semibold text-[13.5px]">Solana</p></div>
                  <div><p className="text-[10px] text-white/35 uppercase tracking-[0.14em] mb-1.5 font-medium">Launch</p><p className="font-semibold text-[13.5px]">pump.fun</p></div>
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
                  <div className="flex items-start justify-between py-6 gap-4 group" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    <div><p className="text-[15px] font-semibold mb-1 tracking-[-0.01em] group-hover:text-[#171717] transition-colors">{t.label}</p><p className="text-[13px] text-[#888] leading-[1.6]">{t.desc}</p></div>
                    <span className="number-mono font-semibold text-[13.5px] text-[#00cc6a] shrink-0 tracking-tight">{t.pct}</span>
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
          <Fade direction="left">
            <div className="bg-[#171717] p-12 md:p-16 text-white flex flex-col justify-center min-h-[340px] relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.04]"
                style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
              <div className="relative">
                <p className="eyebrow mb-4" style={{ color: "#00ff88" }}>Transparent</p>
                <h3 className="text-[34px] sm:text-[42px] font-semibold heading-section mb-3">Fee Structure</h3>
                <p className="text-white/40 text-[15px] leading-[1.6]">Aligned incentives. No hidden costs.</p>
              </div>
            </div>
          </Fade>
          <div className="bg-[#f4f1ea] p-8 md:p-12 flex flex-col justify-center gap-3">
            {[
              { pct: "2", label: "Management", desc: "Annual fee on vault size. Covers infrastructure and agent operations." },
              { pct: "20", label: "Performance", desc: "On profits only. If the vault doesn't earn, you don't pay." },
            ].map((f, i) => (
              <Fade key={f.label} delay={i * 0.1} direction="right">
                <motion.div className="rounded-2xl p-6 bg-white/50 border border-black/[0.05] group hover:border-[#00ff88]/30 hover:bg-white/80 transition-all duration-500"
                  style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.02), 0 4px 16px rgba(0,0,0,0.02)" }} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 280, damping: 22 }}>
                  <div className="flex items-start gap-5">
                    <p className="text-[38px] font-semibold number-mono text-[#171717]" style={{ lineHeight: 1 }}>{f.pct}<span className="text-[15px] ml-0.5 text-[#999] font-medium">%</span></p>
                    <div><p className="text-[16px] font-medium mb-1 tracking-[-0.01em]">{f.label}</p><p className="text-[13px] text-[#888] leading-[1.6]">{f.desc}</p></div>
                  </div>
                </motion.div>
              </Fade>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00ff88]/[0.04] via-transparent to-transparent" />
        <motion.div className="absolute w-[700px] h-[700px] rounded-full bg-[#00ff88]/[0.04] blur-[200px]"
          animate={{ x: [-100, 100, -100], y: [-50, 50, -50] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          style={{ top: "-25%", left: "25%" }} />
        <div className="relative max-w-[600px] mx-auto text-center">
          <Fade><p className="eyebrow mb-5">Get Started</p></Fade>
          <Fade delay={0.1}><h2 className="text-[40px] sm:text-[56px] font-semibold heading-display mb-5">Ready to earn?</h2></Fade>
          <Fade delay={0.2}><p className="text-[17px] text-[#555] mb-11 leading-[1.55]">Hold $ABANK. Let the agent work. Collect your share.</p></Fade>
          <Fade delay={0.3}>
            <MagBtn href="/dashboard" className="btn-primary text-[14px] px-7 py-3.5 inline-flex items-center gap-2">
              Launch App
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </MagBtn>
          </Fade>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }} className="py-10 px-6">
        <div className="max-w-[1080px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <a href="/" className="flex items-center opacity-90 hover:opacity-100 transition-opacity">
            <Image src="/logo.png" alt="AgentBank" width={120} height={40} />
          </a>
          <a href="#" aria-label="X" className="w-9 h-9 rounded-full flex items-center justify-center text-[#888] hover:text-[#171717] hover:bg-black/[0.04] transition-all">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <p className="text-[11px] text-[#bbb] tracking-wide">© 2026 AgentBank</p>
        </div>
      </footer>
    </div>
  );
}
