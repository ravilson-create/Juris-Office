import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacidadePage() {
  return (
    <article className="mx-auto max-w-prose px-5 py-12">
      <h1 className="text-3xl">Privacidade e uso dos dados</h1>
      <p className="mt-2 text-sm text-muted">
        Texto provisório da versão de testes. Será revisado juridicamente antes do lançamento.
      </p>
      <div className="mt-6 flex flex-col gap-4">
        <p>
          <strong>Esta é uma versão de testes. Use apenas dados fictícios.</strong> O advogado
          responsável pode acessar o atendimento atribuído a ele.
        </p>
        <p>
          O {APP_NAME} usa o que você digita (identificação, contato, respostas às perguntas e
          relato) para organizar o atendimento e permitir sua análise pelo advogado responsável. Dos
          documentos, registra apenas nome, tipo e tamanho: o arquivo em si não sai do seu aparelho.
        </p>
        <p>
          Os dados são armazenados no banco de dados do sistema. Rascunhos também ficam no servidor;
          cookies de sessão ligam seus atendimentos a este navegador. Guarde o protocolo: ele
          permite consultar o andamento sem cadastro e deve ser compartilhado apenas com o advogado
          responsável.
        </p>
        <p>
          Os dados não são usados para treinar modelos de inteligência artificial. Não há
          inteligência artificial nesta versão.
        </p>
      </div>
    </article>
  );
}
