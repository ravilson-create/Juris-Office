"use client";

import { useId, useState, useTransition } from "react";
import { auxiliarCampoPecaAction, gerarPecaAction } from "@/app/equipe/[caseId]/pecas/actions";
import type { CampoPeca, TipoPeca } from "@/domain/pecas/schema";

/**
 * Um campo livre do formulário, com auxílio de IA opcional para transformar uma anotação
 * informal do advogado em texto no padrão jurídico — ANTES de gerar a peça. A sugestão nunca
 * entra sozinha: aparece como proposta, e só substitui o texto do campo quando o advogado clica
 * em "Usar esta versão" (mesmo padrão do "Corrigir com IA" em PeticaoSecaoEditor, aplicado aqui
 * à etapa de preenchimento em vez de à correção pós-geração).
 */
function CampoPecaInput({ tipo, campo }: { tipo: TipoPeca; campo: CampoPeca }) {
  const textareaId = useId();
  const [valor, setValor] = useState("");
  const [sugestao, setSugestao] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const auxiliarComIA = () => {
    setErro(null);
    setSugestao(null);
    startTransition(async () => {
      const result = await auxiliarCampoPecaAction({ tipo, chave: campo.chave, nota: valor });
      if (result.error) setErro(result.error);
      else if (result.sugestao) setSugestao(result.sugestao);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={textareaId} className="block text-sm font-medium">
          {campo.rotulo}
        </label>
        <button
          type="button"
          onClick={auxiliarComIA}
          disabled={pending}
          className="rounded border border-line px-2 py-1 text-xs font-medium hover:border-navy disabled:opacity-60"
        >
          {pending ? "Auxiliando…" : "Auxílio de IA"}
        </button>
      </div>
      <textarea
        id={textareaId}
        name={`campo:${campo.chave}`}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={campo.placeholder}
        rows={3}
        className="mt-1 w-full rounded border border-line p-2"
      />
      {erro && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {erro}
        </p>
      )}
      {sugestao && (
        <div className="mt-2 rounded-md border border-gold bg-surface p-3">
          <p className="text-xs font-semibold text-gold-strong">
            Sugestão da IA — confira antes de usar
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{sugestao}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setValor(sugestao);
                setSugestao(null);
              }}
              className="rounded border border-line px-3 py-1 text-sm font-medium hover:border-navy"
            >
              Usar esta versão
            </button>
            <button
              type="button"
              onClick={() => setSugestao(null)}
              className="rounded border border-line px-3 py-1 text-sm text-muted hover:border-navy"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Formulário de geração de uma peça pós-decisão: o advogado escolhe o tipo e só então vê os
 * campos de texto livre daquele tipo (ver domain/pecas/schema.ts#CAMPOS_PECA) — cada tipo pede
 * um fato diferente (o que a contestação alegou, o que a decisão indeferiu etc.), nada que o
 * sistema já tenha de algum outro lugar.
 */
export function GerarPecaForm({
  caseId,
  tipos,
}: {
  caseId: string;
  tipos: { tipo: TipoPeca; titulo: string; campos: CampoPeca[] }[];
}) {
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoPeca>(tipos[0]!.tipo);
  const atual = tipos.find((t) => t.tipo === tipoSelecionado)!;

  return (
    <form action={gerarPecaAction} className="mt-4 flex flex-col gap-4 rounded-md border border-line bg-surface p-5">
      <input type="hidden" name="caseId" value={caseId} />
      <div>
        <label htmlFor="tipo-peca" className="block text-sm font-medium">
          Tipo de peça
        </label>
        <select
          id="tipo-peca"
          name="tipo"
          value={tipoSelecionado}
          onChange={(e) => setTipoSelecionado(e.target.value as TipoPeca)}
          className="mt-1 w-full rounded border border-line p-2 sm:w-auto"
        >
          {tipos.map((t) => (
            <option key={t.tipo} value={t.tipo}>
              {t.titulo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="numeroProcesso" className="block text-sm font-medium">
          Número do processo (opcional)
        </label>
        <input
          id="numeroProcesso"
          name="numeroProcesso"
          placeholder="0000000-00.0000.0.00.0000"
          className="mt-1 w-64 rounded border border-line p-2"
        />
      </div>

      {atual.campos.map((campo) => (
        <CampoPecaInput key={campo.chave} tipo={tipoSelecionado} campo={campo} />
      ))}

      <p className="text-xs text-muted">
        Campos deixados em branco ficam marcados como pendentes no documento — nada é inventado.
        Em cada campo, &quot;Auxílio de IA&quot; transforma sua anotação em texto no padrão
        jurídico, e depois de gerada, cada seção também pode ser corrigida na redação com
        auxílio da IA.
      </p>

      <button className="self-start rounded bg-navy px-4 py-2 text-white">Gerar peça</button>
    </form>
  );
}
