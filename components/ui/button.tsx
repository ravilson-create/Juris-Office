import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "inverse-navy" | "inverse-teal";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-2.5 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const variants: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-strong",
  secondary: "border border-line bg-surface text-ink hover:border-navy hover:text-navy",
  ghost: "text-navy underline-offset-4 hover:underline",
  /** Botão branco sobre fundo azul-marinho — usado na metade cidadão da home. */
  "inverse-navy": "bg-white text-navy hover:bg-navy-soft",
  /** Botão branco sobre fundo verde-água — usado na metade advogado da home. */
  "inverse-teal": "bg-white text-teal-strong hover:bg-teal-soft",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
