"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Users, DollarSign, BarChart3 } from "lucide-react";

interface StatCard {
  label: string;
  value: string;
  prefix: string;
  suffix: string;
  numericValue: number;
  icon: React.ReactNode;
  color: string;
}

const stats: StatCard[] = [
  {
    label: "Total Value Locked",
    value: "$2.4M",
    prefix: "$",
    suffix: "M",
    numericValue: 2.4,
    icon: <DollarSign size={20} />,
    color: "#00ff88",
  },
  {
    label: "Daily APY",
    value: "0.12%",
    prefix: "",
    suffix: "%",
    numericValue: 0.12,
    icon: <TrendingUp size={20} />,
    color: "#00ff88",
  },
  {
    label: "Total Stakers",
    value: "1,847",
    prefix: "",
    suffix: "",
    numericValue: 1847,
    icon: <Users size={20} />,
    color: "#6366f1",
  },
  {
    label: "Profit Paid Out",
    value: "$487K",
    prefix: "$",
    suffix: "K",
    numericValue: 487,
    icon: <BarChart3 size={20} />,
    color: "#00ff88",
  },
];

function useCountUp(target: number, duration: number = 2000, start: boolean = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, start]);

  return value;
}

function StatCardComponent({ stat, index }: { stat: StatCard; index: number }) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const count = useCountUp(stat.numericValue, 2000, inView);

  const formatValue = () => {
    if (stat.label === "Total Value Locked") return `$${count.toFixed(1)}M`;
    if (stat.label === "Daily APY") return `${count.toFixed(2)}%`;
    if (stat.label === "Total Stakers") return `${Math.round(count).toLocaleString()}`;
    if (stat.label === "Profit Paid Out") return `$${Math.round(count)}K`;
    return stat.value;
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="stat-card bg-white rounded-2xl p-6 border border-[#e5e2db]/50 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500 font-medium">{stat.label}</span>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
        >
          {stat.icon}
        </div>
      </div>
      <div className="font-mono-num text-3xl font-bold text-[#1a1a1a]">
        {formatValue()}
      </div>
    </motion.div>
  );
}

export default function VaultStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {stats.map((stat, index) => (
        <StatCardComponent key={stat.label} stat={stat} index={index} />
      ))}
    </div>
  );
}
