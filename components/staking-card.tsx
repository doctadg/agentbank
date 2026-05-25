"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";

export default function StakingCard() {
  const [tab, setTab] = useState<"stake" | "unstake">("stake");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAction = () => {
    if (!amount) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert(tab === "stake" ? "Staked successfully! (mock)" : "Unstaked successfully! (mock)");
      setAmount("");
    }, 1500);
  };

  const estimatedYield = amount ? (parseFloat(amount) * 0.0012).toFixed(4) : "0.0000";

  return (
    <div className="bg-white rounded-2xl border border-[#e5e2db]/50 shadow-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[#e5e2db]">
        <button
          onClick={() => setTab("stake")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors ${
            tab === "stake"
              ? "text-[#1a1a1a] border-b-2 border-[#00ff88] bg-[#00ff88]/5"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <ArrowDownToLine size={16} />
          Stake
        </button>
        <button
          onClick={() => setTab("unstake")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors ${
            tab === "unstake"
              ? "text-[#1a1a1a] border-b-2 border-[#ff4444] bg-[#ff4444]/5"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <ArrowUpFromLine size={16} />
          Unstake
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Current Position */}
        <div className="bg-[#f4f1ea] rounded-xl p-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-gray-500">Your Position</span>
            <span className="text-xs text-gray-400">wallet not connected</span>
          </div>
          <div className="font-mono-num text-2xl font-bold text-[#1a1a1a]">
            12,450.00 <span className="text-sm text-gray-400 font-normal">AGBK</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">≈ $14,940.00</div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            {tab === "stake" ? "Stake" : "Unstake"} Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#f4f1ea] border border-[#e5e2db] rounded-xl px-4 py-3 pr-16 text-lg font-mono-num text-[#1a1a1a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00ff88]/30 focus:border-[#00ff88]/50 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={() => setAmount("12450")}
                className="text-xs font-semibold text-[#00ff88] bg-[#00ff88]/10 px-2 py-1 rounded-md hover:bg-[#00ff88]/20 transition-colors"
              >
                MAX
              </button>
              <span className="text-sm text-gray-400 font-medium">AGBK</span>
            </div>
          </div>
          {/* Quick amounts */}
          <div className="flex gap-2 mt-2">
            {["25%", "50%", "75%", "100%"].map((pct) => (
              <button
                key={pct}
                onClick={() => {
                  const frac = parseInt(pct) / 100;
                  setAmount((12450 * frac).toFixed(2));
                }}
                className="flex-1 text-xs font-medium text-gray-500 bg-[#f4f1ea] border border-[#e5e2db] rounded-lg py-1.5 hover:bg-[#e5e2db]/50 transition-colors"
              >
                {pct}
              </button>
            ))}
          </div>
        </div>

        {/* Estimated Yield */}
        <div className="flex justify-between items-center py-3 border-t border-[#e5e2db]">
          <span className="text-sm text-gray-500">Est. Daily Yield</span>
          <span className="font-mono-num text-sm font-semibold text-[#00ff88]">
            +{estimatedYield} AGBK
          </span>
        </div>

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleAction}
          disabled={!amount || loading}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
            !amount || loading
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : tab === "stake"
              ? "bg-[#00ff88] text-[#1a1a1a] hover:bg-[#00ff88]/90 shadow-lg shadow-[#00ff88]/20"
              : "bg-[#ff4444] text-white hover:bg-[#ff4444]/90 shadow-lg shadow-[#ff4444]/20"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              {tab === "stake" ? (
                <>
                  <ArrowDownToLine size={16} />
                  Stake Tokens
                </>
              ) : (
                <>
                  <ArrowUpFromLine size={16} />
                  Unstake Tokens
                </>
              )}
            </span>
          )}
        </motion.button>
      </div>
    </div>
  );
}
