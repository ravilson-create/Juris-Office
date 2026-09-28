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
          <strong>Esta é uma versão de testes. Use apenas dados fictícios.</strong> Nenhuma
          informação é encaminhada a advogados ou escritórios, e ninguém entrará em contato.
        </p>
        <p>
          O {APP_NAME} usa o que você digita (identificação, contato, respostas às perguntas e
          relato) somente para montar o dossiê de demonstração deste atendimento. Dos documentos,
          registra apenas nome, tipo e tamanho: o arquivo em si não sai do seu aparelho.
        </p>
        <p>
          Os dados ficam só na memória do servidor de testes e são apagados quando ele é reiniciado.
          Rascunhos também ficam no servidor; nada é gravado no armazenamento permanente do seu
          navegador, além de um cookie que liga os atendimentos a este navegador.
        </p>
        <p>
          Os dados não são usados para treinar modelos de inteligência artificial. Não há
          inteligência artificial nesta versão.
        </p>
      </div>
    </article>
  );
}
