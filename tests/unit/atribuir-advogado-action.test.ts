import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), assign: vi.fn(), revalidate: vi.fn(), db: {} }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/auth/session", () => ({ currentUserId: mocks.actor, authEnabled: false }));
vi.mock("@/lib/db/connection", () => ({ getDb: () => mocks.db, hasDatabase: () => false }));
vi.mock("@/lib/services/equipe-atribuicao", () => ({ atribuirAdvogado: mocks.assign }));
const { assignLawyer } = await import("@/app/equipe/actions");
afterEach(() => vi.resetAllMocks());
function form() {
  const f = new FormData();
  f.set("caseId", "11111111-1111-4111-8111-111111111111");
  f.set("lawyerId", "lawyer-1");
  return f;
}
describe("atribuição não derruba a página quando o banco recusa", () => {
  it("converte recusa RLS em aviso na fila", async () => {
    mocks.actor.mockResolvedValue("admin");
    mocks.assign.mockRejectedValue(Object.assign(new Error("RLS"), { code: "42501" }));
    await expect(assignLawyer(form())).rejects.toThrow("REDIRECT:/equipe?atribuicao=indisponivel");
  });
  it("informa sucesso e recarrega a fila depois da atribuição", async () => {
    mocks.actor.mockResolvedValue("admin");
    mocks.assign.mockResolvedValue("ok");
    await expect(assignLawyer(form())).rejects.toThrow("REDIRECT:/equipe?atribuicao=ok");
    expect(mocks.revalidate).toHaveBeenCalledWith("/equipe");
  });
  it("reenvio idempotente informa atribuição existente", async () => {
    mocks.actor.mockResolvedValue("admin");
    mocks.assign.mockResolvedValue("existente");
    await expect(assignLawyer(form())).rejects.toThrow("REDIRECT:/equipe?atribuicao=existente");
  });
  it("formulário inválido e visitante não executam atribuição", async () => {
    mocks.actor.mockResolvedValue("admin");
    await expect(assignLawyer(new FormData())).rejects.toThrow(
      "REDIRECT:/equipe?atribuicao=indisponivel",
    );
    mocks.actor.mockResolvedValue(null);
    await expect(assignLawyer(form())).rejects.toThrow("REDIRECT:/auth/sign-in");
    expect(mocks.assign).not.toHaveBeenCalled();
  });
});
