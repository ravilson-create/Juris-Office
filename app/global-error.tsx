"use client";

/**
 * Último recurso: falha no layout raiz. Precisa renderizar <html> e <body> próprios
 * e não depende de CSS da aplicação.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 560,
          margin: "80px auto",
          padding: "0 20px",
          color: "#0f1d2e",
        }}
      >
        <h1>Júris Office IA está temporariamente indisponível</h1>
        <p>Tente novamente em alguns instantes. Suas respostas já salvas não foram perdidas.</p>
        {error.digest && <p style={{ fontSize: 14 }}>Código: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 16,
            padding: "10px 18px",
            background: "#032f5b",
            color: "#fff",
            border: 0,
            borderRadius: 6,
            fontSize: 16,
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
