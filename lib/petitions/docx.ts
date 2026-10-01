import "server-only";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { PetitionDocument } from "@/domain/petition/schema";

/** Converte o documento gerado (seções de texto) num .docx pronto para edição no Word. */
export async function peticaoParaDocxBuffer(doc: PetitionDocument): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: doc.tituloModelo.toUpperCase(),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: "" }),
  ];

  for (const secao of doc.secoes) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: secao.titulo, bold: true })],
      }),
    );
    for (const paragrafo of secao.corpo.split("\n")) {
      children.push(
        new Paragraph({
          children: [new TextRun(paragrafo)],
          alignment: AlignmentType.JUSTIFIED,
        }),
      );
    }
    children.push(new Paragraph({ text: "" }));
  }

  const documento = new Document({ sections: [{ children }] });
  return Packer.toBuffer(documento);
}
