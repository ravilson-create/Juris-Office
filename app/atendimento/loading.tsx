export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10" role="status" aria-live="polite">
      <div className="h-8 w-2/3 animate-pulse rounded bg-line" />
      <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-line" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
