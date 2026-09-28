import { describe, expect, it } from "vitest";
import { NARRATIVE_MAX, narrativeSchema } from "@/domain/case/narrative";
import {
  checkDocument,
  documentMetaSchema,
  fileExtension,
  formatFileSize,
  MAX_DOCUMENT_SIZE,
  sanitizeFileName,
} from "@/domain/document/rules";

describe("relato", () => {
  it("aceita relato com texto suficiente e remove espaços nas pontas", () => {
    const r = narrativeSchema.safeParse({
      narrative: "  A fatura veio com cobrança em dobro em maio.  ",
    });
    expect(r.success && r.data.narrative).toBe("A fatura veio com cobrança em dobro em maio.");
  });

  it("recusa relato curto demais, mesmo com espaços", () => {
    const r = narrativeSchema.safeParse({ narrative: `curto${" ".repeat(50)}` });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/mínimo de 30/);
  });

  it("recusa relato acima do limite", () => {
    expect(narrativeSchema.safeParse({ narrative: "a".repeat(NARRATIVE_MAX + 1) }).success).toBe(
      false,
    );
  });
});

describe("regras de documentos", () => {
  const ok = { name: "nota-fiscal.pdf", size: 120_000, mimeType: "application/pdf" };

  it("aceita PDF dentro do limite", () => {
    expect(checkDocument(ok)).toEqual({ ok: true, name: "nota-fiscal.pdf" });
  });

  it.each([
    [{ ...ok, name: "virus.exe", mimeType: "application/x-msdownload" }, /não aceito/],
    [{ ...ok, name: "foto.png", mimeType: "application/pdf" }, /não corresponde/],
    [{ ...ok, size: 0 }, /vazio/],
    [{ ...ok, size: MAX_DOCUMENT_SIZE + 1 }, /limite é 10 MB/],
    [{ ...ok, name: "   " }, /precisa ter um nome/],
  ])("recusa %o", (meta, message) => {
    const r = checkDocument(meta);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(message);
  });

  it("aceita arquivo sem tipo informado quando a extensão é válida", () => {
    expect(checkDocument({ ...ok, name: "FOTO.JPG", mimeType: "" }).ok).toBe(true);
  });

  it("limpa caminho e caracteres perigosos do nome", () => {
    expect(sanitizeFileName("C:\\Users\\ana\\docs\\con<tra>to?.pdf")).toBe("contrato.pdf");
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    const long = sanitizeFileName(`${"a".repeat(300)}.pdf`);
    expect(long.length).toBe(120);
    expect(long.endsWith(".pdf")).toBe(true);
  });

  it("extrai extensão e formata tamanho", () => {
    expect(fileExtension("Recibo.Final.PNG")).toBe("png");
    expect(fileExtension("semextensao")).toBe("");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3.5 * 1024 * 1024)).toBe("3,5 MB");
  });

  it("schema de metadados recusa tamanho negativo", () => {
    expect(
      documentMetaSchema.safeParse({ category: "x", name: "a.pdf", size: -1, mimeType: "" })
        .success,
    ).toBe(false);
  });
});
