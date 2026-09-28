import type { Dossier } from "@/domain/dossier/schema";
import type { DossierRepository } from "../types";
import type { MockStore } from "./store";

export class MockDossierRepository implements DossierRepository {
  constructor(private readonly store: MockStore) {}

  async save(dossier: Dossier): Promise<Dossier> {
    const list = this.store.dossiers.get(dossier.caseId) ?? [];
    list.push(structuredClone(dossier));
    this.store.dossiers.set(dossier.caseId, list);
    return structuredClone(dossier);
  }

  async findLatest(caseId: string): Promise<Dossier | null> {
    const list = this.store.dossiers.get(caseId);
    return list?.length ? structuredClone(list[list.length - 1]) : null;
  }
}
