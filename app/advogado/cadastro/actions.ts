"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authEnabled, currentIdentity, currentUserId } from "@/lib/auth/session";
import { BRAZIL_UFS } from "@/domain/case/schema";
import { getDb, hasDatabase } from "@/lib/db/connection";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http/client-ip";
import { cpfCnpjValido, somenteDigitos } from "@/lib/billing/validacao";
import { subscriptionPlans } from "@/lib/billing/plans";
import { criarClienteAsaas, criarAssinaturaAsaas } from "@/lib/billing/asaas";

export type CadastroState = { error?: string } | null;

const PLANOS_VALIDOS = subscriptionPlans.map((p) => p.id);
const ciclo = (planoId: string) => (planoId === "yearly" ? "YEARLY" : "MONTHLY");

export async function iniciarTesteGratis(
  _state: CadastroState,
  form: FormData,
): Promise<CadastroState> {
  if (!authEnabled) return { error: "Cadastro profissional indisponível nesta instalação." };
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");

  const input = z
    .object({
      nome: z.string().trim().min(2).max(120),
      cpfCnpj: z.string().min(1),
      oabNumero: z
        .string()
        .trim()
        .min(1)
        .max(20)
        .regex(/^\d+$/, { error: "Número da OAB deve conter só dígitos." }),
      oabUf: z.enum(BRAZIL_UFS),
      planoId: z.enum(PLANOS_VALIDOS as [string, ...string[]]),
      aceitouTermos: z.literal("on"),
    })
    .safeParse({
      nome: form.get("nome"),
      cpfCnpj: form.get("cpfCnpj"),
      oabNumero: form.get("oabNumero"),
      oabUf: form.get("oabUf"),
      planoId: form.get("planoId"),
      aceitouTermos: form.get("aceitouTermos"),
    });
  if (!input.success) {
    return {
      error: "Preencha o nome do escritório, o CPF/CNPJ, a OAB (número e UF) e aceite os termos.",
    };
  }
  const cpfCnpjDigitos = somenteDigitos(input.data.cpfCnpj);
  if (!cpfCnpjValido(cpfCnpjDigitos)) {
    return { error: "CPF/CNPJ inválido — confira os números digitados." };
  }

  if (hasDatabase()) {
    const dentroDoLimite = await checkRateLimit(`advogado:cadastro:${await clientIp()}`, 5, 3600);
    if (!dentroDoLimite) {
      return { error: "Muitas tentativas de cadastro. Tente novamente mais tarde." };
    }
  }

  const officeId = randomUUID();
  const db = getDb();
  try {
    await db.query("SELECT start_lawyer_trial($1, $2, $3, $4)", [
      officeId,
      input.data.nome.trim(),
      cpfCnpjDigitos,
      input.data.planoId,
    ]);
    // A OAB nunca é aceita como confirmada aqui: fica pendente até um admin do escritório
    // checar manualmente contra o site oficial (cna.oab.org.br) e confirmar — ver /equipe.
    await db.query("SELECT set_own_oab($1, $2)", [input.data.oabNumero, input.data.oabUf]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("já existe cadastro profissional")) {
      redirect("/assinatura");
    }
    if (message.includes("offices_cpf_cnpj_key")) {
      return {
        error: "Já existe um cadastro profissional com este CPF/CNPJ. Contate o suporte.",
      };
    }
    console.error("[advogado/cadastro]", error);
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }

  // Integração com o Asaas é best-effort — o teste grátis já está liberado mesmo se isto falhar;
  // a cobrança real só passa a existir quando a Asaas gerar a primeira fatura, perto do fim do
  // trial (ver app/assinatura/actions.ts, buscarLinkPagamento).
  try {
    const plano = subscriptionPlans.find((p) => p.id === input.data.planoId)!;
    const identidade = await currentIdentity();
    if (identidade) {
      const cliente = await criarClienteAsaas({
        nome: input.data.nome.trim(),
        cpfCnpj: cpfCnpjDigitos,
        email: identidade.email,
      });
      const nextDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const assinatura = await criarAssinaturaAsaas({
        customerId: cliente.id,
        valor: plano.amountCents / 100,
        nextDueDate,
        cycle: ciclo(input.data.planoId),
        descricao: `Assinatura Júris Office — ${input.data.nome.trim()}`,
        externalReference: officeId,
      });
      await db.query("SELECT set_own_subscription_gateway($1, $2)", [cliente.id, assinatura.id]);
    }
  } catch (error) {
    console.error("[advogado/cadastro] falha ao integrar com Asaas", error);
  }

  redirect("/assinatura");
}
