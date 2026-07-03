import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  carpetaDesc: string;
  personaNombre: string;
  usuarioNombre: string;
  formatDate: (d: string) => string;
  fechaPrest: string;
  fechaDevolucion: string;
  faltantes: string[];
  diasProrroga?: number;
  motivoProrroga?: string;
  documentos: { id: string; titulo: string; codigoDoc?: string; tipoDoc?: string }[];
  checkedDocs: string[];
  docIdsPrestadoIndividual: Set<string>;
  docIdsYaDevueltos: Set<string>;
}

export function generarComprobanteDevolucion({
  carpetaDesc, personaNombre, usuarioNombre, formatDate,
  fechaPrest, fechaDevolucion,
  faltantes, diasProrroga, motivoProrroga,
  documentos, checkedDocs,
  docIdsPrestadoIndividual,
  docIdsYaDevueltos,
}: Props) {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text("Comprobante de Devoluci\u00F3n", 105, y, { align: 'center' });
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`, 105, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 8;

  doc.setFontSize(11);
  doc.text("Datos de la Devoluci\u00F3n", 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Carpeta: ${carpetaDesc}`, 14, y);
  y += 6;
  doc.text(`Se prest\u00F3 a: ${personaNombre}`, 14, y);
  y += 6;
  doc.text(`Pr\u00E9stamo: ${formatDate(fechaPrest)}`, 14, y);
  doc.text(`Devoluci\u00F3n: ${formatDate(fechaDevolucion)}`, 110, y);
  y += 10;

  const docsVisibles = documentos.filter((d) => !docIdsPrestadoIndividual.has(d.id));
  const body = docsVisibles.map((d) => {
    const presente = checkedDocs.includes(d.id) || docIdsYaDevueltos.has(d.id)
      ? "S\u00ED"
      : "No";
    return [d.codigoDoc || "-", d.tipoDoc || "-", presente];
  });

  autoTable(doc, {
    head: [["C\u00F3digo", "Documento", "Presente"]],
    body,
    startY: y,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 25, halign: "center" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  if (faltantes.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9);
    doc.text("Documentos Faltantes", 14, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    faltantes.forEach((f) => {
      doc.text(`  \u2022 ${f}`, 14, y);
      y += 5.5;
    });
    y += 4;

    if (diasProrroga) {
      doc.setFontSize(10);
      doc.text(`Pr\u00F3rroga otorgada: ${diasProrroga} d\u00EDa(s)`, 14, y);
      y += 6;
      if (motivoProrroga) {
        doc.text(`Motivo: ${motivoProrroga}`, 14, y);
        y += 6;
      }
      const nuevaFecha = new Date(fechaDevolucion);
      nuevaFecha.setDate(nuevaFecha.getDate() + diasProrroga);
      doc.text(
        `Nueva fecha l\u00EDmite: ${nuevaFecha.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`,
        14, y,
      );
      y += 10;
    }

    y += 4;
    doc.setFontSize(10);
    doc.text("Recib\u00ED conforme y me comprometo a devolver los documentos faltantes", 14, y);
    y += 4;
    doc.text("en el plazo establecido.", 14, y);
    y += 8;
  }

  y += 4;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  const lw = 65;
  doc.line(62.5 - lw / 2, y, 62.5 + lw / 2, y);
  doc.line(147.5 - lw / 2, y, 147.5 + lw / 2, y);
  y += 5;

  doc.text(personaNombre, 62.5, y, { align: 'center' });
  doc.text(usuarioNombre, 147.5, y, { align: 'center' });

  const pdfBlob = doc.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
