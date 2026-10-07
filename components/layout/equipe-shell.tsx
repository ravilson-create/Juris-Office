"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { APP_NAME } from "@/lib/config";

type ItemNav = { href: string; label: string };

const NAV_BASE: ItemNav[] = [
  { href: "/equipe", label: "Atendimento" },
  { href: "/equipe/contratos", label: "Contratos" },
  { href: "/equipe/consultas", label: "Consultas externas" },
];

const NAV_ADMIN: ItemNav[] = [\n  { href: "/equipe/time", label: "Equipe" },\n  { href: "/assinatura", label: "Minha assinatura" },\n];
const NAV_APP_OWNER: ItemNav[] = [{ href: "/equipe/assinaturas", label: "Assinaturas de advogados" }];

function iniciais(email: string): string {
  const nome = email.split("@")[0] ?? email;
  const partes = nome.split(/[._-]/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : nome.slice(0, 2);
  return letras.toUpperCase();
}

/**
 * Casca visual só da área profissional (/equipe): barra lateral + topo, no estilo "SaaS jurídico"
 * escolhido no redesign. Cada página continua dona da própria checagem de papel/assinatura/OAB —
 * esta casca só decide o que mostrar na navegação (admin vê mais itens) e não substitui nenhuma
 * delas. Client Component só por causa do destaque do item ativo (usePathname); os dados vêm
 * prontos do layout de servidor.
 */
export function EquipeShell({
  email,
  role,
  officeName,
  isAppOwner = false,
  children,
}: {
  email: string;
  role: "lawyer" | "admin" | "staff";
  officeName: string;
  /** Administrador do aplicativo (dono da plataforma) — item de navegação à parte do admin de
   * escritório, só para quem bate o e-mail configurado (ver lib/auth/bootstrap-admin.ts). */
  isAppOwner?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const nav = [
    ...NAV_BASE,
    ...(role === "admin" ? NAV_ADMIN : []),
    ...(isAppOwner ? NAV_APP_OWNER : []),
  ];

  return (
    <div className="flex min-h-dvh w-full">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface p-4 print:hidden">
        <Link href="/equipe" className="px-1.5 no-underline" aria-label={`${APP_NAME} — Fila`}>
          <BrandLogo size="sm" />
        </Link>
        <nav aria-label="Área profissional" className="flex flex-col gap-0.5">
          {nav.map((item) => {
            const ativo =
              item.href === "/equipe" ? pathname === "/equipe" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={`rounded-lg px-3.5 py-2.5 text-sm ${
                  ativo
                    ? "bg-navy-soft font-bold text-navy-strong"
                    : "font-medium text-muted hover:bg-paper hover:text-navy"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-lg border border-line bg-paper p-3.5">
          <p className="truncate text-xs font-bold text-ink">{officeName || APP_NAME}</p>
          <p className="mt-0.5 text-xs text-muted">
            {role === "admin" ? "Administrador" : role === "lawyer" ? "Advogado" : "Administrativo"}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-end gap-3 border-b border-line bg-surface px-7 print:hidden">
          <span className="text-sm font-medium text-muted">{email}</span>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white"
          >
            {iniciais(email)}
          </span>
          <form action={signOut}>
            <button className="text-sm font-medium text-muted hover:text-navy">Sair</button>
          </form>
        </header>
        {/* Não é <main>: a página renderiza o próprio <main>; o layout raiz já tem o landmark principal. */}
        <div className="flex-1 bg-paper">{children}</div>
      </div>
    </div>
  );
}
