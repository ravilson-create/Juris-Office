import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";

export default async function AssinaturaPage() {
  if (!(await currentUserId())) redirect("/auth/sign-in");
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <h1 className="text-3xl">Assinatura profissional</h1>
      <p className="mt-4">
        O acesso aos casos exige uma assinatura ativa. A contratação on-line ainda está em
        preparação; nenhum pagamento é cobrado por esta página.
      </p>
    </main>
  );
}
