"use client";

import { useState } from "react";
import { convidarMembroAction } from "@/app/equipe/actions";

/** OAB só aparece (e só é exigida) quando o papel escolhido é "advogado" — administrativo nunca
 * tem OAB, mesma regra reforçada no banco (office_invites_oab_por_papel). */
export function ConviteForm() {
  const [role, setRole] = useState<"lawyer" | "staff">("lawyer");

  return (
    <form action={convidarMembroAction} className="mt-4 flex flex-col gap-4 rounded border border-line p-4">
      <div>
        <label htmlFor="convite-email" className="block font-medium">
          E-mail
        </label>
        <input
          id="convite-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 w-full rounded border border-line px-3 py-2"
        />
      </div>

      <fieldset>
        <legend className="font-medium">Papel</legend>
        <div className="mt-1.5 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              value="lawyer"
              checked={role === "lawyer"}
              onChange={() => setRole("lawyer")}
            />
            Advogado
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              value="staff"
              checked={role === "staff"}
              onChange={() => setRole("staff")}
            />
            Administrativo
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="convite-cpf" className="block font-medium">
          CPF
        </label>
        <input
          id="convite-cpf"
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          required
          placeholder="Somente números"
          className="mt-1.5 w-full rounded border border-line px-3 py-2"
        />
      </div>

      {role === "lawyer" && (
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <div>
            <label htmlFor="convite-oab-numero" className="block font-medium">
              OAB
            </label>
            <input
              id="convite-oab-numero"
              name="oabNumero"
              inputMode="numeric"
              required
              className="mt-1.5 w-full rounded border border-line px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="convite-oab-uf" className="block font-medium">
              UF
            </label>
            <input
              id="convite-oab-uf"
              name="oabUf"
              maxLength={2}
              required
              className="mt-1.5 w-full rounded border border-line px-3 py-2 uppercase"
            />
          </div>
        </div>
      )}

      <button className="self-start rounded border border-line bg-navy px-4 py-2 text-sm text-white">
        Enviar convite
      </button>
    </form>
  );
}
