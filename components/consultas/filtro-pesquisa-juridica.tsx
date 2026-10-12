"use client";

import { useState } from "react";
import { TERMO_POR_AREA } from "@/lib/external/consultas";
import type { LegalAreaSlug } from "@/domain/legal-area/schema";

const AREAS: { slug: LegalAreaSlug; nome: string }[] = [
  { slug: "consumidor", nome: "Consumidor" },
  { slug: "trabalhista", nome: "Trabalhista" },
  { slug: "familia", nome: "Família" },
  { slug: "previdenciario", nome: "Previdenciário" },
  { slug: "civel", nome: "Cível" },
];

export function FiltroPesquisaJuridica({
  area,
  termo,
  numero,
  tribunal,
}: {
  area?: LegalAreaSlug;
  termo: string;
  numero?: string;
  tribunal?: string;
}) {
  const [pesquisa, setPesquisa] = useState(termo);
  return (
    <form method="get" className="mt-3 flex flex-wrap items-end gap-3">
      {numero && <input type="hidden" name="numero" value={numero} />}
      {tribunal && <input type="hidden" name="tribunal" value={tribunal} />}
      <div>
        <label htmlFor="area" className="block text-sm font-medium">
          Área jurídica
        </label>
        <select
          id="area"
          name="area"
          defaultValue={area ?? ""}
          onChange={(event) => {
            const selecionada = AREAS.find((item) => item.slug === event.target.value);
            setPesquisa(selecionada ? TERMO_POR_AREA[selecionada.slug] : "");
          }}
          className="mt-1 w-56 rounded border border-line p-2"
        >
          <option value="">Sem área</option>
          {AREAS.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="termo" className="block text-sm font-medium">
          Termo para pesquisar no LexML
        </label>
        <input
          id="termo"
          name="termo"
          value={pesquisa}
          onChange={(event) => setPesquisa(event.target.value)}
          maxLength={200}
          placeholder="ex.: rescisão indireta"
          className="mt-1 w-64 rounded border border-line p-2"
        />
      </div>
      <button className="rounded border border-line px-4 py-2">Pesquisar</button>
    </form>
  );
}
