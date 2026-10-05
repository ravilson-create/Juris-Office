"use client";

import { useState } from "react";
import { cadastrarMembroEquipeAction } from "@/app/equipe/actions";

/** OAB só aparece (e só é exigida) quando o papel escolhido é "advogado" — administrativo nunca
 * tem OAB, mesma regra reforçada no banco (cadastrar_membro_equipe_direto). A conta nasce já
 * criada e ativa com a senha informada aqui — sem convite, sem e-mail de confirmação. */
export function CadastroMembroForm() {
  const [role, setRole] = useState<"lawyer" | "staff">("lawyer");

  return (
    <form
      action={cadastrarMembroEquipeAction}
      className="mt-4 flex flex-col gap-4 rounded border border-line p-4"
    >
      <div>
        <label htmlFor="cadastro-nome" className="block font-medium">
          Nome
        </label>
        <input
          id="cadastro-nome"
          name="nome"
          required
          autoComplete="off"
          className="mt-1.5 w-full rounded border border-line px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="cadastro-email" className="block font-medium">
          E-mail
        </label>
        <input
          id="cadastro-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          className="mt-1.5 w-full rounded border border-line px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="cadastro-senha" className="block font-medium">
          Senha provisória
        </label>
        <input
          id="cadastro-senha"
          name="senha"
          type="password"
          minLength={12}
          required
          autoComplete="off"
          placeholder="Mínimo de 12 caracteres"
          className="mt-1.5 w-full rounded border border-line px-3 py-2"
        />
        <p className="mt-1 text-xs text-muted">
          A conta já nasce ativa com esta senha — repasse-a à pessoa para o primeiro acesso.
        </p>
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
        <label htmlFor="cadastro-cpf" className="block font-medium">
          CPF
        </label>
        <input
          id="cadastro-cpf"
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
            <label htmlFor="cadastro-oab-numero" className="block font-medium">
              OAB
            </label>
            <input
              id="cadastro-oab-numero"
              name="oabNumero"
              inputMode="numeric"
              required
              className="mt-1.5 w-full rounded border border-line px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="cadastro-oab-uf" className="block font-medium">
              UF
            </label>
            <input
              id="cadastro-oab-uf"
              name="oabUf"
              maxLength={2}
              required
              className="mt-1.5 w-full rounded border border-line px-3 py-2 uppercase"
            />
          </div>
        </div>
      )}
      {role === "lawyer" && (
        <p className="text-xs text-muted">
          A OAB informada aqui fica confirmada em seu nome — você é quem está se responsabilizando
          por este cadastro, a plataforma não reconfere o número contra o site oficial.
        </p>
      )}

      <button className="self-start rounded border border-line bg-navy px-4 py-2 text-sm text-white">
        Cadastrar membro
      </button>
    </form>
  );
}
