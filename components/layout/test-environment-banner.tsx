/**
 * Aviso permanente enquanto o app é um protótipo: aparece em todas as páginas, desde a
 * entrada, e também na impressão do dossiê.
 */
export function TestEnvironmentBanner() {
  return (
    <aside
      aria-label="Aviso de ambiente de testes"
      className="border-b border-amber-300 bg-amber-50 text-amber-950 print:border print:border-black print:bg-transparent print:text-black"
    >
      <p className="mx-auto max-w-5xl px-5 py-2 text-sm">
        <strong className="font-semibold">Ambiente de testes.</strong> Use apenas dados fictícios.
        Nenhuma informação é encaminhada a advogados e nenhum arquivo é recebido.
      </p>
    </aside>
  );
}
