import { describe, expect, it } from "vitest";
import type { Applicant } from "@/domain/case/schema";
import { decidirModelosConsumidor, gerarPeticaoConsumidor } from "@/lib/petitions/consumidor";

const applicant: Applicant = {
  fullName: "Ana Costa",
  email: "ana@example.com",
  phone: "98991234567",
  city: "São Luís",
  uf: "MA",
  consentAccepted: true,
};

describe("decisão determinística de modelo — consumidor", () => {
  it("negativação tem prioridade sobre cobrança indevida", () => {
    expect(
      decidirModelosConsumidor({ cobranca_negativacao: ["cobranca", "negativacao"] }),
    ).toEqual(["consumidor.declaratoria_inexistencia_negativacao"]);
  });

  it("só cobrança indevida, sem negativação", () => {
    expect(decidirModelosConsumidor({ cobranca_negativacao: ["cobranca"] })).toEqual([
      "consumidor.declaratoria_inexistencia_cobranca",
    ]);
  });

  it("sem cobrança nem negativação, cai no defeito de produto/serviço — nunca vazio", () => {
    expect(decidirModelosConsumidor({ cobranca_negativacao: ["interrupcao"] })).toEqual([
      "consumidor.obrigacao_fazer_produto_servico",
    ]);
    expect(decidirModelosConsumidor({})).toEqual(["consumidor.obrigacao_fazer_produto_servico"]);
  });
});

describe("geração da petição — consumidor", () => {
  it("negativação sempre inclui pedido de tutela de urgência para exclusão do nome", () => {
    const doc = gerarPeticaoConsumidor(
      "consumidor.declaratoria_inexistencia_negativacao",
      applicant,
      { cobranca_negativacao: ["negativacao"], fornecedor: "Banco XYZ" },
    );
    expect(doc.secoes.some((s) => s.chave === "tutela_urgencia")).toBe(true);
    expect(doc.secoes.find((s) => s.chave === "tutela_urgencia")!.corpo).toContain("300");
  });

  it("converte valor em centavos para reais formatados nos fatos", () => {
    const doc = gerarPeticaoConsumidor(
      "consumidor.declaratoria_inexistencia_cobranca",
      applicant,
      { cobranca_negativacao: ["cobranca"], fornecedor: "Loja ABC", valor_envolvido: 35090 },
    );
    const fatos = doc.secoes.find((s) => s.chave === "dos_fatos")!.corpo;
    expect(fatos).toContain("350,90");
    expect(fatos).not.toContain("35090");
  });

  it("cita o art. 42, parágrafo único, do CDC (repetição em dobro) nos dois modelos de cobrança", () => {
    for (const modelo of [
      "consumidor.declaratoria_inexistencia_negativacao",
      "consumidor.declaratoria_inexistencia_cobranca",
    ] as const) {
      const doc = gerarPeticaoConsumidor(modelo, applicant, {
        cobranca_negativacao: modelo.includes("negativacao") ? ["negativacao"] : ["cobranca"],
      });
      expect(doc.secoes.find((s) => s.chave === "do_direito")!.corpo).toContain("42, parágrafo único");
    }
  });

  it("defeito de produto/serviço cita os arts. 18/20 e 12/14 do CDC, nunca pede exclusão de negativação", () => {
    const doc = gerarPeticaoConsumidor("consumidor.obrigacao_fazer_produto_servico", applicant, {
      produto_servico: "geladeira",
      fornecedor: "Loja ABC",
    });
    const direito = doc.secoes.find((s) => s.chave === "do_direito")!.corpo;
    expect(direito).toContain("18");
    expect(direito).toContain("14");
    expect(doc.secoes.some((s) => s.chave === "tutela_urgencia")).toBe(false);
  });

  it("inclui tentativa de solução extrajudicial só quando tentou_resolver=true", () => {
    const com = gerarPeticaoConsumidor("consumidor.obrigacao_fazer_produto_servico", applicant, {
      tentou_resolver: true,
      numero_protocolo: "12345",
      houve_resposta: "sem_resposta",
    });
    const secao = com.secoes.find((s) => s.chave === "da_tentativa_de_solucao")!;
    expect(secao.corpo).toContain("12345");
    expect(secao.corpo).toContain("não obteve resposta");

    const sem = gerarPeticaoConsumidor("consumidor.obrigacao_fazer_produto_servico", applicant, {});
    expect(sem.secoes.some((s) => s.chave === "da_tentativa_de_solucao")).toBe(false);
  });

  it("usa o fornecedor informado como réu na qualificação", () => {
    const doc = gerarPeticaoConsumidor(
      "consumidor.declaratoria_inexistencia_cobranca",
      applicant,
      { cobranca_negativacao: ["cobranca"], fornecedor: "Operadora Telecom S.A." },
    );
    expect(doc.secoes.find((s) => s.chave === "qualificacao_autor")!.corpo).toContain(
      "Operadora Telecom S.A.",
    );
  });
});
