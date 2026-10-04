import { describe, expect, it } from "vitest";
import { gerarPeca } from "@/lib/pecas/gerar";
import {
  CAMPOS_PECA,
  tipoPecaSchema,
  tiposDisponiveisParaArea,
  TITULO_PECA,
} from "@/domain/pecas/schema";
import { listarPendencias } from "@/domain/petition/schema";

const CTX_CIVEL = {
  applicant: { fullName: "Fulano de Tal", city: "São Luís", uf: "MA" as const },
  protocolo: "JO-20260101-ABCDEF",
  numeroProcesso: "0001234-56.2026.8.10.0001",
  areaSlug: "civel" as const,
};
const CTX_TRABALHISTA = { ...CTX_CIVEL, areaSlug: "trabalhista" as const };
const CTX_FAMILIA = { ...CTX_CIVEL, areaSlug: "familia" as const };
const CTX_PREVIDENCIARIO = { ...CTX_CIVEL, areaSlug: "previdenciario" as const };

describe("gerarPeca: as peças pós-decisão", () => {
  it.each(tipoPecaSchema.options)("%s: gera documento com título correto e nunca inventa campo vazio", (tipo) => {
    const doc = gerarPeca(tipo, CTX_TRABALHISTA, {});
    expect(doc.tituloModelo).toBe(TITULO_PECA[tipo]);
    expect(doc.modeloId).toBe(`peca.${tipo}`);
    expect(doc.secoes.length).toBeGreaterThan(1);
    // Todo campo livre do tipo, deixado vazio, aparece como pendência — nunca é inventado.
    const pendencias = listarPendencias(doc.secoes);
    for (const campo of CAMPOS_PECA[tipo]) {
      expect(pendencias.some((p) => p === campo.rotulo)).toBe(true);
    }
  });

  it("réplica: usa o texto informado pelo advogado, sem alterá-lo", () => {
    const doc = gerarPeca("replica", CTX_CIVEL, {
      pontosContestacao: "o réu nega a existência da dívida.",
    });
    const secao = doc.secoes.find((s) => s.chave === "da_contestacao")!;
    expect(secao.corpo).toContain("o réu nega a existência da dívida.");
    expect(listarPendencias(doc.secoes)).not.toContain("principais pontos da contestação");
  });

  it("embargos de declaração: cita o art. 1.022 do CPC", () => {
    const doc = gerarPeca("embargos_declaracao", CTX_CIVEL, {});
    const cabimento = doc.secoes.find((s) => s.chave === "do_cabimento")!;
    expect(cabimento.corpo).toContain("1.022");
  });

  it("cumprimento de sentença: cita o art. 523 do CPC", () => {
    const doc = gerarPeca("cumprimento_sentenca", CTX_CIVEL, {});
    const cabimento = doc.secoes.find((s) => s.chave === "do_cabimento")!;
    expect(cabimento.corpo).toContain("523");
  });

  it("pedido de multa: cita o art. 537 do CPC", () => {
    const doc = gerarPeca("pedido_multa", CTX_CIVEL, {});
    const pedido = doc.secoes.find((s) => s.chave === "do_pedido")!;
    expect(pedido.corpo).toContain("537");
  });

  describe("endereçamento por área", () => {
    it("cível: endereça ao Juiz de Direito / Comarca / Tribunal de Justiça", () => {
      const juizo = gerarPeca("cumprimento_sentenca", CTX_CIVEL, {}).secoes[0]!;
      expect(juizo.corpo).toContain("JUIZ(A) DE DIREITO");
      expect(juizo.corpo).toContain("COMARCA");
      const tribunal = gerarPeca("apelacao", CTX_CIVEL, {}).secoes[0]!;
      expect(gerarPeca("contrarrazoes_apelacao", CTX_CIVEL, {}).secoes[0]!.corpo).toContain(
        "TRIBUNAL DE JUSTIÇA",
      );
      expect(tribunal.corpo).toContain("JUIZ(A) DE DIREITO"); // apelação é protocolada no juízo a quo
    });

    it("trabalhista: endereça ao Juiz do Trabalho / Vara do Trabalho / TRT", () => {
      const juizo = gerarPeca("cumprimento_execucao_trabalhista", CTX_TRABALHISTA, {}).secoes[0]!;
      expect(juizo.corpo).toContain("JUIZ(A) DO TRABALHO");
      expect(juizo.corpo).toContain("VARA DO TRABALHO");
      const tribunal = gerarPeca("contrarrazoes_recurso_ordinario", CTX_TRABALHISTA, {}).secoes[0]!;
      expect(tribunal.corpo).toContain("TRIBUNAL REGIONAL DO TRABALHO");
    });
  });

  describe("peças trabalhistas: citam o artigo certo da CLT", () => {
    it("recurso ordinário: art. 895, I, CLT", () => {
      const doc = gerarPeca("recurso_ordinario", CTX_TRABALHISTA, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("895");
    });
    it("execução trabalhista: arts. 876 e 880 CLT", () => {
      const doc = gerarPeca("cumprimento_execucao_trabalhista", CTX_TRABALHISTA, {});
      const corpo = doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo;
      expect(corpo).toContain("876");
      expect(corpo).toContain("880");
    });
    it("impugnação aos cálculos: art. 884 CLT", () => {
      const doc = gerarPeca("impugnacao_calculos", CTX_TRABALHISTA, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("884");
    });
    it("agravo de petição: art. 897 CLT", () => {
      const doc = gerarPeca("agravo_peticao", CTX_TRABALHISTA, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("897");
    });
  });

  describe("peças de família: citam o artigo certo do CPC (execução de alimentos)", () => {
    it("cumprimento de alimentos: art. 528 CPC", () => {
      const doc = gerarPeca("cumprimento_alimentos", CTX_FAMILIA, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("528");
    });
    it("pedido de prisão civil: art. 528, §§3º a 7º, CPC", () => {
      const doc = gerarPeca("pedido_prisao_civil", CTX_FAMILIA, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("528");
    });
    it("justificativa de impossibilidade: art. 528, §2º, CPC, qualifica a parte executada", () => {
      const doc = gerarPeca("justificativa_impossibilidade_pagamento", CTX_FAMILIA, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("528");
      expect(doc.secoes.find((s) => s.chave === "qualificacao")!.corpo).toContain("parte executada");
    });
  });

  describe("endereçamento previdenciário: Justiça Federal", () => {
    it("juízo: Juiz Federal / Vara Federal-JEF", () => {
      const juizo = gerarPeca("cumprimento_fazenda_publica", CTX_PREVIDENCIARIO, {}).secoes[0]!;
      expect(juizo.corpo).toContain("JUIZ(A) FEDERAL");
    });
    it("tribunal (apelação/agravo): TRF", () => {
      const tribunal = gerarPeca("contrarrazoes_apelacao", CTX_PREVIDENCIARIO, {}).secoes[0]!;
      expect(tribunal.corpo).toContain("TRIBUNAL REGIONAL FEDERAL");
    });
    it("contrarrazões de recurso inominado: Turma Recursal (JEF), não o TRF", () => {
      const turma = gerarPeca("contrarrazoes_recurso_inominado", CTX_PREVIDENCIARIO, {}).secoes[0]!;
      expect(turma.corpo).toContain("TURMA RECURSAL");
      expect(turma.corpo).not.toContain("TRIBUNAL REGIONAL FEDERAL");
    });
  });

  describe("peças previdenciárias: citam o artigo certo", () => {
    it("recurso inominado: Lei 9.099/95 art. 41 e Lei 10.259/2001 art. 1º", () => {
      const doc = gerarPeca("recurso_inominado", CTX_PREVIDENCIARIO, {});
      const corpo = doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo;
      expect(corpo).toContain("9.099");
      expect(corpo).toContain("10.259");
    });
    it("cumprimento contra a Fazenda Pública: art. 535 CPC e RPV/precatório", () => {
      const doc = gerarPeca("cumprimento_fazenda_publica", CTX_PREVIDENCIARIO, {});
      const corpo = doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo;
      expect(corpo).toContain("535");
      expect(corpo).toContain("RPV");
      expect(corpo).toContain("precatório");
    });
    it("implantação do benefício: arts. 497 e 536 CPC", () => {
      const doc = gerarPeca("implantacao_beneficio", CTX_PREVIDENCIARIO, {});
      const corpo = doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo;
      expect(corpo).toContain("497");
      expect(corpo).toContain("536");
    });
  });

  describe("peças cíveis genéricas: citam o artigo certo do CPC", () => {
    it("impugnação à contestação: art. 350 CPC", () => {
      const doc = gerarPeca("impugnacao_contestacao", CTX_CIVEL, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("350");
    });
    it("reconvenção: art. 343 CPC", () => {
      const doc = gerarPeca("reconvencao", CTX_CIVEL, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("343");
    });
    it("agravo de instrumento: art. 1.015 CPC, endereçado ao tribunal", () => {
      const doc = gerarPeca("agravo_instrumento", CTX_CIVEL, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("1.015");
      expect(doc.secoes[0]!.corpo).toContain("TRIBUNAL DE JUSTIÇA");
    });
    it("impugnação ao cumprimento de sentença: art. 525 CPC", () => {
      const doc = gerarPeca("impugnacao_cumprimento", CTX_CIVEL, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("525");
    });
    it("embargos à execução: art. 914 CPC", () => {
      const doc = gerarPeca("embargos_execucao", CTX_CIVEL, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain("914");
    });
    it("exceção de pré-executividade: dispensa garantia do juízo", () => {
      const doc = gerarPeca("excecao_pre_executividade", CTX_CIVEL, {});
      expect(doc.secoes.find((s) => s.chave === "do_cabimento")!.corpo).toContain(
        "independentemente de penhora",
      );
    });
  });

  describe("tiposDisponiveisParaArea", () => {
    it("trabalhista não lista Apelação/Réplica (nomes cíveis), mas lista Recurso Ordinário", () => {
      const tipos = tiposDisponiveisParaArea("trabalhista");
      expect(tipos).toContain("recurso_ordinario");
      expect(tipos).toContain("manifestacao_defesa");
      expect(tipos).not.toContain("apelacao");
      expect(tipos).not.toContain("replica");
      expect(tipos).not.toContain("cumprimento_alimentos");
      expect(tipos).not.toContain("agravo_instrumento");
      expect(tipos).not.toContain("embargos_execucao");
      expect(tipos).not.toContain("excecao_pre_executividade");
      // genéricas continuam disponíveis, incluindo as de defesa/execução cíveis que também
      // valem subsidiariamente no processo do trabalho
      expect(tipos).toContain("embargos_declaracao");
      expect(tipos).toContain("homologacao_acordo");
      expect(tipos).toContain("reconvencao");
      expect(tipos).toContain("impugnacao_contestacao");
    });

    it("cível lista as 7 peças novas de defesa e execução, mas não Recurso Ordinário (nome trabalhista) nem peças de alimentos (família) ou INSS (previdenciário)", () => {
      const tipos = tiposDisponiveisParaArea("civel");
      expect(tipos).toContain("apelacao");
      expect(tipos).toContain("cumprimento_sentenca");
      expect(tipos).toContain("impugnacao_contestacao");
      expect(tipos).toContain("reconvencao");
      expect(tipos).toContain("agravo_instrumento");
      expect(tipos).toContain("contrarrazoes_agravo_instrumento");
      expect(tipos).toContain("impugnacao_cumprimento");
      expect(tipos).toContain("embargos_execucao");
      expect(tipos).toContain("excecao_pre_executividade");
      expect(tipos).not.toContain("recurso_ordinario");
      expect(tipos).not.toContain("agravo_peticao");
      expect(tipos).not.toContain("cumprimento_alimentos");
      expect(tipos).not.toContain("recurso_inominado");
    });

    it("família lista as peças de alimentos e as genéricas, mas não as trabalhistas", () => {
      const tipos = tiposDisponiveisParaArea("familia");
      expect(tipos).toContain("cumprimento_alimentos");
      expect(tipos).toContain("pedido_prisao_civil");
      expect(tipos).toContain("justificativa_impossibilidade_pagamento");
      expect(tipos).toContain("apelacao");
      expect(tipos).toContain("homologacao_acordo");
      expect(tipos).not.toContain("recurso_ordinario");
      expect(tipos).not.toContain("agravo_peticao");
    });

    it("previdenciário lista as peças do INSS/JEF e as genéricas, mas não cumprimento_sentenca comum", () => {
      const tipos = tiposDisponiveisParaArea("previdenciario");
      expect(tipos).toContain("recurso_inominado");
      expect(tipos).toContain("contrarrazoes_recurso_inominado");
      expect(tipos).toContain("cumprimento_fazenda_publica");
      expect(tipos).toContain("implantacao_beneficio");
      expect(tipos).toContain("apelacao"); // Vara Federal comum, fora do JEF
      expect(tipos).toContain("agravo_tutela");
      expect(tipos).toContain("embargos_declaracao");
      expect(tipos).not.toContain("cumprimento_sentenca"); // rito de devedor privado, não serve contra o INSS
      expect(tipos).not.toContain("recurso_ordinario");
      expect(tipos).not.toContain("cumprimento_alimentos");
    });
  });
});
