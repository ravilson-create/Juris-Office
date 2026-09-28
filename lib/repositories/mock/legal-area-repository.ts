import type { LegalAreaSlug } from "@/domain/legal-area/schema";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import type { LegalAreaRepository } from "../types";

export class MockLegalAreaRepository implements LegalAreaRepository {
  async list() {
    return LEGAL_AREAS.filter((a) => a.active).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  async findById(id: string) {
    return LEGAL_AREAS.find((a) => a.id === id) ?? null;
  }
  async findBySlug(slug: LegalAreaSlug) {
    return LEGAL_AREAS.find((a) => a.slug === slug) ?? null;
  }
}
