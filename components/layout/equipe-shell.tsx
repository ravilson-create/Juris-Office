"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { APP_NAME } from "@/lib/config";

type NavIcon = "inbox" | "contract" | "wallet" | "search" | "payroll" | "users" | "subscription" | "settings";
type ItemNav = { href: string; label: string; icon: NavIcon };
type NavGroup = { title: string; items: ItemNav[] };

const NAV_BASE: ItemNav[] = [
  { href: "/equipe", label: "Atendimentos", icon: "inbox" },
  { href: "/equipe/contratos", label: "Contratos", icon: "contract" },
  { href: "/equipe/financeiro", label: "Financeiro", icon: "wallet" },
  { href: "/equipe/consultas", label: "Consultas jurídicas", icon: "search" },
];
const NAV_ADMIN: ItemNav[] = [
  { href: "/equipe/financeiro/pessoal", label: "Pessoal e folha", icon: "payroll" },
  { href: "/equipe/time", label: "Equipe", icon: "users" },
  { href: "/assinatura", label: "Minha assinatura", icon: "subscription" },
];
const NAV_APP_OWNER: ItemNav[] = [
  { href: "/equipe/assinaturas", label: "Assinaturas de advogados", icon: "settings" },
];

function NavGlyph({ icon }: { icon: NavIcon }) {
  const paths: Record<NavIcon, ReactNode> = {
    inbox: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 14h5l2 3h4l2-3h5" /></>,
    contract: <><path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    wallet: <><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 10V5a2 2 0 0 1 2-2h12M16 15h5" /><circle cx="16" cy="15" r="1" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    payroll: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h2M14 12h2M8 16h2M14 16h2" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" /></>,
    subscription: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0">
      {paths[icon]}
    </svg>
  );
}

function HamburgerGlyph() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 5l14 14M19 5 5 19" />
    </svg>
  );
}

function initials(email: string): string {
  const name = email.split("@")[0] ?? email;
  const parts = name.split(/[._-]/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function roleLabel(role: "lawyer" | "admin" | "staff"): string {
  return role === "admin" ? "Administrador" : role === "lawyer" ? "Advogado" : "Administrativo";
}

function matchesPath(pathname: string, href: string) {
  return pathname === href || (href !== "/equipe" && pathname.startsWith(href + "/"));
}

function SidebarLinks({
  groups,
  pathname,
  onNavigate,
  label,
}: {
  groups: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
  label: string;
}) {
  // A aba mais específica prevalece (ex.: Pessoal e folha não destaca também Financeiro).
  const activeHref = groups.flatMap((group) => group.items)
    .filter((item) => matchesPath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label={label} className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[.12em] text-muted">
            {group.title}
          </p>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = activeHref === item.href;
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                    className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold no-underline transition-colors ${active
                      ? "bg-navy-soft text-navy-strong shadow-sm"
                      : "text-muted hover:bg-paper hover:text-navy"}`}>
                    <span className={active ? "text-navy" : "text-muted group-hover:text-navy"}>
                      <NavGlyph icon={item.icon} />
                    </span>
                    <span>{item.label}</span>
                    {active && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-navy" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Navegação profissional responsiva. Desktop: barra lateral retrátil pelo hambúrguer;
 * celular: gaveta modal com fundo escurecido, Escape, trava de foco e rolagem.
 * Os itens continuam filtrados pelo papel definido exclusivamente no layout do servidor.
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
  isAppOwner?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/equipe";
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLElement>(null);
  const groups: NavGroup[] = [
    { title: "Escritório", items: NAV_BASE },
    ...(role === "admin" ? [{ title: "Administração", items: NAV_ADMIN }] : []),
    ...(isAppOwner ? [{ title: "Gestão da plataforma", items: NAV_APP_OWNER }] : []),
  ];
  const activeSection = groups.flatMap((group) => group.items)
    .filter((item) => matchesPath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? "Área profissional";

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileCloseRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !mobileDialogRef.current) return;
      const focusable = [...mobileDialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !mobileDialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !mobileDialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      mobileToggleRef.current?.focus();
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-dvh w-full min-w-0 bg-paper">
      <aside id="equipe-sidebar"
        className={`hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-4 pb-5 pt-6 shadow-sm print:hidden lg:sticky lg:top-0 ${desktopOpen ? "lg:flex" : "lg:hidden"}`}>
        <Link href="/equipe" className="px-2 no-underline" aria-label={`${APP_NAME} — início da área profissional`}>
          <BrandLogo size="sm" />
        </Link>
        <p className="mb-6 mt-3 px-2 text-xs text-muted">Seu escritório em um só lugar</p>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <SidebarLinks groups={groups} pathname={pathname} label="Navegação do escritório" />
        </div>
        <div className="mt-4 rounded-xl border border-line bg-paper p-3.5">
          <p className="truncate text-sm font-bold text-ink">{officeName || APP_NAME}</p>
          <p className="mt-1 text-xs text-muted">{roleLabel(role)}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-line bg-surface/95 px-3 py-2 shadow-sm backdrop-blur print:hidden sm:px-6">
          <button ref={mobileToggleRef} type="button"
            aria-label="Abrir menu de navegação" aria-controls="equipe-mobile-nav" aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-navy hover:bg-navy-soft lg:hidden">
            <HamburgerGlyph />
          </button>
          <button type="button" aria-label={desktopOpen ? "Recolher menu lateral" : "Expandir menu lateral"}
            aria-controls="equipe-sidebar" aria-expanded={desktopOpen}
            onClick={() => setDesktopOpen((value) => !value)}
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-navy hover:bg-navy-soft lg:inline-flex">
            <HamburgerGlyph />
          </button>
          <Link href="/equipe" className="min-w-0 shrink-0 no-underline lg:hidden" aria-label="Ir para atendimentos">
            <BrandLogo size="sm" />
          </Link>
          <div className="hidden min-w-0 sm:block lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted">Portal profissional</p>
            <p className="truncate text-sm font-bold text-ink">{activeSection}</p>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-52 truncate text-sm font-medium text-muted md:block" title={email}>{email}</span>
            <span aria-label={roleLabel(role)} title={roleLabel(role)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
              {initials(email)}
            </span>
            <form action={signOut} className="hidden sm:block">
              <button type="submit" className="min-h-11 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-paper hover:text-navy">
                Sair
              </button>
            </form>
          </div>
        </header>
        {/* Preserva o <main> das páginas internas. Em telas estreitas, tabelas largas podem rolar. */}
        <div className="min-w-0 w-full flex-1 overflow-x-auto bg-paper">{children}</div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <button type="button" aria-label="Fechar menu pela área externa"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-slate-950/55" />
          <aside id="equipe-mobile-nav" ref={mobileDialogRef} role="dialog" aria-modal="true"
            aria-label="Menu de navegação profissional"
            className="absolute inset-y-0 left-0 flex w-[min(21rem,88vw)] flex-col border-r border-line bg-surface px-4 pb-5 pt-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Link href="/equipe" onClick={() => setMobileOpen(false)} className="min-w-0 no-underline" aria-label="Ir para atendimentos">
                <BrandLogo size="sm" />
              </Link>
              <button ref={mobileCloseRef} type="button" aria-label="Fechar menu"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink hover:bg-paper">
                <CloseGlyph />
              </button>
            </div>
            <p className="mb-5 px-2 text-xs text-muted">Escolha uma área do escritório</p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarLinks groups={groups} pathname={pathname} onNavigate={() => setMobileOpen(false)}
                label="Menu do advogado" />
            </div>
            <div className="mt-3 rounded-xl border border-line bg-paper p-3">
              <p className="truncate text-sm font-semibold text-ink">{officeName || APP_NAME}</p>
              <p className="mt-1 text-xs text-muted">{roleLabel(role)}</p>
            </div>
            <form action={signOut} className="mt-3">
              <button type="submit" className="flex min-h-11 w-full items-center justify-center rounded-xl border border-line text-sm font-semibold text-ink hover:bg-paper">
                Sair da conta
              </button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}
