import "server-only";
import { normalizarNumeroProcesso } from "./numero-processo";

/**
 * Cliente da API Pública do DataJud (CNJ) — único serviço desta lista com acesso
 * programático aberto e documentado para terceiros (ver https://datajud-wiki.cnj.jus.br).
 * Os demais (PJe, Escritório Digital, Jusbrasil) exigem certificado digital,
 * login da parte ou contrato comercial: ficam só como link, em lib/external/consultas.ts.
 *
 * Cada tribunal tem seu próprio índice, no padrão "api_publica_<sigla em minúsculas>"
 * (ex.: api_publica_tjsp, api_publica_trf1, api_publica_tst). A sigla é digitada pelo
 * próprio advogado — não existe aqui uma tabela de todas as siglas porque errar uma delas
 * silenciosamente devolveria "processo não encontrado" em vez de avisar que a sigla é inválida.
 */
const DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br";

export type MovimentoDatajud = {
  dataHora: string | null;
  nome: string | null;
};

export type ProcessoDatajud = {
  numeroProcesso: string;
  classe: string | null;
  orgaoJulgador: string | null;
  dataAjuizamento: string | null;
  movimentos: MovimentoDatajud[];
};

function apiKey(): string {
  const key = process.env.DATAJUD_API_KEY;
  if (!key) throw new Error("DATAJUD_API_KEY não configurada.");
  return key;
}

export function datajudConfigurado(): boolean {
  return Boolean(process.env.DATAJUD_API_KEY);
}

/**
 * Consulta um processo pelo número CNJ (20 dígitos) no índice público do tribunal informado.
 * Devolve `null` quando a consulta funcionou mas não achou o processo (sigla errada, processo
 * em segredo de justiça, ou simplesmente não existe) — nunca inventa um resultado.
 */
export async function consultarProcessoDatajud(
  siglaTribunal: string,
  numeroProcesso: string,
): Promise<ProcessoDatajud | null> {
  const sigla = siglaTribunal.trim().toLowerCase();
  const numero = normalizarNumeroProcesso(numeroProcesso);
  if (!/^[a-z0-9]{2,10}$/.test(sigla)) throw new Error("Sigla de tribunal inválida.");
  if (numero.length !== 20) throw new Error("O número do processo (CNJ) deve ter 20 dígitos.");

  const url = `${DATAJUD_BASE_URL}/api_publica_${sigla}/_search`;
  const options = () => ({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `APIKey ${apiKey()}`,
    },
    body: JSON.stringify({
      query: { match: { numeroProcesso: numero } },
      size: 1,
    }),
    // O DataJud pode oscilar; damos tempo suficiente sem deixar a página presa indefinidamente.
    signal: AbortSignal.timeout(30_000),
  });

  let res: Response | null = null;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      res = await fetch(url, options());
      break;
    } catch (erro) {
      const timeout =
        erro instanceof Error &&
        (erro.name === "TimeoutError" ||
          erro.name === "AbortError" ||
          /timeout|aborted/i.test(erro.message));
      if (!timeout) throw erro;
      if (tentativa === 2) {
        throw new Error(
          "O DataJud (CNJ) demorou para responder. Tente novamente em alguns instantes.",
        );
      }
    }
  }

  if (!res) throw new Error("O DataJud (CNJ) está temporariamente indisponível.");
  if (res.status === 404) return null;
  if (!res.ok) {
    if (res.status >= 500) {
      throw new Error("O DataJud (CNJ) está temporariamente indisponível. Tente novamente.");
    }
    throw new Error(`A API pública do DataJud respondeu com erro ${res.status}.`);
  }

  const data = (await res.json()) as {
    hits?: { hits?: { _source?: Record<string, unknown> }[] };
  };
  const source = data.hits?.hits?.[0]?._source;
  if (!source) return null;

  const movimentosBrutos = Array.isArray(source.movimentos) ? source.movimentos : [];
  const movimentos: MovimentoDatajud[] = movimentosBrutos
    .map((m) => {
      const mov = m as Record<string, unknown>;
      return {
        dataHora: typeof mov.dataHora === "string" ? mov.dataHora : null,
        nome: typeof mov.nome === "string" ? mov.nome : null,
      };
    })
    .sort((a, b) => (b.dataHora ?? "").localeCompare(a.dataHora ?? ""));

  return {
    numeroProcesso: typeof source.numeroProcesso === "string" ? source.numeroProcesso : numero,
    classe:
      typeof source.classe === "object" && source.classe !== null
        ? ((source.classe as Record<string, unknown>).nome as string | undefined) ?? null
        : null,
    orgaoJulgador:
      typeof source.orgaoJulgador === "object" && source.orgaoJulgador !== null
        ? ((source.orgaoJulgador as Record<string, unknown>).nome as string | undefined) ?? null
        : null,
    dataAjuizamento:
      typeof source.dataAjuizamento === "string" ? source.dataAjuizamento : null,
    movimentos,
  };
}
