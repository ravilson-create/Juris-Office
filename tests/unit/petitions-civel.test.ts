import { describe, expect, it } from "vitest";
import type { Applicant } from "@/domain/case/schema";
import { decidirModelosCivel, gerarPeticaoCivel } from "@/lib/petitions/civel";

const applicant: Applicant = {
  fullName: "João Pereira",
  email: "joao@example.com",
  phone: "98991234567",
  city: "São Luís",
  uf: "MA",
  consentAccepted: true,
};

describe("decisão determinística de modelo — cível", () => {
  it.each([
    ["contrato", "civel.rescisao_contratual"],
    ["divida", "civel.acao_cobranca"],
    ["danos", "civel.indenizacao_danos"],
    ["imovel", "civel.despejo_cobranca_alugueis"],
    ["vizinhanca", "civel.obrigacao_fazer_nao_fazer"],
  ])("tipo_conflito=%s decide %s", (tipo, modeloEsperado) => {
    expect(decidirModelosCivel({ tipo_conflito: tipo })).toEqual([modeloEsperado]);
  });

  it("tipo_conflito outro ou ausente não decide nenhum modelo", () => {
    expect(decidirModelosCivel({ tipo_conflito: "outro" })).toEqual([]);
    expect(decidirModelosCivel({})).toEqual([]);
  });
});

describe("geração da petição — cível", () => {
  it("usa o nome das partes informado na qualificação do réu", () => {
    const doc = gerarPeticaoCivel("civel.acao_cobranca", applicant, {
      tipo_conflito: "divida",
      partes: "Comércio ABC Ltda.",
    });
    const qualificacao = doc.secoes.find((s) => s.chave === "qualificacao_autor")!;
    expect(qualificacao.corpo).toContain("Comércio ABC Ltda.");
    expect(qualificacao.corpo).toContain("em face de");
  });

  it("sem partes informadas, marca a qualificação do réu como pendente", () => {
    const doc = gerarPeticaoCivel("civel.acao_cobranca", applicant, { tipo_conflito: "divida" });
    expect(doc.pendencias).toContain("qualificação completa do(a) réu(é)");
  });

  it("converte o valor em centavos da triagem para reais formatados, nunca o número cru", () => {
    const doc = gerarPeticaoCivel("civel.acao_cobranca", applicant, {
      tipo_conflito: "divida",
      partes: "Fulano de Tal",
      valor_envolvido: 125000,
    });
    const fatos = doc.secoes.find((s) => s.chave === "dos_fatos")!.corpo;
    expect(fatos).toContain("R$");
    expect(fatos).toContain("1.250,00");
    expect(fatos).not.toContain("125000");
  });

  it("cobrança cita os arts. 389 e 394 do Código Civil", () => {
    const doc = gerarPeticaoCivel("civel.acao_cobranca", applicant, { tipo_conflito: "divida" });
    const direito = doc.secoes.find((s) => s.chave === "do_direito")!.corpo;
    expect(direito).toContain("389");
    expect(direito).toContain("394");
  });

  it("inclui seção de tentativa de acordo só quando notificacao_acordo=true", () => {
    const comTentativa = gerarPeticaoCivel("civel.rescisao_contratual", applicant, {
      tipo_conflito: "contrato",
      notificacao_acordo: true,
    });
    expect(comTentativa.secoes.some((s) => s.chave === "da_tentativa_de_acordo")).toBe(true);

    const semTentativa = gerarPeticaoCivel("civel.rescisao_contratual", applicant, {
      tipo_conflito: "contrato",
    });
    expect(semTentativa.secoes.some((s) => s.chave === "da_tentativa_de_acordo")).toBe(false);
  });

  it("despejo cita a Lei do Inquilinato e pede confirmação do papel do autor", () => {
    const doc = gerarPeticaoCivel("civel.despejo_cobranca_alugueis", applicant, {
      tipo_conflito: "imovel",
    });
    expect(doc.secoes.find((s) => s.chave === "do_direito")!.corpo).toContain("8.245/1991");
    expect(doc.pendencias.some((p) => p.includes("locador"))).toBe(true);
  });
});
