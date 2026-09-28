import type { ReactNode } from "react";

export function Alert({
  tone = "info",
  title,
  children,
  id,
}: {
  tone?: "info" | "error";
  title?: string;
  children: ReactNode;
  id?: string;
}) {
  const styles =
    tone === "error"
      ? "border-danger bg-danger-soft text-danger"
      : "border-navy/30 bg-navy-soft text-navy-strong";
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={tone === "error" ? -1 : undefined}
      className={`rounded-md border-l-4 px-4 py-3 text-sm ${styles}`}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}
