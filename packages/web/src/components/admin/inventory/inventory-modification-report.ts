import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { InventoryModification } from "@/lib/api";

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(
    value,
  );
}

function formatDate(value: string | null) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin fecha"
    : new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function fullName(actor: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  return `${actor.firstName} ${actor.lastName}`.trim() || actor.email;
}

function reportNumber(modification: InventoryModification) {
  return `INV-${String(modification.number).padStart(6, "0")}`;
}

export function downloadInventoryModificationPdf(
  modification: InventoryModification,
) {
  const document = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = document.internal.pageSize.getWidth();
  const margin = 14;
  const number = reportNumber(modification);

  document.setFillColor(25, 38, 59);
  document.roundedRect(margin, 13, pageWidth - margin * 2, 34, 3, 3, "F");
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(9);
  document.text("KUTCHENAI  /  INVENTARIOS", margin + 7, 22);
  document.setFontSize(17);
  document.text("Modificación de inventario", margin + 7, 32);
  document.setFontSize(10);
  document.text(number, pageWidth - margin - 7, 32, { align: "right" });
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  document.text(
    modification.status === "APPLIED" ? "APLICADA" : "EN PROGRESO",
    pageWidth - margin - 7,
    40,
    { align: "right" },
  );

  const cardGap = 4;
  const cardWidth = (pageWidth - margin * 2 - cardGap) / 2;
  const cardHeight = 17;
  const cardY = 53;
  const cards = [
    { label: "SUCURSAL", value: modification.location.name },
    { label: "FECHA DE CREACIÓN", value: formatDate(modification.createdAt) },
    { label: "CREADA POR", value: fullName(modification.createdBy) },
    {
      label: "APLICADA POR",
      value: modification.appliedBy
        ? fullName(modification.appliedBy)
        : "Pendiente",
    },
    {
      label: "FECHA DE APLICACIÓN",
      value: formatDate(modification.appliedAt),
    },
    { label: "ARTÍCULOS CONTADOS", value: String(modification.items.length) },
  ];

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

  const notesY = cardY + 3 * (cardHeight + 3) + 2;
  document.setTextColor(107, 119, 138);
  document.setFont("helvetica", "bold");
  document.setFontSize(7);
  document.text("MOTIVO / NOTAS", margin, notesY);
  document.setTextColor(35, 45, 62);
  document.setFont("helvetica", "normal");
  document.setFontSize(9);
  const notes = document.splitTextToSize(
    modification.notes || "Sin notas",
    pageWidth - margin * 2,
  );
  document.text(notes, margin, notesY + 5);

  const tableY = notesY + 8 + Math.max(0, notes.length - 1) * 4;
  autoTable(document, {
    startY: tableY,
    margin: { left: margin, right: margin, top: 14, bottom: 18 },
    head: [
      [
        "Artículo",
        "Código",
        "Tipo",
        "En sistema",
        "Conteo físico",
        "Diferencia",
        "Unidad",
        "Contó",
      ],
    ],
    body: modification.items.map((item) => [
      item.itemName,
      item.itemCode ?? "—",
      item.itemType === "INGREDIENT" ? "Ingrediente" : "Producto",
      formatNumber(item.systemQuantity),
      formatNumber(item.countedQuantity),
      `${item.difference > 0 ? "+" : ""}${formatNumber(item.difference)}`,
      item.unit,
      fullName(item.countedBy),
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [43, 52, 69],
      lineColor: [225, 230, 238],
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [25, 38, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    columnStyles: {
      0: { cellWidth: 39 },
      1: { cellWidth: 20 },
      2: { cellWidth: 20 },
      3: { halign: "right", cellWidth: 18 },
      4: { halign: "right", cellWidth: 20 },
      5: { halign: "right", cellWidth: 18 },
      6: { cellWidth: 14 },
      7: { cellWidth: "auto" },
    },
  });

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    const pageHeight = document.internal.pageSize.getHeight();
    document.setDrawColor(225, 230, 238);
    document.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    document.setTextColor(107, 119, 138);
    document.setFont("helvetica", "normal");
    document.setFontSize(8);
    document.text(
      `Reporte ${number} · ${modification.location.name}`,
      margin,
      pageHeight - 8,
    );
    document.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }

  document.save(`modificacion-inventario-${number.toLowerCase()}.pdf`);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function printInventoryModification(modification: InventoryModification) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error(
      "El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.",
    );
  }

  const number = reportNumber(modification);
  const rows = modification.items
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.itemName)}</strong><small>${item.itemType === "INGREDIENT" ? "Ingrediente" : "Producto"}</small></td>
        <td>${escapeHtml(item.itemCode || "—")}</td>
        <td>${formatNumber(item.systemQuantity)} ${escapeHtml(item.unit)}</td>
        <td>${formatNumber(item.countedQuantity)} ${escapeHtml(item.unit)}</td>
        <td class="${item.difference > 0 ? "positive" : item.difference < 0 ? "negative" : ""}">${item.difference > 0 ? "+" : ""}${formatNumber(item.difference)} ${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(fullName(item.countedBy))}</td>
      </tr>`,
    )
    .join("");

  printWindow.document.write(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Reporte ${number}</title>
        <style>
          @page { size: A4; margin: 16mm 14mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #202b3c; font: 12px/1.45 Arial, sans-serif; }
          header { padding: 22px 24px; color: #fff; background: #19263b; border-radius: 12px; }
          .brand { margin: 0 0 10px; color: #cbd5e1; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; }
          h1 { margin: 0; font-size: 22px; }
          .report-number { margin: 7px 0 0; color: #e2e8f0; font-weight: 700; }
          .status { float: right; padding: 5px 9px; border: 1px solid #86efac; border-radius: 999px; color: #dcfce7; font-size: 9px; font-weight: 700; }
          .metadata { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; margin: 18px 0; }
          .metadata div { min-height: 54px; padding: 10px 12px; border: 1px solid #e1e6ee; border-radius: 8px; background: #f7f9fc; }
          .metadata span { display: block; margin-bottom: 4px; color: #6b778a; font-size: 9px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
          .metadata strong { overflow-wrap: anywhere; }
          h2 { margin: 20px 0 9px; font-size: 14px; }
          .notes { margin: 16px 0; padding: 11px 13px; border-left: 3px solid #19263b; background: #f7f9fc; white-space: pre-wrap; overflow-wrap: anywhere; }
          .notes strong { display: block; margin-bottom: 4px; color: #6b778a; font-size: 9px; letter-spacing: .5px; }
          table { width: 100%; border-collapse: collapse; }
          th { padding: 9px 7px; color: #fff; background: #19263b; font-size: 9px; text-align: left; }
          td { padding: 8px 7px; border-bottom: 1px solid #e1e6ee; vertical-align: top; }
          tbody tr:nth-child(even) { background: #f7f9fc; }
          td small { display: block; margin-top: 3px; color: #6b778a; }
          .positive { color: #047857; font-weight: 700; }
          .negative { color: #b91c1c; font-weight: 700; }
          footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e1e6ee; color: #6b778a; font-size: 9px; }
          @media print { header, th { print-color-adjust: exact; -webkit-print-color-adjust: exact; } tr { break-inside: avoid; } }
        </style>
      </head>
      <body>
        <header>
          <span class="status">${modification.status === "APPLIED" ? "APLICADA" : "EN PROGRESO"}</span>
          <p class="brand">KUTCHENAI · INVENTARIOS</p>
          <h1>Modificación de inventario</h1>
          <p class="report-number">${number}</p>
        </header>
        <section class="metadata">
          <div><span>Sucursal</span><strong>${escapeHtml(modification.location.name)}</strong></div>
          <div><span>Fecha de creación</span><strong>${escapeHtml(formatDate(modification.createdAt))}</strong></div>
          <div><span>Creada por</span><strong>${escapeHtml(fullName(modification.createdBy))}</strong></div>
          <div><span>Aplicada por</span><strong>${escapeHtml(modification.appliedBy ? fullName(modification.appliedBy) : "Pendiente")}</strong></div>
          <div><span>Fecha de aplicación</span><strong>${escapeHtml(formatDate(modification.appliedAt))}</strong></div>
          <div><span>Artículos contados</span><strong>${modification.items.length}</strong></div>
        </section>
        <div class="notes"><strong>MOTIVO / NOTAS</strong>${escapeHtml(modification.notes || "Sin notas")}</div>
        <h2>Detalle de artículos</h2>
        <table>
          <thead><tr><th>Artículo</th><th>Código</th><th>En sistema</th><th>Conteo físico</th><th>Diferencia</th><th>Contó</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <footer>Reporte ${number} · ${escapeHtml(modification.location.name)}</footer>
        <script>window.addEventListener("load", () => { window.focus(); window.print(); });</script>
      </body>
    </html>`);
  printWindow.document.close();
}
