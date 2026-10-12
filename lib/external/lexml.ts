import "server-only";
import { XMLParser, XMLValidator } from "fast-xml-parser";

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
  return termo.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
  url.searchParams.set("recordPacking", "xml");

  let res: Response;
  let xml: string;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/xml, text/xml;q=0.9" },
      cache: "no-store",
    });
    xml = await res.text();
  } catch {
    throw new Error("Não foi possível consultar o LexML agora. Tente novamente em instantes.");
  }

  // O serviço pode devolver o desafio de segurança em HTML com status 200.
  // Não interpretar essa página como XML nem registrar seu corpo ou a pesquisa.
  const html =
    /<!doctype\s+html|<html\b/i.test(xml) ||
    /text\/html/i.test(res.headers?.get("content-type") ?? "");
  if (html && /verifica[çc][ãa]o de seguran[çc]a|\/_challenge/i.test(xml)) {
    throw new Error(
      "O LexML está exigindo uma verificação de segurança e não permitiu a consulta automática. Abra a pesquisa no site da fonte.",
    );
  }
  if (!res.ok)
    throw new Error(`O LexML respondeu com erro ${res.status}. Tente novamente em instantes.`);
  if (html || XMLValidator.validate(xml) !== true) {
    throw new Error("O LexML devolveu uma resposta inválida. Tente novamente em instantes.");
  }
  const doc = parser.parse(xml) as Record<string, unknown>;
  const resposta = doc.searchRetrieveResponse as Record<string, unknown> | undefined;
  if (!resposta || typeof resposta !== "object") {
    throw new Error("O LexML devolveu uma resposta inválida. Tente novamente em instantes.");
  }

  const diagnostico = resposta.diagnostics as Record<string, unknown> | undefined;
  if (diagnostico) {
    const brutos = diagnostico.diagnostic;
    const primeiro = (Array.isArray(brutos) ? brutos[0] : brutos) as
      Record<string, unknown> | undefined;
    const mensagem = primeiroTexto(primeiro?.message);
    throw new Error(mensagem ?? "O LexML recusou a consulta.");
  }

  const registrosBrutos = (resposta.records as Record<string, unknown> | undefined)?.record;
  if (!registrosBrutos) {
    if (Number(resposta.numberOfRecords) === 0) return [];
    throw new Error(
      "O LexML informou resultados, mas não enviou os documentos. Tente novamente em instantes.",
    );
  }
  const registros = Array.isArray(registrosBrutos) ? registrosBrutos : [registrosBrutos];

  const documentos = registros
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
  if (documentos.length === 0) {
    throw new Error(
      "Não foi possível ler os documentos enviados pelo LexML. Tente novamente em instantes.",
    );
  }
  return documentos;
}
