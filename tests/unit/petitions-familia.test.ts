import { describe, expect, it } from "vitest";
import type { Applicant } from "@/domain/case/schema";
import { decidirModelosFamilia, gerarPeticaoFamilia } from "@/lib/petitions/familia";

const applicant: Applicant = {
  fullName: "Maria da Silva",
  cpf: "11144477735",
  email: "maria@example.com",
  phone: "98991234567",
  city: "São Luís",
  uf: "MA",
  consentAccepted: true,
};

describe("decisão determinística de modelo — família", () => {
  it.each([
    ["pensao", "familia.acao_alimentos"],
    ["guarda", "familia.regulamentacao_guarda"],
    ["divorcio", "familia.divorcio_litigioso"],
    ["uniao_estavel", "familia.uniao_estavel"],
    ["partilha", "familia.partilha_bens"],
  ])("assunto=%s decide %s", (assunto, modeloEsperado) => {
    expect(decidirModelosFamilia({ assunto })).toEqual([modeloEsperado]);
  });

  it("assunto outro ou ausente não decide nenhum modelo", () => {
    expect(decidirModelosFamilia({ assunto: "outro" })).toEqual([]);
    expect(decidirModelosFamilia({})).toEqual([]);
  });
});

describe("geração da petição — nunca inventa dado", () => {
  it("usa o nome do(a) autor(a) informado e marca CPF/RG/endereço como pendentes", () => {
    const doc = gerarPeticaoFamilia("familia.acao_alimentos", applicant, { assunto: "pensao" });
    const qualificacao = doc.secoes.find((s) => s.chave === "qualificacao_autor")!;
    expect(qualificacao.corpo).toContain("Maria da Silva");
    expect(doc.pendencias).toEqual(
      expect.arrayContaining([
        "CPF do(a) autor(a)",
        "RG do(a) autor(a)",
        "endereço completo do(a) autor(a)",
      ]),
    );
  });

  it("ação de alimentos cita a Lei 5.478/68 e o art. 1.694 do Código Civil", () => {
    const doc = gerarPeticaoFamilia("familia.acao_alimentos", applicant, { assunto: "pensao" });
    const direito = doc.secoes.find((s) => s.chave === "do_direito")!;
    expect(direito.corpo).toContain("5.478/1968");
    expect(direito.corpo).toContain("1.694");
  });

  it("inclui tutela de urgência só quando urgencia=true, com a descrição informada", () => {
    const comUrgencia = gerarPeticaoFamilia("familia.acao_alimentos", applicant, {
      assunto: "pensao",
      urgencia: true,
      urgencia_descricao: "Sem outra fonte de renda para sustento dos filhos.",
    });
    expect(comUrgencia.secoes.some((s) => s.chave === "tutela_urgencia")).toBe(true);
    expect(
      comUrgencia.secoes.find((s) => s.chave === "tutela_urgencia")!.corpo,
    ).toContain("Sem outra fonte de renda");

    const semUrgencia = gerarPeticaoFamilia("familia.acao_alimentos", applicant, {
      assunto: "pensao",
    });
    expect(semUrgencia.secoes.some((s) => s.chave === "tutela_urgencia")).toBe(false);
  });

  it("divórcio inclui pedido de guarda/alimentos e partilha só quando aplicável", () => {
    const simples = gerarPeticaoFamilia("familia.divorcio_litigioso", applicant, {
      assunto: "divorcio",
      relacao: "casamento",
    });
    const pedidosSimples = simples.secoes.find((s) => s.chave === "dos_pedidos")!.corpo;
    expect(pedidosSimples).not.toContain("guarda");
    expect(pedidosSimples).not.toContain("partilha dos bens");

    const completo = gerarPeticaoFamilia("familia.divorcio_litigioso", applicant, {
      assunto: "divorcio",
      relacao: "casamento",
      filhos_menores: true,
      bens_obrigacoes: true,
    });
    const pedidosCompletos = completo.secoes.find((s) => s.chave === "dos_pedidos")!.corpo;
    expect(pedidosCompletos).toContain("guarda");
    expect(pedidosCompletos).toContain("partilha dos bens");
  });

  it("nunca deixa um valor de causa preenchido sem o advogado informar", () => {
    const doc = gerarPeticaoFamilia("familia.partilha_bens", applicant, { assunto: "partilha" });
    const valorCausa = doc.secoes.find((s) => s.chave === "valor_causa")!;
    expect(valorCausa.corpo).toContain("[PENDENTE:");
    expect(doc.pendencias.some((p) => p.includes("valor da causa"))).toBe(true);
  });
});
