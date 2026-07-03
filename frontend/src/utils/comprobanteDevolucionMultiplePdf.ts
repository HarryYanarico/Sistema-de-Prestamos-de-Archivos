import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReturnedItem {
  carpetaDesc: string;
  fechaPrest: string;
  fechaDevolucion: string;
  estado: string;
}

interface Props {
  personaNombre: string;
  usuarioNombre: string;
  formatDate: (d: string) => string;
  items: ReturnedItem[];
  observaciones?: string;
}

const estadoLabels: Record<string, string> = {
  buen_estado: "Buen estado",
  mal_estado: "Mal estado",
  dañado: "Dañado",
};

export function generarComprobanteDevolucionMultiple({
  personaNombre, usuarioNombre, formatDate,
  items, observaciones,
}: Props) {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.text("Comprobante de Devoluci\u00F3n", 14, y);
  y += 12;

  doc.setFontSize(10);
  doc.text(`Fecha: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`, 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.text("Datos de la Devoluci\u00F3n", 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Devuelve: ${personaNombre}`, 14, y);
  y += 6;
  doc.text(`Registr\u00F3: ${usuarioNombre}`, 14, y);
  y += 10;

  const body = items.map((item) => [
    item.carpetaDesc,
    formatDate(item.fechaPrest),
    formatDate(item.fechaDevolucion),
    estadoLabels[item.estado] ?? item.estado,
  ]);

  autoTable(doc, {
    head: [["Carpeta", "Pr\u00E9stamo", "Fecha L\u00EDmite", "Estado"]],
    body,
    startY: y,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 35, halign: "center" },
      2: { cellWidth: 35, halign: "center" },
      3: { cellWidth: 35, halign: "center" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  if (observaciones) {
    doc.setFontSize(10);
    doc.text(`Observaciones: ${observaciones}`, 14, y);
    y += 10;
  }

  y += 8;
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
