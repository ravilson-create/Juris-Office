import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { consultarLexml } = await import("@/lib/external/lexml");

const RESPOSTA_COM_RESULTADOS = `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.2</version>
  <numberOfRecords>2</numberOfRecords>
  <records>
    <record>
      <recordSchema>info:srw/schema/1/dc-v1.1</recordSchema>
      <recordData>
        <dc xmlns="http://purl.org/dc/elements/1.1/">
          <title>Lei nº 8.078, de 11 de setembro de 1990</title>
          <description>Dispõe sobre a proteção do consumidor e dá outras providências.</description>
          <date>1990-09-11</date>
          <identifier>urn:lex:br:federal:lei:1990-09-11;8078</identifier>
        </dc>
      </recordData>
    </record>
    <record>
      <recordSchema>info:srw/schema/1/dc-v1.1</recordSchema>
      <recordData>
        <dc xmlns="http://purl.org/dc/elements/1.1/">
          <title>Decreto nº 2.181, de 20 de março de 1997</title>
          <description>Dispõe sobre a organização do Sistema Nacional de Defesa do Consumidor.</description>
          <date>1997-03-20</date>
          <identifier>urn:lex:br:federal:decreto:1997-03-20;2181</identifier>
        </dc>
      </recordData>
    </record>
  </records>
</searchRetrieveResponse>`;

const RESPOSTA_SEM_RESULTADOS = `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.2</version>
  <numberOfRecords>0</numberOfRecords>
</searchRetrieveResponse>`;

const RESPOSTA_COM_DIAGNOSTICO = `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <version>1.2</version>
  <diagnostics>
    <diagnostic xmlns="http://www.loc.gov/zing/srw/diagnostic/">
      <uri>info:srw/diagnostic/1/10</uri>
      <message>Sintaxe de consulta inválida</message>
    </diagnostic>
  </diagnostics>
</searchRetrieveResponse>`;

function mockFetch(resposta: { ok: boolean; status?: number; text: () => Promise<string> }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("consultarLexml", () => {
  it("termo vazio não chama a API e devolve lista vazia", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await consultarLexml("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("monta a URL da API pública SRU do LexML, sem chave nem credencial", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => RESPOSTA_SEM_RESULTADOS });
    vi.stubGlobal("fetch", fetchMock);
    await consultarLexml("direito do consumidor");
    const urlChamada = String(fetchMock.mock.calls[0]![0]);
    expect(urlChamada).toMatch(/^https:\/\/www\.lexml\.gov\.br\/busca\/SRU\?/);
    expect(urlChamada).toContain("operation=searchRetrieve");
    expect(urlChamada).toContain("recordSchema=dc");
    expect(urlChamada).not.toMatch(/key|token|senha/i);
  });

  it("extrai título, ementa, data e urn de cada registro, montando a URL pública", async () => {
    mockFetch({ ok: true, text: async () => RESPOSTA_COM_RESULTADOS });
    const resultado = await consultarLexml("direito do consumidor");
    expect(resultado).toEqual([
      {
        urn: "urn:lex:br:federal:lei:1990-09-11;8078",
        titulo: "Lei nº 8.078, de 11 de setembro de 1990",
        ementa: "Dispõe sobre a proteção do consumidor e dá outras providências.",
        data: "1990-09-11",
        url: "https://www.lexml.gov.br/urn/urn:lex:br:federal:lei:1990-09-11;8078",
      },
      {
        urn: "urn:lex:br:federal:decreto:1997-03-20;2181",
        titulo: "Decreto nº 2.181, de 20 de março de 1997",
        ementa: "Dispõe sobre a organização do Sistema Nacional de Defesa do Consumidor.",
        data: "1997-03-20",
        url: "https://www.lexml.gov.br/urn/urn:lex:br:federal:decreto:1997-03-20;2181",
      },
    ]);
  });

  it("sem resultados, devolve lista vazia (não lança erro)", async () => {
    mockFetch({ ok: true, text: async () => RESPOSTA_SEM_RESULTADOS });
    expect(await consultarLexml("termo sem nenhum resultado possível")).toEqual([]);
  });

  it("resposta com diagnóstico de erro lança com a mensagem do serviço", async () => {
    mockFetch({ ok: true, text: async () => RESPOSTA_COM_DIAGNOSTICO });
    await expect(consultarLexml("((( sintaxe inválida")).rejects.toThrow(
      "Sintaxe de consulta inválida",
    );
  });

  it("envia User-Agent de navegador (necessário para passar a verificação de segurança do Senado)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => RESPOSTA_SEM_RESULTADOS });
    vi.stubGlobal("fetch", fetchMock);
    await consultarLexml("direito civil");
    const opcoes = fetchMock.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(opcoes.headers["User-Agent"]).toMatch(/Mozilla/);
  });

  it("resposta é a página HTML de verificação de segurança (não XML) — erro claro, sem travar", async () => {
    const PAGINA_SEGURANCA = `<!DOCTYPE html>
<meta name="viewport" content="width=device-width">
<title>Verificação de segurança — Senado Federal</title>
<style>* { box-sizing: border-box; }</style>`;
    mockFetch({ ok: true, text: async () => PAGINA_SEGURANCA });
    await expect(consultarLexml("direito civil")).rejects.toThrow(
      "O LexML bloqueou esta consulta automática",
    );
  });

  it("HTTP não-OK lança erro com o status", async () => {
    mockFetch({ ok: false, status: 503, text: async () => "" });
    await expect(consultarLexml("direito civil")).rejects.toThrow(/503/);
  });

  it("falha de rede lança erro amigável", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    await expect(consultarLexml("direito civil")).rejects.toThrow(
      "Não foi possível consultar o LexML agora.",
    );
  });
});
