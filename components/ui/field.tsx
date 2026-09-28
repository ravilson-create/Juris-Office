import type { ReactNode } from "react";

export const inputClass =
  "block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted/70 focus:border-navy aria-[invalid=true]:border-danger";

export function fieldIds(name: string) {
  return { input: `f-${name}`, help: `f-${name}-ajuda`, error: `f-${name}-erro` };
}

export function describedBy(name: string, hasHelp: boolean, hasError: boolean) {
  const ids = fieldIds(name);
  return (
    [hasHelp ? ids.help : null, hasError ? ids.error : null].filter(Boolean).join(" ") || undefined
  );
}

export function HelpText({ name, children }: { name: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={fieldIds(name).help} className="mt-1 text-sm text-muted">
      {children}
    </p>
  );
}

export function ErrorText({ name, message }: { name: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={fieldIds(name).error}
      className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-danger"
    >
      <span aria-hidden="true">!</span>
      <span>{message}</span>
    </p>
  );
}

export function RequiredMark({ required }: { required: boolean }) {
  return required ? (
    <span className="ml-1 text-danger" aria-hidden="true">
      *
    </span>
  ) : (
    <span className="ml-2 text-sm font-normal text-muted">(opcional)</span>
  );
}
