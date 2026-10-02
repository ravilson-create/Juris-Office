import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DossierView } from "@/components/dossier/dossier-view";
import { PrintButton } from "@/components/dossier/print-button";
import { Alert } from "@/components/ui/alert";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { CASE_STATUS_LABEL } from "@/domain/case/status";
import { listarPrazosPorCaso } from "@/lib/services/equipe-prazos";
import { buscarViabilidade } from "@/lib/services/equipe-contratos";
import { registrarLeituraCaso } from "@/lib/services/auditoria";
import { aiEnabled } from "@/lib/ai/client";
import { buscarResumoIA } from "@/lib/services/resumo-ia";
import {
  addCaseNote,
  concluirPrazoAction,
  criarPrazoAction,
  gerarResumoIAAction,
  registrarViabilidadeAction,
} from "../actions";

const ROTULO_STATUS_PRAZO: Record<string, string> = {
  open: "Em aberto",
  done: "Concluído",
  missed: "Vencido",
};

const ROTULO_RISCO: Record<string, string> = { low: "Baixo", medium: "Médio", high: "Alto" };
const ROTULO_DECISAO: Record<string, string> = {
  accepted: "Causa aceita",
  rejected: "Causa não aceita",
  needs_info: "Aguardando mais informações",
};
const MENSAGEM_ERRO: Record<string, string> = {
  viabilidade_dados: "Preencha todos os campos da decisão de viabilidade.",
  viabilidade_transicao:
    "Não é possível registrar essa decisão com o caso no status atual — confira a aba de status.",
  ia_limite: "Muitos resumos gerados para este caso em pouco tempo. Aguarde e tente de novo.",
  ia_falhou: "Não foi possível gerar o resumo agora. Tente novamente em instantes.",
};

export const dynamic = "force-dynamic";
export default async function CasoEquipe({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const { caseId } = await params;
  if (!z.uuid().safeParse(caseId).success) notFound();
  const profile = await getDb().query<{ role: string }>(
    "SELECT role FROM profiles WHERE user_id = $1",
    [actor],
  );
  if (!profile[0] || !["lawyer", "admin"].includes(profile[0].role)) notFound();
  if (profile[0].role === "lawyer") {
    const active = await getDb().query(
      "SELECT 1 FROM lawyer_subscriptions WHERE lawyer_id = $1 AND status IN ('active', 'trial') AND valid_until > now()",
      [actor],
    );
    if (!active.length) redirect("/assinatura");
    const oab = await getDb().query<{ oab_verificado_em: Date | null }>(
      "SELECT oab_verificado_em FROM profiles WHERE user_id = $1",
      [actor],
    );
    if (!oab[0]?.oab_verificado_em) redirect("/advogado/pendente");
  }
  // A política RLS é o filtro definitivo: IDs de outro escritório/sem atribuição retornam vazio.
  const submission = await getCaseService().getSubmission(caseId);
  if (!submission) notFound();
  // Cada carregamento desta página é um acesso real a dado sensível do caso — fica registrado
  // mesmo quando a pessoa só está consultando, não mudando nada (ver lib/services/auditoria.ts).
  await registrarLeituraCaso(getDb(), { actor, caseId });
  const notes = await getDb().query<{
    id: string;
    body: string;
    author_id: string;
    created_at: Date;
  }>(
    "SELECT id, body, author_id, created_at FROM case_notes WHERE case_id = $1 ORDER BY created_at DESC LIMIT 100",
    [caseId],
  );
  const prazos = await listarPrazosPorCaso(getDb(), caseId);
  const viabilidade = await buscarViabilidade(getDb(), caseId);
  const resumoIA = await buscarResumoIA(getDb(), caseId);
  const { erro } = await searchParams;
  const hojeISO = new Date().toISOString().slice(0, 10);
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex justify-between print:hidden">
        <Link href="/equipe">Voltar</Link>
        <div className="flex gap-4">
          <Link href={`/equipe/${caseId}/peticao`} className="underline">
            Petição inicial
          </Link>
          <Link href={`/equipe/${caseId}/contrato`} className="underline">
            Contrato
          </Link>
          <PrintButton />
        </div>
      </div>
      <DossierView dossier={submission.dossier} />

      {erro && MENSAGEM_ERRO[erro] && (
        <div className="mt-6 print:hidden">
          <Alert tone="error" title="Não foi possível salvar.">
            {MENSAGEM_ERRO[erro]}
          </Alert>
        </div>
      )}

      {aiEnabled() && (
        <section
          className="mt-10 border-t border-line pt-6 print:hidden"
          aria-labelledby="resumo-ia-title"
        >
          <h2 id="resumo-ia-title" className="text-2xl">
            Resumo com IA
          </h2>
          <p className="mt-2 text-sm text-muted">
            Gerado a partir do dossiê acima — organiza o que já foi informado, não avalia mérito
            nem substitui a leitura do dossiê. Confira os fatos no documento original antes de
            decidir.
          </p>

          {resumoIA && (
            <div className="mt-4 space-y-3 rounded-md border border-line bg-surface p-4">
              <p className="text-xs text-muted">
                Gerado em{" "}
                {new Date(resumoIA.gerado_em).toLocaleString("pt-BR", {
                  timeZone: "America/Fortaleza",
                })}
              </p>
              <p>{resumoIA.sintese}</p>
              <div>
                <p className="font-semibold">O que o cidadão pede</p>
                <p className="text-sm">{resumoIA.pedido_principal}</p>
              </div>
              <div>
                <p className="font-semibold">Pontos-chave</p>
                <ul className="list-disc pl-5 text-sm">
                  {resumoIA.pontos_chave.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
              {resumoIA.documentos_faltantes.length > 0 && (
                <div>
                  <p className="font-semibold">Documentos faltantes</p>
                  <ul className="list-disc pl-5 text-sm">
                    {resumoIA.documentos_faltantes.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {resumoIA.riscos_aparentes.length > 0 && (
                <div>
                  <p className="font-semibold">Riscos aparentes</p>
                  <ul className="list-disc pl-5 text-sm">
                    {resumoIA.riscos_aparentes.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <form action={gerarResumoIAAction} className="mt-4">
            <input type="hidden" name="caseId" value={caseId} />
            <button className="rounded border border-line px-4 py-2 text-sm">
              {resumoIA ? "Gerar resumo de novo" : "Gerar resumo com IA"}
            </button>
          </form>
        </section>
      )}

      <section
        className="mt-10 border-t border-line pt-6 print:hidden"
        aria-labelledby="viabilidade-title"
      >
        <h2 id="viabilidade-title" className="text-2xl">
          Viabilidade da causa
        </h2>
        <p className="mt-2 text-sm text-muted">
          Status atual do caso: <strong>{CASE_STATUS_LABEL[submission.legalCase.status]}</strong>
        </p>

        {viabilidade && (
          <div className="mt-4 rounded-md border border-line bg-surface p-4">
            <p className="font-semibold">{ROTULO_DECISAO[viabilidade.decision]}</p>
            <p className="mt-1 text-sm text-muted">
              Risco: {ROTULO_RISCO[viabilidade.risk]} ·{" "}
              {new Date(viabilidade.decidedAt).toLocaleString("pt-BR", {
                timeZone: "America/Fortaleza",
              })}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{viabilidade.feasibilityNote}</p>
          </div>
        )}

        <form action={registrarViabilidadeAction} className="mt-5 space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <div className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="decisao" className="block text-sm font-medium">
                Decisão
              </label>
              <select id="decisao" name="decisao" className="mt-1 rounded border border-line p-2">
                <option value="accepted">Aceitar a causa</option>
                <option value="rejected">Não aceitar</option>
                <option value="needs_info">Pedir mais informações</option>
              </select>
            </div>
            <div>
              <label htmlFor="risco" className="block text-sm font-medium">
                Risco
              </label>
              <select id="risco" name="risco" className="mt-1 rounded border border-line p-2">
                <option value="low">Baixo</option>
                <option value="medium">Médio</option>
                <option value="high">Alto</option>
              </select>
            </div>
          </div>
          <label htmlFor="nota" className="block text-sm font-medium">
            Nota de viabilidade
          </label>
          <textarea
            id="nota"
            name="nota"
            required
            maxLength={4000}
            rows={3}
            defaultValue={viabilidade?.feasibilityNote}
            className="w-full rounded border border-line p-3"
          />
          <button className="rounded bg-navy px-4 py-2 text-white">Registrar decisão</button>
        </form>
      </section>

      <section
        className="mt-10 border-t border-line pt-6 print:hidden"
        aria-labelledby="prazos-title"
      >
        <h2 id="prazos-title" className="text-2xl">
          Prazos
        </h2>
        <form action={criarPrazoAction} className="mt-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <div>
            <label htmlFor="tipo" className="block text-sm font-medium">
              Tipo de prazo
            </label>
            <input
              id="tipo"
              name="tipo"
              required
              maxLength={160}
              placeholder="Ex.: recurso, manifestação"
              className="mt-1 rounded border border-line p-2"
            />
          </div>
          <div>
            <label htmlFor="dataInicio" className="block text-sm font-medium">
              Contar a partir de
            </label>
            <input
              id="dataInicio"
              name="dataInicio"
              type="date"
              defaultValue={hojeISO}
              required
              className="mt-1 rounded border border-line p-2"
            />
          </div>
          <div>
            <label htmlFor="dias" className="block text-sm font-medium">
              Dias
            </label>
            <input
              id="dias"
              name="dias"
              type="number"
              min={1}
              max={3650}
              defaultValue={15}
              required
              className="mt-1 w-20 rounded border border-line p-2"
            />
          </div>
          <div>
            <label htmlFor="regra" className="block text-sm font-medium">
              Contagem
            </label>
            <select id="regra" name="regra" className="mt-1 rounded border border-line p-2">
              <option value="business_days">Dias úteis</option>
              <option value="calendar_days">Dias corridos</option>
            </select>
          </div>
          <button className="rounded bg-navy px-4 py-2 text-white">Adicionar prazo</button>
        </form>
        <p className="mt-2 text-xs text-muted">
          &ldquo;Dias úteis&rdquo; pula só sábado e domingo — não conhece feriado nacional,
          estadual nem forense. Confira a data sugerida antes de confiar nela.
        </p>

        <ul className="mt-6 space-y-3">
          {prazos.map((p) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded border p-4 ${
                p.status === "missed"
                  ? "border-danger bg-danger-soft"
                  : p.status === "open" && p.due_date <= hojeISO
                    ? "border-danger"
                    : "border-line"
              }`}
            >
              <div>
                <p className="font-semibold">{p.type}</p>
                <p className="text-sm text-muted">
                  Vence em {new Date(p.due_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}{" "}
                  · {ROTULO_STATUS_PRAZO[p.status] ?? p.status}
                </p>
              </div>
              {p.status !== "done" && (
                <form action={concluirPrazoAction}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="deadlineId" value={p.id} />
                  <button className="rounded border border-line px-3 py-2 text-sm">
                    Concluir
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {prazos.length === 0 && <p className="mt-5 text-muted">Nenhum prazo registrado.</p>}
      </section>

      <section
        className="mt-10 border-t border-line pt-6 print:hidden"
        aria-labelledby="notas-title"
      >
        <h2 id="notas-title" className="text-2xl">
          Notas internas
        </h2>
        <p className="mt-2 text-sm text-muted">
          Visíveis apenas aos profissionais com acesso a este caso.
        </p>
        <form action={addCaseNote} className="mt-5 space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <label htmlFor="nota" className="block font-medium">
            Nova nota
          </label>
          <textarea
            id="nota"
            name="body"
            required
            maxLength={4000}
            rows={4}
            className="w-full rounded border border-line p-3"
          />
          <button className="rounded bg-navy px-4 py-2 text-white">Salvar nota</button>
        </form>
        <ul className="mt-6 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded border border-line p-4">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-2 text-xs text-muted">
                {note.author_id} ·{" "}
                {new Date(note.created_at).toLocaleString("pt-BR", {
                  timeZone: "America/Fortaleza",
                })}
              </p>
            </li>
          ))}
        </ul>
        {notes.length === 0 && <p className="mt-5 text-muted">Ainda não há notas neste caso.</p>}
      </section>
    </main>
  );
}
