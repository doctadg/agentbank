"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { StakingProvider, useStaking } from "../hooks/useStaking";

const ease = [0.16, 1, 0.3, 1];

// ─── Fade Animation ─────────────────────────────────────
function Fade({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
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

// ─── Spinner ────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline-block" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

// ─── Format helpers ─────────────────────────────────────
function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── Terminal Stats Card ────────────────────────────────
function TerminalStats() {
  const { totalStaked, apy, vaultProfit, stakers } = useStaking();

  return (
    <div className="bg-[#171717] rounded-2xl overflow-hidden card-elevated">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[11px] text-white/20 number-mono">agentbank_staking.stats</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-white/[0.04]">
        {[
          { label: "Total Staked", value: `$${fmt(totalStaked, 0)}` },
          { label: "Current APY", value: `${apy}%`, accent: true },
          { label: "Vault Profit", value: `$${fmt(vaultProfit, 0)}` },
          { label: "Stakers", value: fmt(stakers, 0) },
        ].map((s) => (
          <div key={s.label} className="px-6 py-7 hover:bg-white/[0.02] transition-colors duration-300">
            <p className="text-[10px] text-white/25 uppercase tracking-[0.15em] font-medium mb-3">{s.label}</p>
            <p className={`text-[24px] sm:text-[30px] font-bold number-mono tracking-tight ${s.accent ? "text-[#00ff88]" : "text-white"}`} style={{ lineHeight: 1.1 }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Your Position Card ─────────────────────────────────
function YourPosition() {
  const { connected } = useWallet();
  const { stakedAmount, pendingRewards, totalStaked } = useStaking();
  const share = totalStaked > 0 ? ((stakedAmount / totalStaked) * 100) : 0;

  return (
    <div className="bg-white/70 rounded-xl p-6 shadow-border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00cc6a]" />
          <h3 className="text-[14px] font-semibold">Your Position</h3>
        </div>
      </div>

      {!connected ? (
        <div className="text-center py-8">
          <p className="text-[14px] text-[#999] mb-3">Connect wallet to view your position</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-[10px] text-[#999] uppercase tracking-[0.15em] mb-2 font-medium">Your Stake</p>
              <p className="text-[24px] font-bold number-mono text-[#171717]" style={{ lineHeight: 1.1 }}>
                ${fmt(stakedAmount, 0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#999] uppercase tracking-[0.15em] mb-2 font-medium">Share</p>
              <p className="text-[24px] font-bold number-mono text-[#171717]" style={{ lineHeight: 1.1 }}>
                {fmt(share, 2)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#999] uppercase tracking-[0.15em] mb-2 font-medium">Earned</p>
              <p className="text-[24px] font-bold number-mono text-[#00cc6a]" style={{ lineHeight: 1.1 }}>
                ${fmt(pendingRewards)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Action Card (Stake / Unstake) ──────────────────────
function ActionCard() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { userBalance, stakedAmount, apy, stake, unstake, isStaking, isUnstaking } = useStaking();
  const [tab, setTab] = useState<"stake" | "unstake">("stake");
  const [amount, setAmount] = useState("");

  const handleAmount = useCallback((val: string) => {
    // Allow only numeric + decimal
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
    }
  }, []);

  const numAmount = parseFloat(amount) || 0;
  const maxAmount = tab === "stake" ? userBalance : stakedAmount;
  const dailyReward = numAmount * (apy / 100) / 365;

  const handleMax = useCallback(() => {
    setAmount(maxAmount > 0 ? String(maxAmount) : "0");
  }, [maxAmount]);

  const handleSubmit = useCallback(async () => {
    if (numAmount <= 0 || numAmount > maxAmount) return;
    if (tab === "stake") {
      await stake(numAmount);
    } else {
      await unstake(numAmount);
    }
    setAmount("");
  }, [numAmount, maxAmount, tab, stake, unstake]);

  const isLoading = tab === "stake" ? isStaking : isUnstaking;
  const actionLabel = tab === "stake" ? "Stake" : "Unstake";

  return (
    <div className="bg-[#171717] rounded-2xl p-6 card-elevated">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.06] rounded-full p-1">
        <button
          onClick={() => setTab("stake")}
          className={`flex-1 py-2 text-[13px] font-medium rounded-full transition-all ${
            tab === "stake" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
          }`}
        >
          Stake
        </button>
        <button
          onClick={() => setTab("unstake")}
          className={`flex-1 py-2 text-[13px] font-medium rounded-full transition-all ${
            tab === "unstake" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
          }`}
        >
          Unstake
        </button>
      </div>

      {/* Amount input */}
      <div className="relative mb-3">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => handleAmount(e.target.value)}
          placeholder="0.00"
          disabled={!connected}
          className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-4 pr-20 text-white text-[20px] number-mono font-semibold placeholder:text-white/15 focus:outline-none focus:border-[#00ff88]/40 transition-colors disabled:opacity-40"
        />
        <button
          onClick={handleMax}
          disabled={!connected}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold px-3 py-1 rounded-full bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors disabled:opacity-40"
        >
          MAX
        </button>
      </div>

      {/* Balance */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-[12px] text-white/30 font-medium">
          {tab === "stake" ? "Available" : "Staked"}
        </span>
        <span className="text-[12px] text-white/50 number-mono">
          {fmt(connected ? (tab === "stake" ? userBalance : stakedAmount) : 0, 0)} ABANK
        </span>
      </div>

      {/* Action button */}
      {!connected ? (
        <button
          onClick={() => setVisible(true)}
          className="w-full py-3.5 rounded-full bg-[#00ff88] text-[#171717] font-semibold text-[14px] hover:bg-[#00ff88]/90 transition-colors"
        >
          Connect Wallet
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={isLoading || numAmount <= 0 || numAmount > maxAmount}
          className="w-full py-3.5 rounded-full bg-[#00ff88] text-[#171717] font-semibold text-[14px] hover:bg-[#00ff88]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Spinner />
              {actionLabel}ing…
            </>
          ) : (
            `${actionLabel} ABANK`
          )}
        </button>
      )}

      {/* Est. rewards */}
      {connected && numAmount > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
          <div className="flex justify-between">
            <span className="text-[11px] text-white/25">Est. daily reward</span>
            <span className="text-[11px] text-[#00ff88] number-mono font-medium">~${fmt(dailyReward)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[11px] text-white/25">Est. APY</span>
            <span className="text-[11px] text-[#00ff88] number-mono font-medium">{apy}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Claim Rewards Card ─────────────────────────────────
function ClaimRewards() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { pendingRewards, nextDistribution, claimRewards, isClaiming } = useStaking();

  return (
    <div className="bg-white/70 rounded-xl p-6 shadow-border">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00cc6a]" />
        <h3 className="text-[14px] font-semibold">Claim Rewards</h3>
      </div>

      {!connected ? (
        <div className="text-center py-4">
          <p className="text-[13px] text-[#999] mb-3">Connect wallet to claim rewards</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-[10px] text-[#999] uppercase tracking-[0.15em] mb-2 font-medium">Pending Rewards</p>
            <p className="text-[32px] font-bold number-mono text-[#00cc6a]" style={{ lineHeight: 1.1 }}>
              ${fmt(pendingRewards)}
            </p>
          </div>
          <div className="flex justify-between items-center mb-6 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
            <span className="text-[12px] text-[#999]">Next distribution</span>
            <span className="text-[13px] number-mono font-medium">{nextDistribution}</span>
          </div>
          <button
            onClick={claimRewards}
            disabled={isClaiming || pendingRewards <= 0}
            className="btn-primary w-full flex items-center justify-center gap-2 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClaiming ? (
              <>
                <Spinner />
                Claiming…
              </>
            ) : (
              "Claim Rewards"
            )}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Staking History Card ───────────────────────────────
function StakingHistory() {
  const { connected } = useWallet();
  const { history } = useStaking();

  return (
    <div className="bg-white/70 rounded-xl p-6 shadow-border">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-[#171717]" />
        <h3 className="text-[14px] font-semibold">Staking History</h3>
      </div>

      {!connected ? (
        <div className="text-center py-8">
          <p className="text-[13px] text-[#999]">Connect wallet to view history</p>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-[13px] text-[#999]">No transactions yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[#999] text-[11px] uppercase tracking-wider">
                <th className="text-left pb-3 font-medium">Type</th>
                <th className="text-right pb-3 font-medium">Amount</th>
                <th className="text-right pb-3 font-medium hidden sm:table-cell">Time</th>
                <th className="text-right pb-3 font-medium hidden md:table-cell">TX</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
                  <td className="py-3">
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                        entry.type === "stake"
                          ? "bg-[#00ff88]/10 text-[#00aa55]"
                          : entry.type === "unstake"
                          ? "bg-orange-100 text-orange-600"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 text-right number-mono font-medium text-[#171717]">
                    ${fmt(entry.amount)}
                  </td>
                  <td className="py-3 text-right text-[#999] hidden sm:table-cell">
                    {formatTimeAgo(entry.timestamp)}
                  </td>
                  <td className="py-3 text-right number-mono text-[#999] text-[11px] hidden md:table-cell">
                    {entry.txId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ═════════════════════════════════════════════════════════
// STAKING PAGE
// ═════════════════════════════════════════════════════════
function StakingPageContent() {
  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#171717]">
      {/* ─── NAV ─── */}
      <nav
        className="sticky top-0 z-50 bg-[#f4f1ea]/80 backdrop-blur-xl"
        style={{ boxShadow: "0px 0px 0px 1px rgba(0,0,0,0.04)" }}
      >
        <div className="max-w-[1080px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-[#171717] flex items-center justify-center text-[#00ff88] text-[10px] font-bold number-mono">
              A
            </span>
            Agent<span className="text-[#00ff88]">Bank</span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#999]">
            <a href="/" className="hover:text-[#171717] transition-colors">Home</a>
            <a href="/dashboard" className="hover:text-[#171717] transition-colors">Dashboard</a>
            <a href="/stake" className="text-[#171717]">Stake</a>
          </div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[13px] px-5 py-2 rounded-full bg-[#171717] text-white font-medium hover:bg-black transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            Launch App
          </a>
        </div>
      </nav>

      <div className="max-w-[1080px] mx-auto px-6 py-8">
        {/* ─── Header ─── */}
        <Fade>
          <div className="mb-8">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#00cc6a] mb-1">
              Earn
            </p>
            <h1 className="text-[32px] font-semibold heading-section mb-2">Staking</h1>
            <p className="text-[14px] text-[#999]">
              Stake $ABANK and earn daily from AI trading profits
            </p>
          </div>
        </Fade>

        {/* ─── Two column grid ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-4">
            <Fade delay={0.05}>
              <TerminalStats />
            </Fade>
            <Fade delay={0.1}>
              <YourPosition />
            </Fade>
            <Fade delay={0.15}>
              <StakingHistory />
            </Fade>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            <Fade delay={0.1}>
              <ActionCard />
            </Fade>
            <Fade delay={0.15}>
              <ClaimRewards />
            </Fade>
          </div>
        </div>

        {/* Footer spacer */}
        <div className="h-16" />
      </div>
    </div>
  );
}

// Wrap with StakingProvider so the inner components can use useStaking
export default function StakingPage() {
  return (
    <StakingProvider>
      <StakingPageContent />
    </StakingProvider>
  );
}
