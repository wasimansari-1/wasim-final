// components/Skeleton.js
import React from "react";

export function Skeleton({ className = "" }) {
  return <div className={`skeleton-shimmer rounded-2xl ${className}`} />;
}

export function CallCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <Skeleton className="h-10 w-10 rounded-2xl shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full shrink-0" />
      </div>

      <div className="space-y-2 pt-1 border-t border-slate-100">
        <Skeleton className="h-3.5 w-full" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
      </div>
    </div>
  );
}

export function StatsGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
      ))}
    </div>
  );
}

export function PaymentCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2 py-2 bg-slate-50 rounded-xl p-2.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 6, rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex items-center gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "w-12 flex-none" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
