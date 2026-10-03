import { describe, expect, it } from "vitest";
import type { Applicant } from "@/domain/case/schema";
import {
  decidirModelosPrevidenciario,
  gerarPeticaoPrevidenciario,
} from "@/lib/petitions/previdenciario";

const applicant: Applicant = {
  fullName: "Francisca Lima",
  cpf: "11144477735",
  email: "francisca@example.com",
  phone: "98991234567",
  city: "São Luís",
  uf: "MA",
  consentAccepted: true,
};

describe("decisão determinística de modelo — previdenciário", () => {
  it.each([
    ["aposentadoria", undefined, "previdenciario.concessao_aposentadoria"],
    ["pensao_morte", undefined, "previdenciario.concessao_pensao_morte"],
    ["bpc", undefined, "previdenciario.concessao_bpc"],
    ["maternidade", undefined, "previdenciario.concessao_maternidade"],
    ["revisao", undefined, "previdenciario.revisao_beneficio"],
  ])("beneficio=%s decide %s", (beneficio, _resultado, modeloEsperado) => {
    expect(decidirModelosPrevidenciario({ beneficio })).toEqual([modeloEsperado]);
  });

  it("incapacidade negado decide concessão; incapacidade cessado decide restabelecimento", () => {
    expect(
      decidirModelosPrevidenciario({ beneficio: "incapacidade", resultado: "negado" }),
    ).toEqual(["previdenciario.concessao_incapacidade"]);
    expect(
      decidirModelosPrevidenciario({ beneficio: "incapacidade", resultado: "cessado" }),
    ).toEqual(["previdenciario.restabelecimento_incapacidade"]);
  });

  it("outro ou ausente não decide nenhum modelo", () => {
    expect(decidirModelosPrevidenciario({ beneficio: "outro" })).toEqual([]);
    expect(decidirModelosPrevidenciario({})).toEqual([]);
  });
});

describe("geração da petição — previdenciário", () => {
  it("o réu é sempre o INSS, nunca pendente", () => {
    const doc = gerarPeticaoPrevidenciario("previdenciario.concessao_aposentadoria", applicant, {
      beneficio: "aposentadoria",
    });
    const qualificacao = doc.secoes.find((s) => s.chave === "qualificacao_autor")!.corpo;
    expect(qualificacao).toContain("Instituto Nacional do Seguro Social (INSS)");
    expect(doc.pendencias.some((p) => p.includes("réu"))).toBe(false);
  });

  it("inclui tutela de urgência quando resultado é negado ou cessado, nunca quando aguardando", () => {
    const negado = gerarPeticaoPrevidenciario("previdenciario.concessao_incapacidade", applicant, {
      beneficio: "incapacidade",
      resultado: "negado",
    });
    expect(negado.secoes.some((s) => s.chave === "tutela_urgencia")).toBe(true);

    const aguardando = gerarPeticaoPrevidenciario(
      "previdenciario.concessao_aposentadoria",
      applicant,
      { beneficio: "aposentadoria", resultado: "aguardando" },
    );
    expect(aguardando.secoes.some((s) => s.chave === "tutela_urgencia")).toBe(false);
  });

  it("cada modelo cita a base legal correta", () => {
    const casos: [Parameters<typeof gerarPeticaoPrevidenciario>[0], string][] = [
      ["previdenciario.concessao_aposentadoria", "arts. 48 a 57"],
      ["previdenciario.concessao_incapacidade", "arts. 59 a 63"],
      ["previdenciario.restabelecimento_incapacidade", "arts. 59 a 63"],
      ["previdenciario.concessao_pensao_morte", "arts. 74 a 79"],
      ["previdenciario.concessao_bpc", "art. 20 da Lei nº 8.742/1993"],
      ["previdenciario.concessao_maternidade", "arts. 71 a 73"],
      ["previdenciario.revisao_beneficio", "art. 103 da Lei nº 8.213/1991"],
    ];
    for (const [modelo, trecho] of casos) {
      const doc = gerarPeticaoPrevidenciario(modelo, applicant, { beneficio: "aposentadoria" });
      expect(doc.secoes.find((s) => s.chave === "do_direito")!.corpo).toContain(trecho);
    }
  });

  it("motivo do indeferimento informado aparece nos fatos", () => {
    const doc = gerarPeticaoPrevidenciario("previdenciario.concessao_incapacidade", applicant, {
      beneficio: "incapacidade",
      resultado: "negado",
      motivo_informado: "perícia administrativa concluiu pela ausência de incapacidade",
    });
    expect(doc.secoes.find((s) => s.chave === "dos_fatos")!.corpo).toContain(
      "ausência de incapacidade",
    );
  });
});
