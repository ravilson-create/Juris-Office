export const subscriptionPlans = [
  { id: "monthly", label: "Mensal", amountCents: 3990, interval: "mês" },
  { id: "yearly", label: "Anual", amountCents: 30000, interval: "ano" },
] as const;

export function formatPlanPrice(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
}
