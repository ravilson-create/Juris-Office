import { z } from "zod";

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCUMENTS_PER_CASE = 20;
export const MAX_FILE_NAME = 120;

/** Tipos aceitos: extensão → tipos MIME válidos. */
export const ALLOWED_DOCUMENT_TYPES: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_DOCUMENT_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

export const ALLOWED_TYPES_LABEL = "PDF, JPG, PNG, WEBP ou DOCX";

/** Remove caminho, caracteres de controle e espaços extras; limita o tamanho. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= MAX_FILE_NAME) return clean;
  const dot = clean.lastIndexOf(".");
  const ext = dot > 0 ? clean.slice(dot) : "";
  return clean.slice(0, MAX_FILE_NAME - ext.length) + ext;
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export const documentMetaSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1).max(500),
  size: z.number().int().nonnegative(),
  mimeType: z.string().max(200),
});
export type DocumentMeta = z.infer<typeof documentMetaSchema>;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

type Check = { ok: true; name: string } | { ok: false; error: string };

/**
 * Valida o arquivo antes de registrá-lo. Roda no navegador (resposta imediata)
 * e no servidor (fonte da verdade). Na fase F5 o Storage fará também a verificação do conteúdo.
 */
export function checkDocument(meta: Pick<DocumentMeta, "name" | "size" | "mimeType">): Check {
  const name = sanitizeFileName(meta.name);
  if (!name) return { ok: false, error: "O arquivo precisa ter um nome." };
  const ext = fileExtension(name);
  const mimes = ALLOWED_DOCUMENT_TYPES[ext];
  if (!mimes)
    return { ok: false, error: `Tipo de arquivo não aceito. Envie ${ALLOWED_TYPES_LABEL}.` };
  // Alguns navegadores não informam o tipo; nesse caso vale a extensão.
  if (meta.mimeType && !mimes.includes(meta.mimeType)) {
    return { ok: false, error: "O conteúdo do arquivo não corresponde à extensão informada." };
  }
  if (meta.size === 0) return { ok: false, error: "O arquivo está vazio." };
  if (meta.size > MAX_DOCUMENT_SIZE) {
    return { ok: false, error: `O arquivo tem ${formatFileSize(meta.size)}. O limite é 10 MB.` };
  }
  return { ok: true, name };
}
