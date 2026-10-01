import Image from "next/image";

/** Proporção do símbolo recortado (largura / altura). */
const SYMBOL_RATIO = 339 / 428;

/** Símbolo colorido (azul-marinho + verde-água). Decorativo: o nome da marca vem em texto. */
export function BrandSymbol({
  height,
  className = "",
  priority = false,
}: {
  height: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/juris-office-simbolo.png"
      alt=""
      width={Math.round(height * SYMBOL_RATIO)}
      height={height}
      priority={priority}
      className={className}
    />
  );
}

/**
 * Símbolo monocromático. Usa a silhueta como máscara e pinta com a cor do texto
 * (`currentColor`), então acompanha o contexto: cinza no rodapé, preto na impressão.
 */
export function BrandSymbolMono({
  height,
  className = "inline-block",
}: {
  height: number;
  /** Inclua a classe de exibição (padrão `inline-block`); ex.: `hidden print:inline-block`. */
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 bg-current ${className}`}
      style={{
        width: Math.round(height * SYMBOL_RATIO),
        height,
        WebkitMaskImage: "url(/brand/juris-office-simbolo-mono.png)",
        maskImage: "url(/brand/juris-office-simbolo-mono.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    />
  );
}

/** Logotipo em texto: "Júris" forte, "Office" regular e o selo "IA". */
export function BrandWordmark({
  size = "md",
  mono = false,
}: {
  size?: "sm" | "md" | "lg";
  mono?: boolean;
}) {
  const text = { sm: "text-base", md: "text-xl", lg: "text-3xl" }[size];
  const badge = { sm: "text-[0.6rem]", md: "text-[0.65rem]", lg: "text-sm" }[size];
  return (
    <span
      className={`font-serif leading-none tracking-tight ${text} ${mono ? "" : "text-navy print:text-black"}`}
    >
      <span className="font-extrabold">Júris</span>
      <span className="font-normal"> Office</span>
      <span
        className={`ml-1.5 inline-block rounded px-1.5 py-0.5 align-middle font-sans font-semibold ${badge} ${
          mono
            ? "border border-current"
            : "bg-gold-soft text-gold-strong print:border print:border-black print:bg-transparent print:text-black"
        }`}
      >
        IA
      </span>
    </span>
  );
}

/** Assinatura completa: símbolo + logotipo. */
export function BrandLogo({
  size = "md",
  mono = false,
}: {
  size?: "sm" | "md" | "lg";
  mono?: boolean;
}) {
  const h = { sm: 24, md: 34, lg: 56 }[size];
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      {mono ? <BrandSymbolMono height={h} /> : <BrandSymbol height={h} priority />}
      <BrandWordmark size={size} mono={mono} />
    </span>
  );
}
