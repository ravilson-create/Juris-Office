import { describe, expect, it } from "vitest";
import { gerarPeca } from "@/lib/pecas/gerar";
import { CAMPOS_PECA, tipoPecaSchema, TITULO_PECA } from "@/domain/pecas/schema";
import { listarPendencias } from "@/domain/petition/schema";

const CTX = {
  applicant: { fullName: "Fulano de Tal", city: "São Luís", uf: "MA" as const },
  protocolo: "JO-20260101-ABCDEF",
  numeroProcesso: "0001234-56.2026.8.10.0001",
};

describe("gerarPeca: as 8 peças pós-decisão", () => {
  it.each(tipoPecaSchema.options)("%s: gera documento com título correto e nunca inventa campo vazio", (tipo) => {
    const doc = gerarPeca(tipo, CTX, {});
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
    const doc = gerarPeca("replica", CTX, {
      pontosContestacao: "o réu nega a existência da dívida.",
    });
    const secao = doc.secoes.find((s) => s.chave === "da_contestacao")!;
    expect(secao.corpo).toContain("o réu nega a existência da dívida.");
    expect(listarPendencias(doc.secoes)).not.toContain("principais pontos da contestação");
  });

  it("embargos de declaração: cita o art. 1.022 do CPC", () => {
    const doc = gerarPeca("embargos_declaracao", CTX, {});
    const cabimento = doc.secoes.find((s) => s.chave === "do_cabimento")!;
    expect(cabimento.corpo).toContain("1.022");
  });

  it("cumprimento de sentença: cita o art. 523 do CPC", () => {
    const doc = gerarPeca("cumprimento_sentenca", CTX, {});
    const cabimento = doc.secoes.find((s) => s.chave === "do_cabimento")!;
    expect(cabimento.corpo).toContain("523");
  });

  it("pedido de multa: cita o art. 537 do CPC", () => {
    const doc = gerarPeca("pedido_multa", CTX, {});
    const pedido = doc.secoes.find((s) => s.chave === "do_pedido")!;
    expect(pedido.corpo).toContain("537");
  });
});
