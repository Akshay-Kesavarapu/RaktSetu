export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-light-border rounded w-3/4 mb-2" />
          <div className="h-3 bg-light-border rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}
