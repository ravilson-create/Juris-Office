import type { ReactNode } from "react";
import { formatCivilDate } from "@/domain/time";
import type { Dossier } from "@/domain/dossier/schema";
import { DossierLetterhead } from "./dossier-letterhead";

function formatDate(civil?: string) {
  return civil ? formatCivilDate(civil) : "Sem data";
}

function formatPhone(digits: string) {
  return digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

/** Documento do dossiê: as 11 seções do plano, na ordem, prontas para tela e impressão. */
export function DossierView({ dossier }: { dossier: Dossier }) {
  const a = dossier.applicant;
  return (
    <article
      aria-label="Dossiê jurídico preliminar"
      className="rounded-md border border-line bg-surface p-5 sm:p-8 print:rounded-none print:border-0 print:p-0"
    >
      <DossierLetterhead
        title="Dossiê jurídico preliminar"
        protocol={dossier.protocol}
        areaName={dossier.areaName}
        date={dossier.createdAt}
        statusLabel="Gerado para demonstração"
        version={dossier.version}
      />

      <div className="mt-6 flex flex-col gap-7">
        <Section n={1} title="Identificação do interessado">
          <dl className="divide-y divide-line">
            <Row term="Nome" value={a.fullName} />
            <Row term="E-mail" value={a.email} />
            <Row term="Telefone" value={formatPhone(a.phone)} />
            <Row term="Cidade" value={`${a.city} / ${a.uf}`} />
          </dl>
        </Section>

        <Section n={2} title="Síntese do relato">
          <p className="leading-relaxed">{dossier.factsSummary}</p>
          {dossier.factsSummary !== dossier.narrative.replace(/\s+/g, " ").trim() && (
            <>
              <details className="mt-3 print:hidden">
                <summary className="cursor-pointer text-sm font-medium text-navy">
                  Ler o relato completo
                </summary>
                <p className="mt-2 whitespace-pre-line border-l-2 border-line pl-4 leading-relaxed">
                  {dossier.narrative}
                </p>
              </details>
              <div className="mt-3 hidden print:block">
                <p className="text-sm font-semibold">Relato completo</p>
                <p className="mt-1 whitespace-pre-line leading-relaxed">{dossier.narrative}</p>
              </div>
            </>
          )}
          <p className="mt-2 text-sm text-muted">
            Texto escrito pelo interessado, reproduzido sem alterações.
          </p>
        </Section>

        <Section n={3} title="Informações da triagem">
          <div className="flex flex-col gap-4">
            {dossier.triageSections.map((s) => (
              <div key={s.title}>
                <h3 className="break-after-avoid font-sans font-semibold">{s.title}</h3>
                <dl className="divide-y divide-line">
                  {s.items.map((i) => (
                    <Row
                      key={i.question}
                      term={i.question}
                      value={i.answer}
                      muted={i.answer === "Não informado"}
                    />
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Section>

        <Section n={4} title="Partes mencionadas">
          <List
            items={dossier.parties.map((p) => (
              <>
                <span className="font-medium">{p.name}</span>
                <span className="text-muted"> — {p.role}</span>
              </>
            ))}
            empty="Nenhuma parte identificada."
          />
        </Section>

        <Section n={5} title="Linha do tempo">
          {dossier.chronology.length === 0 ? (
            <Empty>Nenhuma data informada.</Empty>
          ) : (
            <ol className="flex flex-col gap-2 border-l-2 border-teal pl-4 print:border-black">
              {dossier.chronology.map((e, i) => (
                <li key={`${e.date}-${i}`} className="grid gap-x-4 sm:grid-cols-[7rem_1fr]">
                  <span className="font-medium tabular-nums">{formatDate(e.date)}</span>
                  <span>{e.description}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section n={6} title="Valores informados">
          {dossier.amounts.length === 0 ? (
            <Empty>Nenhum valor informado.</Empty>
          ) : (
            <dl className="divide-y divide-line">
              {dossier.amounts.map((v) => (
                <Row key={v.label} term={v.label} value={v.value} />
              ))}
            </dl>
          )}
        </Section>

        <Section n={7} title="Documentos">
          {dossier.documents.length === 0 ? (
            <Empty>Nenhum documento registrado.</Empty>
          ) : (
            <dl className="divide-y divide-line">
              {dossier.documents.map((d, i) => (
                <Row key={`${d.name}-${i}`} term={d.category} value={d.name} />
              ))}
            </dl>
          )}
        </Section>

        <Section n={8} title="Providências já tomadas">
          {dossier.actionsTaken.length === 0 ? (
            <Empty>Nenhuma providência informada.</Empty>
          ) : (
            <dl className="divide-y divide-line">
              {dossier.actionsTaken.map((x) => (
                <Row key={x.question} term={x.question} value={x.answer} />
              ))}
            </dl>
          )}
        </Section>

        <Section n={9} title="Informações ainda necessárias">
          <List items={dossier.missingInformation} empty="Nenhuma pendência identificada." />
        </Section>

        <Section n={10} title="Observações">
          <List items={dossier.observations} empty="Sem observações." />
        </Section>

        <Section n={11} title="Aviso de revisão profissional">
          <p className="rounded-md border-l-4 border-navy bg-navy-soft px-4 py-3 text-sm text-navy-strong print:border-black print:bg-transparent print:text-black">
            {dossier.disclaimer}
          </p>
        </Section>
      </div>
    </article>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`dossie-sec-${n}`}>
      <h2
        id={`dossie-sec-${n}`}
        className="mb-2 flex break-after-avoid items-baseline gap-2 border-b border-line pb-2 text-lg"
      >
        <span className="tabular-nums text-teal-strong print:text-black">{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ term, value, muted = false }: { term: string; value: string; muted?: boolean }) {
  return (
    <div className="grid break-inside-avoid gap-1 py-2.5 sm:grid-cols-[1fr_1fr] sm:gap-6">
      <dt className="text-sm text-muted">{term}</dt>
      <dd className={muted ? "text-muted" : ""}>{value}</dd>
    </div>
  );
}

function List({ items, empty }: { items: ReactNode[]; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted">{children}</p>;
}
