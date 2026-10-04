"use client";

import { useState } from "react";
import { gerarPecaAction } from "@/app/equipe/[caseId]/pecas/actions";
import type { CampoPeca, TipoPeca } from "@/domain/pecas/schema";

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
        <div key={campo.chave}>
          <label htmlFor={`campo-${campo.chave}`} className="block text-sm font-medium">
            {campo.rotulo}
          </label>
          <textarea
            id={`campo-${campo.chave}`}
            name={`campo:${campo.chave}`}
            placeholder={campo.placeholder}
            rows={3}
            className="mt-1 w-full rounded border border-line p-2"
          />
        </div>
      ))}

      <p className="text-xs text-muted">
        Campos deixados em branco ficam marcados como pendentes no documento — nada é inventado.
        Depois de gerada, cada seção pode ser corrigida na redação com auxílio da IA.
      </p>

      <button className="self-start rounded bg-navy px-4 py-2 text-white">Gerar peça</button>
    </form>
  );
}
