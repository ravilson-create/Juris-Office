import "server-only";
import { redirect } from "next/navigation";
import { requireFinancialAccess } from "@/lib/auth/financeiro-acesso";

/** Salários, CPF e contracheques visíveis somente ao admin do escritório. */
export async function requirePersonnelAccess() {
  const access = await requireFinancialAccess();
  if (access.role !== "admin") redirect("/equipe/financeiro");
  return access;
}
