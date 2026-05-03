export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-9 w-64 rounded-lg bg-muted" />
      <div className="h-4 w-96 rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card shadow-sm p-6">
            <div className="h-4 w-24 rounded bg-muted mb-4" />
            <div className="h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card shadow-sm h-96" />
    </div>
  );
}
