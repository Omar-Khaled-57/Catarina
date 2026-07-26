/**
 * Dashboard Loading — Instant skeleton shown while the dashboard page streams.
 * Matches the 4-card grid layout with animated placeholders.
 */

export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-surface-2 animate-pulse" />
            <div className="h-8 w-12 rounded bg-surface-2 animate-pulse" />
          </div>
        ))}
      </div>
      {/* Section cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-surface-2 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 rounded bg-surface-2 animate-pulse" />
                <div className="h-2 w-full rounded bg-surface-2 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
