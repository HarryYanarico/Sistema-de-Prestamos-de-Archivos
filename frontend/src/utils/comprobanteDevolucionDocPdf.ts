import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  personaNombre: string;
  usuarioNombre: string;
  formatDate: (d: string) => string;
  fechaPrest: string;
  fechaDevolucion: string;
  observaciones: string;
  estadoDevolucion: string;
  documento: { codigoDoc?: string; titulo?: string; tipoDoc?: string };
}

export function generarComprobanteDevolucionDoc({
  personaNombre, usuarioNombre, formatDate,
  fechaPrest, fechaDevolucion,
  observaciones, estadoDevolucion, documento,
}: Props) {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.text("Comprobante de Devoluci\u00F3n de Documento", 14, y);
  y += 12;

  doc.setFontSize(10);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`, 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.text("Datos de la Devoluci\u00F3n", 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Documento: ${documento.codigoDoc ? `${documento.codigoDoc} — ` : ""}${documento.titulo ?? ""}`, 14, y);
  y += 6;
  doc.text(`Se prest\u00F3 a: ${personaNombre}`, 14, y);
  y += 6;
  doc.text(`Fecha de pr\u00E9stamo: ${formatDate(fechaPrest)}`, 14, y);
  y += 6;
  doc.text(`Fecha de devoluci\u00F3n: ${formatDate(fechaDevolucion)}`, 14, y);
  y += 6;

  const estadoLabels: Record<string, string> = {
    buen_estado: "Buen Estado",
    dañado: "Dañado",
    perdido: "Perdido",
    incompleto: "Incompleto",
  };
  doc.text(`Estado: ${estadoLabels[estadoDevolucion] ?? estadoDevolucion}`, 14, y);
  y += 6;

  if (observaciones) {
    doc.text(`Observaciones: ${observaciones}`, 14, y);
    y += 6;
  }

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  y += 4;

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
