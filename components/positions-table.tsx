"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";

interface Position {
  id: string;
  market: string;
  side: "Long" | "Short";
  size: string;
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  pnlPercent: string;
  leverage: string;
}

const mockPositions: Position[] = [
  {
    id: "1",
    market: "BTC-PERP",
    side: "Long",
    size: "$48,200",
    entryPrice: "$67,340",
    currentPrice: "$69,500",
    pnl: "+$1,542.80",
    pnlPercent: "+3.20%",
    leverage: "3x",
  },
  {
    id: "2",
    market: "ETH-PERP",
    side: "Short",
    size: "$22,100",
    entryPrice: "$3,847",
    currentPrice: "$3,805",
    pnl: "+$241.50",
    pnlPercent: "+1.09%",
    leverage: "2x",
  },
  {
    id: "3",
    market: "SOL-PERP",
    side: "Long",
    size: "$15,800",
    entryPrice: "$142.50",
    currentPrice: "$148.20",
    pnl: "+$633.60",
    pnlPercent: "+4.01%",
    leverage: "5x",
  },
  {
    id: "4",
    market: "DOGE-PERP",
    side: "Short",
    size: "$8,400",
    entryPrice: "$0.165",
    currentPrice: "$0.158",
    pnl: "+$356.00",
    pnlPercent: "+4.24%",
    leverage: "3x",
  },
];

export default function PositionsTable() {
  const [sortBy, setSortBy] = useState<string>("pnl");
  return (
    <div className="bg-white rounded-2xl border border-[#e5e2db]/50 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e5e2db] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[#1a1a1a]">Live Positions</h3>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-[#00ff88]/10 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] pulse-green" />
            <span className="text-[10px] font-semibold text-[#00ff88] uppercase tracking-wider">
              Live
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock size={12} />
          Updated 12s ago
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f4f1ea]/50">
              {["Market", "Side", "Size", "Entry", "Current", "P&L", "Leverage"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {mockPositions.map((pos, i) => (
              <motion.tr
                key={pos.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-[#e5e2db]/50 hover:bg-[#f4f1ea]/30 transition-colors"
              >
                <td className="px-4 py-3.5">
                  <span className="font-semibold text-[#1a1a1a] text-sm">
                    {pos.market}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${
                      pos.side === "Long"
                        ? "text-[#00ff88] bg-[#00ff88]/10"
                        : "text-[#ff4444] bg-[#ff4444]/10"
                    }`}
                  >
                    {pos.side === "Long" ? (
                      <ArrowUpRight size={12} />
                    ) : (
                      <ArrowDownRight size={12} />
                    )}
                    {pos.side}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-mono-num text-sm text-[#1a1a1a]">
                  {pos.size}
                </td>
                <td className="px-4 py-3.5 font-mono-num text-sm text-gray-500">
                  {pos.entryPrice}
                </td>
                <td className="px-4 py-3.5 font-mono-num text-sm text-[#1a1a1a]">
                  {pos.currentPrice}
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-mono-num text-sm font-semibold text-[#00ff88]">
                    {pos.pnl}
                  </div>
                  <div className="font-mono-num text-xs text-[#00ff88]/70">
                    {pos.pnlPercent}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                    {pos.leverage}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
