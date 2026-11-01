import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ProductionLog } from "@/lib/api";

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(
    value,
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function reportNumber(production: ProductionLog) {
  return `PRO-${String(production.number).padStart(6, "0")}`;
}

function actorName(production: ProductionLog) {
  if (!production.createdBy) return "No registrado (histórico)";
  return (
    `${production.createdBy.firstName} ${production.createdBy.lastName}`.trim() ||
    production.createdBy.email
  );
}

export function downloadProductionPdf(production: ProductionLog) {
  const document = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = document.internal.pageSize.getWidth();
  const margin = 14;

  document.setFillColor(25, 38, 59);
  document.roundedRect(margin, 13, pageWidth - margin * 2, 34, 3, 3, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(9);
  document.text("KUTCHENAI  /  PRODUCCIÓN", margin + 7, 22);
  document.setFontSize(17);
  document.text("Registro de producción", margin + 7, 32);
  document.setFontSize(10);
  document.text(reportNumber(production), pageWidth - margin - 7, 32, {
    align: "right",
  });

  const cards = [
    { label: "PREPARACIÓN", value: production.productName ?? production.product.name },
    { label: "CÓDIGO DEL PRODUCTO", value: production.productCode ?? production.product.code },
    { label: "FECHA", value: formatDate(production.createdAt) },
    { label: "RESPONSABLE", value: actorName(production) },
    {
      label: "CANTIDAD PRODUCIDA",
      value: `${formatNumber(production.quantity)} ${production.productUnit ?? production.product.unit}`,
    },
    {
      label: "MERMA",
      value: `${formatNumber(production.wasteQuantity)} ${production.productUnit ?? production.product.unit}`,
    },
    { label: "SUCURSAL", value: production.product.location?.name ?? "—" },
  ];
  const cardGap = 4;
  const cardWidth = (pageWidth - margin * 2 - cardGap) / 2;
  const cardHeight = 17;
  const cardY = 53;

  cards.forEach((card, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * (cardWidth + cardGap);
    const y = cardY + row * (cardHeight + 3);
    document.setFillColor(247, 249, 252);
    document.setDrawColor(225, 230, 238);
    document.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "FD");
    document.setTextColor(107, 119, 138);
    document.setFont("helvetica", "bold");
    document.setFontSize(7);
    document.text(card.label, x + 3, y + 6);
    document.setTextColor(35, 45, 62);
    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    document.text(
      document.splitTextToSize(card.value, cardWidth - 6)[0],
      x + 3,
      y + 12,
    );
  });

  const notesY = cardY + 4 * (cardHeight + 3) + 2;
  document.setTextColor(107, 119, 138);
  document.setFont("helvetica", "bold");
  document.setFontSize(7);
  document.text("NOTAS DE MERMA", margin, notesY);
  document.setTextColor(35, 45, 62);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  const notes = document.splitTextToSize(
    production.wasteNotes || "Sin notas",
    pageWidth - margin * 2,
  );
  document.text(notes, margin, notesY + 5);

  autoTable(document, {
    startY: notesY + 10 + Math.max(0, notes.length - 1) * 4,
    margin: { left: margin, right: margin, top: 14, bottom: 18 },
    head: [["Insumo utilizado", "Código", "Tipo", "Cantidad", "Unidad"]],
    body: production.consumedMaterials.length
      ? production.consumedMaterials.map((material) => [
          material.name,
          material.code || "—",
          material.type === "INGREDIENT" ? "Ingrediente" : "Preparación",
          formatNumber(material.quantity),
          material.unit,
        ])
      : [["Sin detalle histórico de insumos", "—", "—", "—", "—"]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [43, 52, 69],
      lineColor: [225, 230, 238],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [25, 38, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [247, 249, 252] },
  });

  document.save(`${reportNumber(production)}.pdf`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

export function printProduction(production: ProductionLog) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("El navegador bloqueó la ventana de impresión.");

  const productName = production.productName ?? production.product.name;
  const productUnit = production.productUnit ?? production.product.unit;
  const materials = production.consumedMaterials
    .map(
      (material) => `
        <tr>
          <td>${escapeHtml(material.name)}</td>
          <td>${escapeHtml(material.code || "—")}</td>
          <td>${material.type === "INGREDIENT" ? "Ingrediente" : "Preparación"}</td>
          <td>${formatNumber(material.quantity)}</td>
          <td>${escapeHtml(material.unit)}</td>
        </tr>`,
    )
    .join("");

  printWindow.document.write(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${reportNumber(production)} - Producción</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 32px; color: #233046; font: 14px Arial, sans-serif; }
          header { padding: 24px; border-radius: 12px; background: #19263b; color: white; }
          header div { display: flex; justify-content: space-between; align-items: end; gap: 16px; }
          h1 { margin: 12px 0 0; font-size: 24px; }
          header strong { font-size: 18px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0; }
          .card { padding: 12px; border: 1px solid #e1e6ee; border-radius: 8px; background: #f7f9fc; }
          .label { display: block; margin-bottom: 6px; color: #6b778a; font-size: 10px; font-weight: bold; text-transform: uppercase; }
          h2 { margin: 26px 0 10px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 9px; border: 1px solid #e1e6ee; text-align: left; }
          th { background: #19263b; color: white; font-size: 11px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <header><div><div><strong>KUTCHENAI / PRODUCCIÓN</strong><h1>Registro de producción</h1></div><strong>${reportNumber(production)}</strong></div></header>
        <section class="grid">
          <div class="card"><span class="label">Preparación</span>${escapeHtml(productName)}</div>
          <div class="card"><span class="label">Código del producto</span>${escapeHtml(production.productCode ?? production.product.code)}</div>
          <div class="card"><span class="label">Fecha</span>${formatDate(production.createdAt)}</div>
          <div class="card"><span class="label">Responsable</span>${escapeHtml(actorName(production))}</div>
          <div class="card"><span class="label">Cantidad producida</span>${formatNumber(production.quantity)} ${escapeHtml(productUnit)}</div>
          <div class="card"><span class="label">Merma</span>${formatNumber(production.wasteQuantity)} ${escapeHtml(productUnit)}</div>
          <div class="card"><span class="label">Sucursal</span>${escapeHtml(production.product.location?.name ?? "—")}</div>
          <div class="card"><span class="label">Notas de merma</span>${escapeHtml(production.wasteNotes || "Sin notas")}</div>
        </section>
        <h2>Insumos utilizados</h2>
        <table>
          <thead><tr><th>Insumo</th><th>Código</th><th>Tipo</th><th>Cantidad</th><th>Unidad</th></tr></thead>
          <tbody>${materials || '<tr><td colspan="5">Sin detalle histórico de insumos</td></tr>'}</tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>`);
  printWindow.document.close();
}
