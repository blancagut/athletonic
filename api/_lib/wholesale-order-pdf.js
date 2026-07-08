"use strict";

const { jsPDF } = require("jspdf");
const { autoTable } = require("jspdf-autotable");
const { ATHLETONIC_OFFICE_ADDRESS_TEXT } = require("./wholesale-applications");

const INK = [24, 19, 15];
const MUTED = [99, 91, 79];
const GOLD = [242, 178, 97];
const LINE = [222, 216, 202];

function usd(cents) {
  return `$${(Number(cents || 0) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function invoiceReference(id) {
  const compact = String(id || "").replaceAll("-", "").toUpperCase();
  return `AWE-${compact.slice(0, 10) || "PENDING"}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    value ? new Date(value) : new Date()
  );
}

function optionsText(item) {
  const selected =
    item && item.selected_options && typeof item.selected_options === "object"
      ? Object.entries(item.selected_options)
      : [];
  return selected.map(([key, value]) => `${key}: ${value}`).join("  /  ");
}

function itemUnitCents(item) {
  const value = Number(item && (item.unit_price_cents || item.retail_price_cents));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function addressLines(address) {
  if (!address || typeof address !== "object") return [];
  return [
    address.legal_name,
    address.tax_id ? `Tax ID: ${address.tax_id}` : null,
    address.address_line1,
    [address.city, address.region].filter(Boolean).join(", "),
    [address.postal_code, address.country].filter(Boolean).join(" "),
  ].filter(Boolean);
}

function bankLines(bank) {
  return [
    `Company: ${bank.company_name}`,
    `Account: ${bank.account_number}`,
    `ACH / wire routing: ${bank.routing_number}`,
    `SWIFT / BIC: ${bank.swift_bic}`,
    `Bank: ${bank.bank_name}`,
  ];
}

function buildWholesaleOrderInvoicePdf({ order, bankDetails, siteHost }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 46;
  const reference = order.invoice_reference || invoiceReference(order.id);
  const createdAt = order.created_at ? new Date(order.created_at) : new Date();

  doc.setFillColor(...INK);
  doc.rect(0, 0, pageWidth, 112, "F");
  doc.setTextColor(255, 247, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("ATHLETONIC", margin, 44);
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text("ELECTRONIC INVOICE / UNIT ORDER", margin, 66);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(255, 247, 232);
  doc.text([`Factura: ${reference}`, `Fecha: ${formatDate(createdAt)}`, `Estado: comprobante recibido`], pageWidth - margin, 38, {
    align: "right",
    lineHeightFactor: 1.5,
  });

  let y = 140;
  const columnWidth = (pageWidth - margin * 2 - 24) / 2;
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("FACTURAR A", margin, y);
  doc.text("ATHLETONIC LLC", margin + columnWidth + 24, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    [
      order.billing.legal_name || order.company_name,
      order.billing.tax_id ? `Tax ID: ${order.billing.tax_id}` : null,
      order.name,
      order.email,
      `WhatsApp: ${order.whatsapp}`,
      ...addressLines(order.billing).slice(2),
    ].filter(Boolean),
    margin,
    y + 18,
    { lineHeightFactor: 1.45, maxWidth: columnWidth }
  );
  doc.text(
    [ATHLETONIC_OFFICE_ADDRESS_TEXT, "orders@athletonic.com", siteHost || "www.athletonic.com"],
    margin + columnWidth + 24,
    y + 18,
    { lineHeightFactor: 1.45, maxWidth: columnWidth }
  );

  const rows = order.items.map((item, index) => {
    const unit = itemUnitCents(item);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const options = optionsText(item);
    return [
      String(index + 1),
      `${item.name}${options ? `\n${options}` : ""}${item.notes ? `\nNota: ${item.notes}` : ""}`,
      String(item.brand || ""),
      String(quantity),
      unit ? usd(unit) : "Por confirmar",
      unit ? usd(unit * quantity) : "-",
    ];
  });

  autoTable(doc, {
    startY: y + 112,
    margin: { left: margin, right: margin, bottom: 116 },
    head: [["#", "Product", "Brand", "Qty", "Unit price", "Total"]],
    body: rows,
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: INK,
      cellPadding: 6,
      lineColor: LINE,
      lineWidth: { bottom: 0.75 },
      valign: "middle",
    },
    headStyles: {
      fillColor: INK,
      textColor: [255, 247, 232],
      fontStyle: "bold",
      fontSize: 8,
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: [249, 246, 239] },
    columnStyles: {
      0: { cellWidth: 24, textColor: MUTED },
      1: { cellWidth: "auto" },
      2: { cellWidth: 76 },
      3: { cellWidth: 34, halign: "right" },
      4: { cellWidth: 86, halign: "right" },
      5: { cellWidth: 76, halign: "right", fontStyle: "bold" },
    },
  });

  let afterTable = doc.lastAutoTable.finalY + 14;
  if (afterTable > pageHeight - 220) {
    doc.addPage();
    afterTable = margin;
  }

  doc.setFillColor(...INK);
  doc.roundedRect(pageWidth - margin - 226, afterTable, 226, 48, 6, 6, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(order.has_quote_only ? "ESTIMATED TOTAL (PRICED LINES)" : "ESTIMATED TOTAL", pageWidth - margin - 212, afterTable + 18);
  doc.setTextColor(255, 247, 232);
  doc.setFontSize(16);
  doc.text(order.estimated_total_cents ? usd(order.estimated_total_cents) : "Por confirmar", pageWidth - margin - 212, afterTable + 38);

  doc.setTextColor(...INK);
  doc.setFontSize(8);
  doc.text("Payment details", margin, afterTable + 12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(bankLines(bankDetails), margin, afterTable + 27, {
    lineHeightFactor: 1.48,
    maxWidth: pageWidth - margin * 2 - 250,
  });

  const notes = [
    "Electronic invoice generated for an Athletonic unit order.",
    "Availability, freight, taxes, import charges, and delivery timing are confirmed by Athletonic sales.",
    "Payment proof was received with the order and remains subject to bank reconciliation.",
  ];
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Notes", margin, afterTable + 106);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text(notes.map((note) => `- ${note}`), margin, afterTable + 121, {
    lineHeightFactor: 1.45,
    maxWidth: pageWidth - margin * 2,
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.line(margin, pageHeight - 54, pageWidth - margin, pageHeight - 54);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Athletonic LLC - ${ATHLETONIC_OFFICE_ADDRESS_TEXT} - orders@athletonic.com`, margin, pageHeight - 38);
    doc.text(`${reference} - Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 38, { align: "right" });
  }

  return {
    buffer: Buffer.from(doc.output("arraybuffer")),
    filename: `Athletonic-Factura-${reference}.pdf`,
    reference,
  };
}

module.exports = { buildWholesaleOrderInvoicePdf, invoiceReference };
