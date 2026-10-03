import { describe, expect, it } from "vitest";
import type { Applicant } from "@/domain/case/schema";
import { decidirModelosTrabalhista, gerarPeticaoTrabalhista } from "@/lib/petitions/trabalhista";

const applicant: Applicant = {
  fullName: "Carlos Souza",
  cpf: "11144477735",
  email: "carlos@example.com",
  phone: "98991234567",
  city: "São Luís",
  uf: "MA",
  consentAccepted: true,
};

describe("trabalhista sempre decide a mesma peça (só os pedidos variam)", () => {
  it("decide reclamação trabalhista independente das respostas", () => {
    expect(decidirModelosTrabalhista({})).toEqual(["trabalhista.reclamacao_trabalhista"]);
    expect(decidirModelosTrabalhista({ registro_formal: "sim" })).toEqual([
      "trabalhista.reclamacao_trabalhista",
    ]);
  });
});

describe("geração da petição — trabalhista", () => {
  it("sem registro formal, pede reconhecimento de vínculo e anotação em CTPS", () => {
    const doc = gerarPeticaoTrabalhista("trabalhista.reclamacao_trabalhista", applicant, {
      empregador: "Comércio XYZ Ltda.",
      registro_formal: "nao",
    });
    const pedidos = doc.secoes.find((s) => s.chave === "dos_pedidos")!.corpo;
    expect(pedidos).toContain("reconhecimento do vínculo empregatício");
    expect(pedidos).toContain("CTPS");
    expect(doc.secoes.find((s) => s.chave === "do_direito")!.corpo).toContain("arts. 2º e 3º da CLT");
  });

  it("com registro formal desde o início, não pede reconhecimento de vínculo", () => {
    const doc = gerarPeticaoTrabalhista("trabalhista.reclamacao_trabalhista", applicant, {
      empregador: "Comércio XYZ Ltda.",
      registro_formal: "sim",
    });
    const pedidos = doc.secoes.find((s) => s.chave === "dos_pedidos")!.corpo;
    expect(pedidos).not.toContain("reconhecimento do vínculo empregatício");
  });

  it("cada valor não pago marcado gera o pedido correspondente", () => {
    const doc = gerarPeticaoTrabalhista("trabalhista.reclamacao_trabalhista", applicant, {
      empregador: "Comércio XYZ Ltda.",
      valores_nao_pagos: ["horas_extras", "fgts", "decimo_terceiro"],
    });
    const pedidos = doc.secoes.find((s) => s.chave === "dos_pedidos")!.corpo;
    expect(pedidos).toContain("horas extras");
    expect(pedidos).toContain("FGTS");
    expect(pedidos).toContain("13º salário");
    expect(pedidos).not.toContain("férias vencidas");
  });

  it("demissão sem justa causa sem documentos rescisórios pede entrega das guias", () => {
    const doc = gerarPeticaoTrabalhista("trabalhista.reclamacao_trabalhista", applicant, {
      empregador: "Comércio XYZ Ltda.",
      ainda_trabalha: false,
      forma_desligamento: "sem_justa_causa",
      documentos_rescisorios: false,
    });
    expect(doc.secoes.find((s) => s.chave === "dos_pedidos")!.corpo).toContain("guias para levantamento do FGTS");
  });

  it("ainda trabalhando, nunca pede guias de rescisão", () => {
    const doc = gerarPeticaoTrabalhista("trabalhista.reclamacao_trabalhista", applicant, {
      empregador: "Comércio XYZ Ltda.",
      ainda_trabalha: true,
    });
    expect(doc.secoes.find((s) => s.chave === "dos_pedidos")!.corpo).not.toContain("guias para levantamento do FGTS");
  });

  it("converte a remuneração em centavos para o valor da causa, nunca o número cru", () => {
    const doc = gerarPeticaoTrabalhista("trabalhista.reclamacao_trabalhista", applicant, {
      empregador: "Comércio XYZ Ltda.",
      remuneracao: 250000,
    });
    const valorCausa = doc.secoes.find((s) => s.chave === "valor_causa")!.corpo;
    expect(valorCausa).toContain("2.500,00");
    expect(valorCausa).not.toContain("250000");
  });

  it("usa o empregador informado como réu na qualificação", () => {
    const doc = gerarPeticaoTrabalhista("trabalhista.reclamacao_trabalhista", applicant, {
      empregador: "Comércio XYZ Ltda.",
    });
    expect(doc.secoes.find((s) => s.chave === "qualificacao_autor")!.corpo).toContain(
      "Comércio XYZ Ltda.",
    );
  });
});
