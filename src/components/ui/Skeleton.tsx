"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function PageSkeleton() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    // Phase 1 — DOM parsing (0→60%)
    const onReadyStateChange = () => {
      if (document.readyState === "interactive") setPercent(60);
      if (document.readyState === "complete") setPercent(100);
    };

    document.addEventListener("readystatechange", onReadyStateChange);
    // Catch cases where we mounted after readyState already changed
    if (document.readyState === "interactive") setPercent(60);
    if (document.readyState === "complete") setPercent(100);

    // Phase 2 — Sub-resources (60→95%) via PerformanceObserver
    let observer: PerformanceObserver | null = null;

    if (typeof PerformanceObserver !== "undefined") {
      const getResourceProgress = () => {
        const entries = performance.getEntriesByType("resource");
        // Count entries that have fully loaded (transferSize is set)
        const loaded = entries.filter(
          (e) => (e as PerformanceResourceTiming).responseEnd > 0
        ).length;
        const total = entries.length || 1;
        // Map resource progress into 60–95% band
        const band = Math.min(95, 60 + Math.round((loaded / total) * 35));
        setPercent((prev) => Math.max(prev, band));
      };

      observer = new PerformanceObserver(getResourceProgress);
      observer.observe({ type: "resource", buffered: true });
    }

    // Phase 3 — Guarantee 100% after all painting is done
    const raf = requestAnimationFrame(() => {
      const timer = setTimeout(() => setPercent(100), 300);
      return () => clearTimeout(timer);
    });

    return () => {
      document.removeEventListener("readystatechange", onReadyStateChange);
      observer?.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Smooth the visual jump with CSS transition on the SVG arc
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-6">
      <div className="relative flex items-center justify-center">

        {/* Animated SVG ring — replaces the CSS spinner so we can draw progress */}
        <svg width="96" height="96" className="-rotate-90">
          {/* Track */}
          <circle
            cx="48" cy="48" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-indigo-100 dark:text-indigo-950"
          />
          {/* Progress arc */}
          <circle
            cx="48" cy="48" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-indigo-500 transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>

        {/* Logo centered inside ring */}
        <div className="absolute">
          <Image
            src="/logo.png"
            alt="Logo"
            width={56}
            height={56}
            className="object-contain"
          />
        </div>
      </div>

      {/* Percentage label */}
      <p className="text-sm font-semibold tabular-nums text-indigo-500 tracking-wide">
        {percent}%
      </p>
    </div>
  );
}