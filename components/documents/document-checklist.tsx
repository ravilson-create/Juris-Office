"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { addDocumentAction, removeDocumentAction } from "@/app/atendimento/actions";
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_TYPES_LABEL,
  checkDocument,
  formatFileSize,
} from "@/domain/document/rules";
import type { CaseDocument } from "@/domain/document/schema";
import { safeCall } from "@/lib/utils/safe-call";

export interface ChecklistEntry {
  category: string;
  label: string;
  description: string;
  recommended: boolean;
}

export function DocumentChecklist({
  caseId,
  entries,
  documents,
}: {
  caseId: string;
  entries: ChecklistEntry[];
  documents: CaseDocument[];
}) {
  const [announcement, setAnnouncement] = useState("");
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ul className="flex flex-col gap-4">
        {entries.map((entry) => (
          <ChecklistItem
            key={entry.category}
            caseId={caseId}
            entry={entry}
            documents={documents.filter((d) => d.category === entry.category)}
            onAnnounce={setAnnouncement}
          />
        ))}
      </ul>
    </>
  );
}

function ChecklistItem({
  caseId,
  entry,
  documents,
  onAnnounce,
}: {
  caseId: string;
  entry: ChecklistEntry;
  documents: CaseDocument[];
  onAnnounce: (message: string) => void;
}) {
  const router = useRouter();
  const inputId = useId();
  const errorId = `${inputId}-erro`;
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const sent = documents.length > 0;

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    startTransition(async () => {
      const problems: string[] = [];
      let added = 0;
      for (const file of list) {
        const meta = {
          category: entry.category,
          name: file.name,
          size: file.size,
          mimeType: file.type,
        };
        const local = checkDocument(meta);
        if (!local.ok) {
          problems.push(`${file.name}: ${local.error}`);
          continue;
        }
        const result = await safeCall(() => addDocumentAction(caseId, meta));
        if (result.ok) added += 1;
        else problems.push(`${file.name}: ${result.message}`);
      }
      setErrors(problems);
      if (added > 0) {
        onAnnounce(
          added === 1
            ? `1 documento registrado para simulação em ${entry.label}.`
            : `${added} documentos registrados para simulação em ${entry.label}.`,
        );
        router.refresh();
      }
    });
  };

  const onRemove = (doc: CaseDocument) => {
    startTransition(async () => {
      const result = await safeCall(() => removeDocumentAction(caseId, doc.id));
      if (result.ok) {
        onAnnounce(`${doc.originalName} removido.`);
        setErrors([]);
        router.refresh();
      } else {
        setErrors([result.message]);
      }
    });
  };

  return (
    <li
      className={`rounded-md border bg-surface p-5 ${sent ? "border-gold-strong/50" : "border-line"}`}
      aria-busy={pending || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-sans text-lg font-semibold">{entry.label}</h2>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            sent
              ? "bg-gold-soft text-gold-strong"
              : entry.recommended
                ? "bg-navy-soft text-navy"
                : "text-muted"
          }`}
        >
          {sent
            ? `Registrado (${documents.length})`
            : entry.recommended
              ? "Recomendado"
              : "Se tiver"}
        </span>
      </div>
      <p className="mt-1 text-muted">{entry.description}</p>

      {sent && (
        <ul className="mt-4 flex flex-col divide-y divide-line rounded-md border border-line">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{doc.originalName}</span>
                <span className="text-sm text-muted">
                  {doc.size !== undefined ? `${formatFileSize(doc.size)} · ` : ""}
                  Registrado para simulação; arquivo não recebido.
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(doc)}
                disabled={pending}
                className="shrink-0 rounded border border-danger px-3 py-1 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
              >
                Remover<span className="sr-only"> {doc.originalName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <div id={errorId} role="alert" className="mt-3 text-sm font-medium text-danger">
          <ul className="flex flex-col gap-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-4 py-2 font-medium text-navy hover:border-navy has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-strong"
        >
          {pending ? "Registrando…" : sent ? "Adicionar outro arquivo" : "Adicionar arquivo"}
          <span className="sr-only"> em {entry.label}</span>
          <input
            id={inputId}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            disabled={pending}
            aria-describedby={errors.length > 0 ? errorId : undefined}
            className="sr-only"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <p className="mt-1.5 text-sm text-muted">{ALLOWED_TYPES_LABEL}, até 10 MB cada.</p>
      </div>
    </li>
  );
}
