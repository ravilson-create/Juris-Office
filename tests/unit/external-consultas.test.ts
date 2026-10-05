import { describe, expect, it } from "vitest";
import {
  SERVICOS_JURISPRUDENCIA,
  SERVICOS_LEGISLACAO,
  SERVICOS_PROCESSUAIS,
  SERVICO_DOU,
} from "@/lib/external/consultas";
import { normalizarNumeroProcesso, numeroProcessoValido } from "@/lib/external/numero-processo";

describe("normalizarNumeroProcesso / numeroProcessoValido", () => {
  it("remove pontuação do número CNJ", () => {
    expect(normalizarNumeroProcesso("0000000-00.0000.0.00.0000")).toBe("00000000000000000000");
  });

  it("considera válido só com 20 dígitos", () => {
    expect(numeroProcessoValido("0000000-00.0000.0.00.0000")).toBe(true);
    expect(numeroProcessoValido("123")).toBe(false);
    expect(numeroProcessoValido("")).toBe(false);
  });
});

describe("registro de serviços de consulta externa", () => {
  it("nenhum link embute dado pessoal do caso — só o nome genérico da área jurídica", () => {
    for (const servico of [...SERVICOS_JURISPRUDENCIA, ...SERVICOS_LEGISLACAO]) {
      const url = servico.url("consumidor");
      expect(url).not.toMatch(/nome|cpf|email|telefone/i);
    }
    expect(SERVICO_DOU.url("familia")).not.toMatch(/nome|cpf|email|telefone/i);
  });

  it("cada serviço de jurisprudência e legislação gera uma URL por área jurídica", () => {
    for (const servico of [...SERVICOS_JURISPRUDENCIA, ...SERVICOS_LEGISLACAO]) {
      expect(servico.url("trabalhista")).toMatch(/^https:\/\//);
      expect(servico.url("trabalhista")).toContain("direito%20trabalhista");
    }
  });

  it("sem área escolhida, cai numa URL padrão (sem termo de busca)", () => {
    for (const servico of [...SERVICOS_JURISPRUDENCIA, ...SERVICOS_LEGISLACAO]) {
      expect(servico.url()).toMatch(/^https:\/\//);
    }
    expect(SERVICO_DOU.url()).toMatch(/^https:\/\//);
    expect(SERVICO_DOU.url()).not.toContain("?q=");
  });

  it("LexML (legislação) busca por palavra-chave via ?keyword=", () => {
    expect(SERVICOS_LEGISLACAO[0]!.url("civel")).toBe(
      "https://www.lexml.gov.br/busca/search?keyword=direito%20civil",
    );
    expect(SERVICOS_LEGISLACAO[0]!.url()).toBe("https://www.lexml.gov.br/busca/search");
  });

  it("serviços processuais têm URL fixa (não dependem da área)", () => {
    for (const servico of SERVICOS_PROCESSUAIS) {
      expect(servico.url).toMatch(/^https:\/\//);
    }
  });
});
