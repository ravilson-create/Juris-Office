import { describe, expect, it } from "vitest";
import {
  SERVICOS_JURISPRUDENCIA,
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
    for (const servico of SERVICOS_JURISPRUDENCIA) {
      const url = servico.url("consumidor");
      expect(url).not.toMatch(/nome|cpf|email|telefone/i);
    }
    expect(SERVICO_DOU.url("familia")).not.toMatch(/nome|cpf|email|telefone/i);
  });

  it("cada serviço de jurisprudência gera uma URL por área jurídica", () => {
    for (const servico of SERVICOS_JURISPRUDENCIA) {
      expect(servico.url("trabalhista")).toMatch(/^https:\/\//);
    }
  });

  it("serviços processuais têm URL fixa (não dependem da área)", () => {
    for (const servico of SERVICOS_PROCESSUAIS) {
      expect(servico.url).toMatch(/^https:\/\//);
    }
  });
});
