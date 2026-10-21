import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";

let pathname = "/equipe";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode } & Omit<ComponentProps<"a">, "href" | "children">) =>
    <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/components/brand/brand-logo", () => ({ BrandLogo: () => <span>Júris Office IA</span> }));

const { EquipeShell } = await import("@/components/layout/equipe-shell");

afterEach(() => {
  cleanup();
  pathname = "/equipe";
  document.body.style.overflow = "";
});

describe("navegação da área do advogado em telas pequenas e grandes", () => {
  it("apresenta menu hambúrguer e permite abrir/fechar com Escape, restaurando foco", () => {
    render(<EquipeShell email="advogado@example.com" officeName="Escritório Teste" role="lawyer"><div>Conteúdo dos casos</div></EquipeShell>);
    const open = screen.getByRole("button", { name: "Abrir menu de navegação" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(open);
    const dialog = screen.getByRole("dialog", { name: "Menu de navegação profissional" });
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Fechar menu" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(open).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("navega pelas abas e fecha a gaveta pelo link ou pelo fundo", () => {
    render(<EquipeShell email="advogado@example.com" officeName="Escritório Teste" role="lawyer"><div>Conteúdo</div></EquipeShell>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de navegação" }));
    const dialog = screen.getByRole("dialog");
    const nav = within(dialog).getByRole("navigation", { name: "Menu do advogado" });
    for (const item of ["Atendimentos", "Contratos", "Financeiro", "Consultas jurídicas"]) {
      expect(within(nav).getByRole("link", { name: item })).toBeInTheDocument();
    }
    expect(within(nav).queryByRole("link", { name: "Equipe" })).not.toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("link", { name: "Consultas jurídicas" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de navegação" }));
    fireEvent.click(screen.getByRole("button", { name: "Fechar menu pela área externa" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserva itens exclusivos de administradores e não duplica destaque em subabas", () => {
    pathname = "/equipe/financeiro/pessoal";
    render(<EquipeShell email="admin@example.com" officeName="Escritório Teste" role="admin"><div>Folha</div></EquipeShell>);
    const nav = screen.getByRole("navigation", { name: "Navegação do escritório" });
    expect(within(nav).getByRole("link", { name: "Pessoal e folha" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Financeiro" })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: "Minha assinatura" })).toHaveAttribute("href", "/assinatura");
    expect(within(nav).getByRole("link", { name: "Equipe" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Assinaturas de advogados" })).not.toBeInTheDocument();
  });

  it("recolhe e expande a barra lateral no desktop sem perder o conteúdo", () => {
    render(<EquipeShell email="admin@example.com" role="admin" officeName="Meu escritório" isAppOwner><p>Painel preservado</p></EquipeShell>);
    const button = screen.getByRole("button", { name: "Recolher menu lateral" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Expandir menu lateral" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Painel preservado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expandir menu lateral" }));
    expect(screen.getByRole("button", { name: "Recolher menu lateral" })).toHaveAttribute("aria-expanded", "true");
    const nav = screen.getByRole("navigation", { name: "Navegação do escritório" });
    expect(within(nav).getByRole("link", { name: "Assinaturas de advogados" })).toHaveAttribute("href", "/equipe/assinaturas");
  });
});
