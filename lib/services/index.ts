import "server-only";
import { getRepositories } from "@/lib/repositories";
import { CaseService } from "./case-service";

export function getCaseService(): CaseService {
  return new CaseService(getRepositories());
}
