import type { Dossier } from "@/domain/dossier/schema";
import type { Db } from "@/lib/db/types";
import type { DossierRepository } from "../types";

export class PgDossierRepository implements DossierRepository {
  constructor(private readonly db: Db) {}

  async save(dossier: Dossier): Promise<Dossier> {
    await this.db.query(
      `INSERT INTO dossiers (id, case_id, version, payload, created_at) VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [dossier.id, dossier.caseId, dossier.version, JSON.stringify(dossier), dossier.createdAt],
    );
    return dossier;
  }

  async findLatest(caseId: string): Promise<Dossier | null> {
    const rows = await this.db.query<{ payload: Dossier }>(
      `SELECT payload FROM dossiers WHERE case_id = $1 ORDER BY version DESC LIMIT 1`,
      [caseId],
    );
    return rows[0]?.payload ?? null;
  }
}
