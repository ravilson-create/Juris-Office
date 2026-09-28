import { describe, expect, it } from "vitest";
import { documentChecklistItemSchema, OTHER_DOCUMENTS_CATEGORY } from "@/domain/document/schema";
import { DOCUMENT_CHECKLISTS } from "@/lib/mocks/document-checklists";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";

describe.each(LEGAL_AREAS.map((a) => [a.name, a] as const))("checklist de %s", (_n, area) => {
  const items = DOCUMENT_CHECKLISTS.filter((i) => i.legalAreaId === area.id);

  it("tem itens válidos, com ao menos um recomendado", () => {
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const i of items) expect(documentChecklistItemSchema.safeParse(i).success).toBe(true);
    expect(items.some((i) => i.recommended)).toBe(true);
  });

  it("tem categorias únicas e não usa a categoria reservada", () => {
    const cats = items.map((i) => i.category);
    expect(new Set(cats).size).toBe(cats.length);
    expect(cats).not.toContain(OTHER_DOCUMENTS_CATEGORY);
  });
});

it("IDs de checklist são únicos entre áreas", () => {
  const ids = DOCUMENT_CHECKLISTS.map((i) => i.id);
  expect(new Set(ids).size).toBe(ids.length);
});
