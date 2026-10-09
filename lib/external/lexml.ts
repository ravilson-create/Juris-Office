import "server-only";
import { XMLParser } from "fast-xml-parser";

/**
 * Cliente da API pública SRU do LexML Brasil (rede mantida por Senado, Câmara, Judiciário e MP) —
 * busca em texto livre, sem conta nem certificado digital. Ao contrário de Jusbrasil/e-DOU (só
 * link, ver lib/external/consultas.ts), o LexML tem API aberta e documentada: dá para trazer o
 * resultado para dentro do Júris Office, em vez de só abrir o site em outra aba.
 *
 * Protocolo SRU (Search/Retrieve via URL, padrão da Library of Congress), devolve XML com os
 * registros em Dublin Core (dc:title, dc:description, dc:date, dc:identifier = URN do documento).
 * Não há chave de API: é só uma busca pública por palavra-chave.
 */
const LEXML_SRU_URL = "https://www.lexml.gov.br/busca/SRU";

export type DocumentoLexml = {
  urn: string;
  titulo: string;
  ementa: string | null;
  data: string | null;
  url: string;
};

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  trimValues: true,
});

/** Escapa aspas dentro do termo para não quebrar a sintaxe CQL da consulta. */
function escaparCql(termo: string): string {
  return termo.replace(/"/g, '\\"');
}

function primeiroTexto(valor: unknown): string | null {
  if (typeof valor === "string") return valor.trim() || null;
  if (Array.isArray(valor)) return primeiroTexto(valor[0]);
  return null;
}

/**
 * Busca documentos de legislação por palavra-chave. Devolve lista vazia quando a busca funcionou
 * mas não achou nada — nunca inventa resultado. Lança erro em caso de falha de rede, HTTP não-OK
 * ou diagnóstico de erro devolvido pelo próprio serviço SRU.
 */
export async function consultarLexml(termo: string, maximo = 10): Promise<DocumentoLexml[]> {
  const termoLimpo = termo.trim();
  if (!termoLimpo) return [];

  const cql = `dc.title any "${escaparCql(termoLimpo)}" or dc.description any "${escaparCql(termoLimpo)}"`;
  const url = new URL(LEXML_SRU_URL);
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("version", "1.2");
  url.searchParams.set("query", cql);
  url.searchParams.set("maximumRecords", String(maximo));
  url.searchParams.set("recordSchema", "dc");

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      // Sem um User-Agent de navegador, a proteção contra robôs do Senado Federal (que hospeda o
      // SRU do LexML) devolve uma página HTML de "verificação de segurança" em vez do XML —
      // confirmado em produção (ver histórico desta função). Isso imita um navegador comum.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "application/xml, text/xml, */*",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
  } catch {
    throw new Error("Não foi possível consultar o LexML agora.");
  }
  if (!res.ok) throw new Error(`O LexML respondeu com erro ${res.status}.`);

  const xml = await res.text();
  const pareceHtml = /^\s*<!DOCTYPE html/i.test(xml) || /<html[\s>]/i.test(xml.slice(0, 200));
  if (pareceHtml) {
    throw new Error(
      "O LexML bloqueou esta consulta automática (verificação de segurança do Senado Federal). Tente abrir a busca completa no site, abaixo.",
    );
  }

  const doc = parser.parse(xml) as Record<string, unknown>;
  const resposta = doc.searchRetrieveResponse as Record<string, unknown> | undefined;
  if (!resposta) throw new Error("Resposta do LexML em formato inesperado.");

  const diagnostico = resposta.diagnostics as Record<string, unknown> | undefined;
  if (diagnostico) {
    const brutos = diagnostico.diagnostic;
    const primeiro = (Array.isArray(brutos) ? brutos[0] : brutos) as
      | Record<string, unknown>
      | undefined;
    const mensagem = primeiroTexto(primeiro?.message);
    throw new Error(mensagem ?? "O LexML recusou a consulta.");
  }

  const registrosBrutos = (resposta.records as Record<string, unknown> | undefined)?.record;
  if (!registrosBrutos) return [];
  const registros = Array.isArray(registrosBrutos) ? registrosBrutos : [registrosBrutos];

  return registros
    .map((registro): DocumentoLexml | null => {
      const r = registro as Record<string, unknown>;
      const recordData = r.recordData as Record<string, unknown> | undefined;
      const dc = (recordData?.dc ?? recordData) as Record<string, unknown> | undefined;
      if (!dc) return null;
      const urn = primeiroTexto(dc.identifier);
      const titulo = primeiroTexto(dc.title);
      if (!urn || !titulo) return null;
      return {
        urn,
        titulo,
        ementa: primeiroTexto(dc.description),
        data: primeiroTexto(dc.date),
        url: `https://www.lexml.gov.br/urn/${urn}`,
      };
    })
    .filter((d): d is DocumentoLexml => d !== null);
}
