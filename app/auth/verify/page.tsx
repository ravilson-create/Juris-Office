import Link from "next/link";
import { VerifyForm } from "./verify-form";

export default function VerifyPage() {
  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-3xl">Confirme seu e-mail</h1>
      <p className="mt-4 text-muted">
        Digite o e-mail usado no cadastro e o código enviado para sua caixa de entrada.
      </p>
      <VerifyForm />
      <p className="mt-6 text-sm">
        Já confirmou?{" "}
        <Link href="/auth/sign-in" className="underline">
          Entre na sua conta
        </Link>
        .
      </p>
    </main>
  );
}
