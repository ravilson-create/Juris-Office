"use client";

import { useId, useState, useTransition } from "react";
import { corrigirSecaoIAAction } from "@/app/equipe/[caseId]/peticao/actions";

/**
 * Uma seção da petição, com correção de redação por IA opcional (F3, segunda peça). A sugestão
 * nunca é aplicada sozinha: aparece como proposta, e só entra no texto quando o advogado clica
 * em "Usar esta versão" — o salvamento em si continua no formulário da página (botão "Salvar
 * alterações"), este componente só controla o textarea e a marcação "revisado por IA".
 */
export function PeticaoSecaoEditor({
  petitionId,
  chave,
  titulo,
  corpoInicial,
  revisadoIAInicial,
}: {
  petitionId: string;
  chave: string;
  titulo: string;
  corpoInicial: string;
  revisadoIAInicial: boolean;
}) {
  const textareaId = useId();
  const [corpo, setCorpo] = useState(corpoInicial);
  const [sugestao, setSugestao] = useState<string | null>(null);
  const [revisadoIA, setRevisadoIA] = useState(revisadoIAInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const corrigirComIA = () => {
    setErro(null);
    setSugestao(null);
    startTransition(async () => {
      const result = await corrigirSecaoIAAction(petitionId, chave);
      if (result.error) setErro(result.error);
      else if (result.sugestao) setSugestao(result.sugestao);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={textareaId} className="block font-semibold">
          {titulo}
        </label>
        <div className="flex items-center gap-2">
          {revisadoIA && (
            <span className="rounded bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold-strong">
              Revisado por IA
            </span>
          )}
          <button
            type="button"
            onClick={corrigirComIA}
            disabled={pending}
            className="rounded border border-line px-2 py-1 text-xs font-medium hover:border-navy disabled:opacity-60"
          >
            {pending ? "Corrigindo…" : "Corrigir com IA"}
          </button>
        </div>
      </div>
      <input type="hidden" name="chave" value={chave} />
      <input type="hidden" name={`revisadoIA:${chave}`} value={revisadoIA ? "1" : "0"} />
      <textarea
        id={textareaId}
        name={`corpo:${chave}`}
        value={corpo}
        onChange={(e) => setCorpo(e.target.value)}
        rows={Math.min(14, Math.max(3, corpo.split("\n").length + 1))}
        className="mt-2 w-full rounded border border-line p-3 font-serif text-sm"
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
          <p className="mt-1 whitespace-pre-wrap font-serif text-sm">{sugestao}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCorpo(sugestao);
                setRevisadoIA(true);
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
