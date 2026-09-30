import { ConsultForm } from "./consult-form";
export const metadata = { title: "Consultar atendimento", robots: { index: false, follow: false } };
export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl">Acompanhe sua solicitação</h1>
      <p className="mt-4 text-muted">
        Informe o número do protocolo recebido ao finalizar seu atendimento. Não é necessário criar
        conta ou pagar assinatura.
      </p>
      <ConsultForm />
    </main>
  );
}
