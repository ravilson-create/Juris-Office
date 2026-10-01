import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { otpauthUrl } from "@/domain/mfa/totp";
import { lerERemoverCodigosBackupTemporarios } from "@/lib/auth/mfa-cookie";
import { currentIdentity } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { buscarMfa } from "@/lib/services/mfa";
import { confirmarMfaAction, desativarMfaAction, iniciarCadastroMfaAction } from "../actions";

export const metadata: Metadata = { title: "Verificação em duas etapas" };
export const dynamic = "force-dynamic";

const MENSAGEM_ERRO: Record<string, string> = {
  codigo_invalido: "Código incorreto ou expirado. Confira o relógio do celular e tente de novo.",
  limite: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
};

export default async function ConfigurarMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; confirmado?: string }>;
}) {
  const identity = await currentIdentity();
  if (!identity) redirect("/auth/sign-in");
  const { erro, confirmado } = await searchParams;

  const db = getDb();
  const mfa = await buscarMfa(db, identity.id);
  const codigosBackup = confirmado ? await lerERemoverCodigosBackupTemporarios() : null;

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <p>
        <Link href="/equipe">Voltar à área profissional</Link>
      </p>
      <h1 className="mt-4 text-3xl">Verificação em duas etapas</h1>
      <p className="mt-2 text-sm text-muted">
        Protege o acesso à área profissional com um código de 6 dígitos gerado por um aplicativo
        autenticador (Google Authenticator, Authy ou similar), além da sua senha.
      </p>

      {erro && MENSAGEM_ERRO[erro] && (
        <div className="mt-6">
          <Alert tone="error" title="Não foi possível confirmar.">
            {MENSAGEM_ERRO[erro]}
          </Alert>
        </div>
      )}

      {codigosBackup && (
        <div className="mt-6">
          <Alert title="Verificação ativada">
            Guarde estes códigos de backup num lugar seguro — cada um funciona uma única vez, para
            quando você não tiver o celular com o autenticador. Eles não aparecem de novo depois
            desta tela.
          </Alert>
          <ul className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-line bg-surface p-4 font-mono text-sm">
            {codigosBackup.map((codigo) => (
              <li key={codigo}>{codigo}</li>
            ))}
          </ul>
        </div>
      )}

      {mfa?.enabled_at ? (
        <div className="mt-6 rounded-md border border-line bg-surface p-5">
          <p>
            Verificação em duas etapas <strong>ativada</strong>{" "}
            {!codigosBackup &&
              `desde ${new Date(mfa.enabled_at).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`}
            .
          </p>
          <form action={desativarMfaAction} className="mt-4">
            <button className="rounded border border-danger px-4 py-2 text-sm text-danger">
              Desativar
            </button>
          </form>
        </div>
      ) : mfa ? (
        <div className="mt-6 rounded-md border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold">Escaneie ou digite a chave</h2>
          <p className="mt-2 text-sm text-muted">
            Abra o aplicativo autenticador, adicione uma conta e digite a chave abaixo (ou use o
            link, se o aplicativo aceitar colar um link `otpauth://`).
          </p>
          <p className="mt-3 break-all rounded bg-navy-soft p-3 font-mono text-sm">{mfa.secret}</p>
          <p className="mt-2 break-all text-xs text-muted">
            {otpauthUrl(mfa.secret, identity.email)}
          </p>
          <form action={confirmarMfaAction} className="mt-5 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="codigo" className="block text-sm font-medium">
                Código de 6 dígitos
              </label>
              <input
                id="codigo"
                name="codigo"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                className="mt-1 w-32 rounded border border-line p-2 text-center font-mono text-lg tracking-widest"
              />
            </div>
            <button className="rounded bg-navy px-4 py-2 text-white">Confirmar e ativar</button>
          </form>
        </div>
      ) : (
        <form action={iniciarCadastroMfaAction} className="mt-6">
          <button className="rounded bg-navy px-4 py-2 text-white">
            Ativar verificação em duas etapas
          </button>
        </form>
      )}
    </main>
  );
}
