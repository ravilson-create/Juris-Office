import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Como funciona" };

const STEPS = [
  [
    "Área do problema",
    "Você escolhe o assunto que mais se parece com a sua situação. Se tiver dúvida, escolha o mais próximo.",
  ],
  [
    "Identificação",
    "Pedimos nome, e-mail, telefone e cidade para compor o dossiê. Nesta versão de testes, use dados fictícios: ninguém entrará em contato.",
  ],
  [
    "Perguntas guiadas",
    "Perguntas curtas sobre o que aconteceu. As respostas são salvas ao avançar, rascunhos são guardados enquanto você preenche, e você pode voltar para corrigir.",
  ],
  [
    "Relato e documentos",
    "Você conta a história com suas palavras e indica os documentos que tem. Nesta versão, só o nome, o tipo e o tamanho do arquivo são registrados; o arquivo não é recebido.",
  ],
  [
    "Revisão e protocolo",
    "Você confere tudo e finaliza. O sistema gera o dossiê e seu protocolo confidencial. Guarde esse número para consultar o andamento e as atualizações do advogado responsável.",
  ],
];

export default function ComoFuncionaPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl">Como funciona o atendimento</h1>
      <ol className="mt-8 flex flex-col gap-6">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="grid grid-cols-[2rem_1fr] gap-3">
            <span aria-hidden="true" className="font-serif text-2xl text-teal-strong">
              {i + 1}
            </span>
            <div>
              <h2 className="font-sans text-lg font-semibold">{title}</h2>
              <p className="text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <ButtonLink href="/atendimento" className="mt-10">
        Iniciar atendimento de teste
      </ButtonLink>
    </div>
  );
}
