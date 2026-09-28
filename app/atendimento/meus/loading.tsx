export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10" role="status" aria-live="polite">
      <div className="h-8 w-1/2 animate-pulse rounded bg-line" />
      <div className="mt-6 h-28 animate-pulse rounded-md bg-line" />
      <div className="mt-4 h-28 animate-pulse rounded-md bg-line" />
      <span className="sr-only">Carregando seus atendimentos…</span>
    </div>
  );
}
