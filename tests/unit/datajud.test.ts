import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { consultarProcessoDatajud, datajudConfigurado } = await import("@/lib/external/datajud");

const RESPOSTA_COM_PROCESSO = {
  hits: {
    hits: [
      {
        _source: {
          numeroProcesso: "00000000000000000000",
          classe: { nome: "Procedimento Comum Cível" },
          orgaoJulgador: { nome: "1ª Vara Cível" },
          dataAjuizamento: "2024-01-10T00:00:00Z",
          movimentos: [
            { dataHora: "2024-01-10T00:00:00Z", nome: "Distribuição" },
            { dataHora: "2024-03-01T00:00:00Z", nome: "Audiência designada" },
          ],
        },
      },
    ],
  },
};

function mockFetch(resposta: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DATAJUD_API_KEY;
});

describe("datajudConfigurado", () => {
  it("reflete a presença de DATAJUD_API_KEY", () => {
    delete process.env.DATAJUD_API_KEY;
    expect(datajudConfigurado()).toBe(false);
    process.env.DATAJUD_API_KEY = "chave-teste";
    expect(datajudConfigurado()).toBe(true);
  });
});

describe("consultarProcessoDatajud", () => {
  it("sigla de tribunal inválida lança erro sem chamar a API", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      consultarProcessoDatajud("tj sp!", "0000000-00.0000.0.00.0000"),
    ).rejects.toThrow("Sigla de tribunal inválida.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("número de processo com menos de 20 dígitos lança erro sem chamar a API", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(consultarProcessoDatajud("tjsp", "123")).rejects.toThrow(
      "deve ter 20 dígitos",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem DATAJUD_API_KEY configurada, lança erro claro", async () => {
    delete process.env.DATAJUD_API_KEY;
    await expect(
      consultarProcessoDatajud("tjsp", "0000000-00.0000.0.00.0000"),
    ).rejects.toThrow("DATAJUD_API_KEY não configurada.");
  });

  it("extrai classe, órgão julgador e movimentos ordenados do mais recente ao mais antigo", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    mockFetch({ ok: true, json: async () => RESPOSTA_COM_PROCESSO });
    const processo = await consultarProcessoDatajud("tjsp", "0000000-00.0000.0.00.0000");
    expect(processo).toEqual({
      numeroProcesso: "00000000000000000000",
      classe: "Procedimento Comum Cível",
      orgaoJulgador: "1ª Vara Cível",
      dataAjuizamento: "2024-01-10T00:00:00Z",
      movimentos: [
        { dataHora: "2024-03-01T00:00:00Z", nome: "Audiência designada" },
        { dataHora: "2024-01-10T00:00:00Z", nome: "Distribuição" },
      ],
    });
  });

  it("monta a URL com o índice do tribunal em minúsculas e a APIKey no header", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await consultarProcessoDatajud("TJSP", "0000000-00.0000.0.00.0000");
    const [url, opcoes] = fetchMock.mock.calls[0]! as [string, { headers: Record<string, string> }];
    expect(String(url)).toBe("https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search");
    expect(opcoes.headers.Authorization).toBe("APIKey chave-teste");
  });

  it("HTTP 404 devolve null (sigla ou processo não encontrado) sem lançar erro", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    mockFetch({ ok: false, status: 404, json: async () => ({}) });
    const processo = await consultarProcessoDatajud("tjsp", "0000000-00.0000.0.00.0000");
    expect(processo).toBeNull();
  });

  it("sem hits na resposta, devolve null (processo não encontrado)", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    mockFetch({ ok: true, json: async () => ({ hits: { hits: [] } }) });
    const processo = await consultarProcessoDatajud("tjsp", "0000000-00.0000.0.00.0000");
    expect(processo).toBeNull();
  });

  it("timeout na primeira tentativa, sucesso na segunda, devolve o processo", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    const erroTimeout = Object.assign(new Error("The operation timed out."), {
      name: "TimeoutError",
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(erroTimeout)
      .mockResolvedValueOnce({ ok: true, json: async () => RESPOSTA_COM_PROCESSO });
    vi.stubGlobal("fetch", fetchMock);
    const processo = await consultarProcessoDatajud("tjsp", "0000000-00.0000.0.00.0000");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(processo?.numeroProcesso).toBe("00000000000000000000");
  });

  it("timeout em ambas as tentativas lança mensagem amigável", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    const erroTimeout = Object.assign(new Error("The operation timed out."), {
      name: "TimeoutError",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(erroTimeout));
    await expect(
      consultarProcessoDatajud("tjsp", "0000000-00.0000.0.00.0000"),
    ).rejects.toThrow("demorou para responder");
  });

  it("erro de rede que não é timeout propaga sem repetir a tentativa", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      consultarProcessoDatajud("tjsp", "0000000-00.0000.0.00.0000"),
    ).rejects.toThrow("network error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("HTTP 5xx lança mensagem amigável de indisponibilidade temporária", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    mockFetch({ ok: false, status: 503, json: async () => ({}) });
    await expect(
      consultarProcessoDatajud("tjsp", "0000000-00.0000.0.00.0000"),
    ).rejects.toThrow("temporariamente indisponível");
  });

  it("HTTP não-OK fora da faixa 4xx/5xx especial lança erro com o status", async () => {
    process.env.DATAJUD_API_KEY = "chave-teste";
    mockFetch({ ok: false, status: 400, json: async () => ({}) });
    await expect(
      consultarProcessoDatajud("tjsp", "0000000-00.0000.0.00.0000"),
    ).rejects.toThrow(/400/);
  });
});
