export function paidPeriodEnd(dueDate: string, plan: "monthly" | "yearly") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Data de cobrança inválida");
  const [y, m, d] = dueDate.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + (plan === "yearly" ? 12 : 1), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(d, last));
  return end;
}
