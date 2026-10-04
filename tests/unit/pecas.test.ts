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

  describe("tiposDisponiveisParaArea", () => {
    it("trabalhista não lista Apelação/Réplica (nomes cíveis), mas lista Recurso Ordinário", () => {
      const tipos = tiposDisponiveisParaArea("trabalhista");
      expect(tipos).toContain("recurso_ordinario");
      expect(tipos).toContain("manifestacao_defesa");
      expect(tipos).not.toContain("apelacao");
      expect(tipos).not.toContain("replica");
      // genéricas continuam disponíveis
      expect(tipos).toContain("embargos_declaracao");
      expect(tipos).toContain("homologacao_acordo");
    });

    it("cível não lista Recurso Ordinário (nome trabalhista), mas lista Apelação", () => {
      const tipos = tiposDisponiveisParaArea("civel");
      expect(tipos).toContain("apelacao");
      expect(tipos).not.toContain("recurso_ordinario");
      expect(tipos).not.toContain("agravo_peticao");
    });
  });
});
