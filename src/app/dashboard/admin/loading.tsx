/**
 * Admin Page Loading — Instant skeleton for the admin panel.
 */

export default function AdminLoading() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-8 w-40 rounded bg-surface-2 animate-pulse" />
        <div className="flex-1" />
        <div className="h-9 w-28 rounded-lg bg-surface-2 animate-pulse" />
      </div>
      {/* User table skeleton */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="h-10 w-full rounded-lg bg-surface-2 animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-t border-border/20">
              <div className="h-8 w-8 rounded-full bg-surface-2 animate-pulse" />
              <div className="h-4 w-32 rounded bg-surface-2 animate-pulse" />
              <div className="h-4 w-48 rounded bg-surface-2 animate-pulse hidden sm:block" />
              <div className="flex-1" />
              <div className="h-6 w-16 rounded bg-surface-2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
