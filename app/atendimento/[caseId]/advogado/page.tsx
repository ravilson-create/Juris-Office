import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaseHeader } from "@/components/case/case-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { BRAZIL_UFS } from "@/domain/case/schema";
import { firstIncompleteStep } from "@/domain/triage/engine";
import { getDb, hasDatabase } from "@/lib/db/connection";
import { escolherAdvogadoEFinalizarAction } from "@/app/atendimento/actions";
import { buscarAdvogadoEscolhido, listarAdvogadosDisponiveis } from "@/lib/services/advogados-disponiveis";
import { loadCaseOr404, redirectIfLocked } from "@/lib/services/load-case";

export const metadata: Metadata = { title: "Advogado" };
export const dynamic = "force-dynamic";

const MENSAGEM_ERRO: Record<string, string> = {
  advogado_indisponivel:
    "Esse advogado não está mais disponível para esta área. Escolha outro ou finalize sem escolher.",
};

export default async function EscolherAdvogadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ uf?: string; erro?: string }>;
}) {
  const { caseId } = await params;
  const { service, legalCase } = await loadCaseOr404(caseId);
  redirectIfLocked(legalCase);
  const base = `/atendimento/${caseId}`;
  if (!legalCase.applicant) redirect(`${base}/identificacao`);
  const ctx = await service.getReviewContext(caseId);
  if (!ctx) redirect(`${base}/triagem`);
  if (firstIncompleteStep(ctx.steps, ctx.answers) < ctx.steps.length) redirect(`${base}/triagem`);
  if (!legalCase.narrative) redirect(`${base}/relato`);
  if (legalCase.status === "awaiting_documents") redirect(`${base}/documentos`);
  // Diretório de advogados é recurso só do banco — sem ele, não há o que escolher aqui.
  if (!hasDatabase()) redirect(`${base}/revisar`);

  const { uf: ufBruta, erro } = await searchParams;
  const uf = BRAZIL_UFS.includes((ufBruta ?? "").toUpperCase() as (typeof BRAZIL_UFS)[number])
    ? ufBruta!.toUpperCase()
    : null;

  const db = getDb();
  const [jaEscolhido, advogados] = await Promise.all([
    buscarAdvogadoEscolhido(db, caseId),
    listarAdvogadosDisponiveis(db, ctx.area.id, uf),
  ]);

  return (
    <>
      <CaseHeader legalCase={ctx.legalCase} area={ctx.area} step="Advogado" />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p>
          <Link href={`${base}/revisar`}>Voltar à revisão</Link>
        </p>
        <h1 className="mt-4 text-3xl">Escolha um advogado</h1>
        <p className="mt-2 max-w-prose text-muted">
          Estes são os advogados cadastrados para {ctx.area.name.toLowerCase()}. É opcional — se
          preferir, finalize sem escolher e o atendimento segue para o escritório responsável
          decidir.
        </p>

        {erro && MENSAGEM_ERRO[erro] && (
          <div className="mt-6">
            <Alert tone="error" title="Não foi possível concluir.">
              {MENSAGEM_ERRO[erro]}
            </Alert>
          </div>
        )}

        {jaEscolhido && (
          <div className="mt-6">
            <Alert title="Advogado já escolhido">
              {jaEscolhido.escritorio} — escolher outro abaixo substitui essa escolha.
            </Alert>
          </div>
        )}

        <form className="mt-6 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="uf" className="block text-sm font-medium">
              Filtrar por estado (opcional)
            </label>
            <select id="uf" name="uf" defaultValue={uf ?? ""} className="mt-1 w-40 rounded border border-line p-2">
              <option value="">Todos os estados</option>
              {BRAZIL_UFS.map((sigla) => (
                <option key={sigla} value={sigla}>
                  {sigla}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded border border-line px-4 py-2 text-sm">Filtrar</button>
        </form>

        <ul className="mt-6 space-y-4">
          {advogados.map((advogado) => (
            <li
              key={advogado.lawyer_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-4"
            >
              <div>
                <p className="font-semibold">{advogado.escritorio}</p>
                <p className="mt-1 text-sm text-muted">
                  {advogado.cidade ? `${advogado.cidade}/${advogado.uf}` : "Localização não informada"}{" "}
                  · OAB {advogado.oab_numero}/{advogado.oab_uf}
                </p>
              </div>
              <form action={escolherAdvogadoEFinalizarAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="lawyerId" value={advogado.lawyer_id} />
                <button className="rounded bg-navy px-4 py-2 text-sm text-white">
                  Escolher e finalizar
                </button>
              </form>
            </li>
          ))}
        </ul>
        {advogados.length === 0 && (
          <p className="mt-6 text-muted">
            Nenhum advogado disponível {uf ? `em ${uf} ` : ""}para {ctx.area.name.toLowerCase()}{" "}
            no momento.
          </p>
        )}

        <div className="mt-10 border-t border-line pt-6">
          <ButtonLink href={`${base}/revisar`} variant="secondary">
            Finalizar sem escolher agora
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
