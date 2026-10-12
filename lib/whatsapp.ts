/**
 * Link direto de WhatsApp (wa.me) para o telefone do interessado de um caso — sem API, sem chave,
 * sem envio de dado a terceiro: é só uma URL que abre o WhatsApp do próprio profissional (app ou
 * Web) com a conversa já iniciada. O telefone já vem validado e normalizado (DDD + número, sem
 * pontuação) pelo cadastro do caso, ver domain/case/schema.ts.
 */
export function linkWhatsapp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return `https://wa.me/55${digitos}`;
}
