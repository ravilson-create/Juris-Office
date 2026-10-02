import "server-only";
import PDFDocument from "pdfkit";
import type { PetitionDocument } from "@/domain/petition/schema";

/**
 * Converte o documento gerado (mesma fonte que o .docx, em lib/petitions/docx.ts) num PDF pronto
 * para impressão/protocolo. Fonte padrão do pdfkit (Helvetica, métricas embutidas) cobre os
 * acentos do português sem precisar embarcar arquivo de fonte.
 */
export async function peticaoParaPdfBuffer(doc: PetitionDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 72 });
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(doc.tituloModelo.toUpperCase(), { align: "center" });
    pdf.moveDown(1.5);

    for (const secao of doc.secoes) {
      pdf.font("Helvetica-Bold").fontSize(12).text(secao.titulo, { align: "left" });
      pdf.moveDown(0.5);
      pdf.font("Helvetica").fontSize(11).text(secao.corpo, { align: "justify" });
      pdf.moveDown(1);
    }

    pdf.end();
  });
}
