import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface RetiroData {
  carpeta: { descripcion: string; ubicacion: string };
  persona: { nombre: string; apellido: string; ci?: string };
  autorizadoPor: { nombre: string; apellido: string; ci?: string };
  fechaRetiro: string;
  motivo: string;
  observaciones?: string;
}

export function generarComprobanteRetiroPDF(data: RetiroData) {
  const doc = new jsPDF();

  let y = 20;

  doc.setFontSize(18);
  doc.text("Comprobante de Retiro", 14, y);
  y += 12;

  doc.setFontSize(10);
  doc.text(`Fecha de emisi\u00F3n: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`, 14, y);
  y += 12;

  doc.setFontSize(12);
  doc.text("Datos del Retiro", 14, y);
  y += 8;
  doc.setFontSize(10);

  const datos = [
    ["Carpeta", data.carpeta.descripcion],
    ["Ubicaci\u00F3n", data.carpeta.ubicacion],
    ["Persona que retira", `${data.persona.nombre} ${data.persona.apellido}${data.persona.ci ? ` (CI: ${data.persona.ci})` : ""}`],
    ["Autorizado por", `${data.autorizadoPor.nombre} ${data.autorizadoPor.apellido}${data.autorizadoPor.ci ? ` (CI: ${data.autorizadoPor.ci})` : ""}`],
    ["Fecha de retiro", new Date(data.fechaRetiro).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
    ["Motivo", data.motivo],
  ];

  if (data.observaciones) {
    datos.push(["Observaciones", data.observaciones]);
  }

  autoTable(doc, {
    head: [["Campo", "Valor"]],
    body: datos,
    startY: y,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
    theme: "plain",
  });

  y = (doc as any).lastAutoTable.finalY + 20;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("--- Documento generado por el sistema ---", 14, y);
  y += 8;
  doc.line(14, y, 140, y);
  y += 5;
  doc.text("Firma del responsable", 77, y, { align: "center" });

  const pdfBlob = doc.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, "_blank");
  URL.revokeObjectURL(url);
}
