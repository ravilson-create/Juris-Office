import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacidadePage() {
  return (
    <article className="mx-auto max-w-prose px-5 py-12">
      <h1 className="text-3xl">Privacidade e uso dos dados</h1>
      <div className="mt-6 flex flex-col gap-4">
        <p>
          O {APP_NAME} usa o que você digita (identificação, contato, respostas às perguntas e
          relato) para montar o dossiê do seu atendimento e permitir que o advogado responsável
          pelo seu caso o acesse. Dos documentos anexados, hoje são registrados apenas nome, tipo e
          tamanho: o envio do arquivo em si ainda não está disponível.
        </p>
        <p>
          Os dados ficam armazenados no banco de dados do sistema; rascunhos também ficam salvos
          até a finalização do atendimento. Um cookie liga os atendimentos a este navegador.
        </p>
        <p>
          Para apoiar o advogado responsável, um resumo do caso pode ser gerado por inteligência
          artificial a partir do dossiê. Esse processamento é feito por um serviço de terceiros
          (via Vercel AI Gateway) e o resumo gerado fica salvo junto ao caso.
        </p>
      </div>
    </article>
  );
}
