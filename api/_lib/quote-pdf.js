"use strict";

const { jsPDF } = require("jspdf");
const { autoTable } = require("jspdf-autotable");
const { ATHLETONIC_OFFICE_ADDRESS_TEXT } = require("./wholesale-applications");

const NAVY = [11, 31, 58];
const TEAL = [15, 118, 110];
const INK = [16, 32, 51];
const MUTED = [93, 107, 118];
const LINE = [225, 232, 238];

function usd(cents) {
  return `$${(Number(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function itemWholesaleCents(item) {
  const value = Number(item && item.wholesale_price_cents);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function quoteReference(id) {
  const compact = String(id || "").replaceAll("-", "").toUpperCase();
  return `AW-${compact.slice(0, 8) || "PENDING"}`;
}

function formatPdfDate(value) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    value ? new Date(value) : new Date()
  );
}

function optionsText(item) {
  const selected =
    item && item.selected_options && typeof item.selected_options === "object"
      ? Object.entries(item.selected_options)
      : [];
  return selected.map(([key, value]) => `${key}: ${value}`).join("  ·  ");
}

function buildWholesaleQuotePdf({ request, supportEmail, siteHost, isWholesale = true }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contact = supportEmail || "sales@athletonic.com";
  const host = siteHost || "www.athletonic.com";
  const reference = quoteReference(request.id);
  const createdAt = request.created_at ? new Date(request.created_at) : new Date();
  const validUntil = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  const fromLabel = isWholesale ? "Athletonic Wholesale" : "Athletonic International Orders";
  const preparedForLabel = String(request.company_name || request.name || "");

  // Letterhead band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 108, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("ATHLETONIC", margin, 46);
  doc.setFontSize(10);
  doc.setTextColor(94, 234, 212);
  doc.setCharSpace(2);
  doc.text(isWholesale ? "WHOLESALE QUOTATION" : "ORDER CONFIRMATION", margin, 66);
  doc.setCharSpace(0);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    [`Quote ref: ${reference}`, `Issued: ${formatPdfDate(createdAt)}`, `Valid until: ${formatPdfDate(validUntil)}`],
    pageWidth - margin,
    38,
    { align: "right", lineHeightFactor: 1.5 }
  );

  // Prepared for / From blocks
  let y = 136;
  const columnWidth = (pageWidth - margin * 2 - 24) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEAL);
  doc.setCharSpace(1.2);
  doc.text("PREPARED FOR", margin, y);
  doc.text("FROM", margin + columnWidth + 24, y);
  doc.setCharSpace(0);

  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(preparedForLabel, margin, y + 16);
  doc.text(fromLabel, margin + columnWidth + 24, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    [
      String(request.name || ""),
      String(request.email || ""),
      `WhatsApp: ${String(request.whatsapp || "")}`,
      String(request.country || ""),
    ].filter(Boolean),
    margin,
    y + 30,
    { lineHeightFactor: 1.45 }
  );
  doc.text(
    [ATHLETONIC_OFFICE_ADDRESS_TEXT, contact, host],
    margin + columnWidth + 24,
    y + 30,
    { lineHeightFactor: 1.45 }
  );

  // Items table
  const rows = request.items.map((item, index) => {
    const unit = itemWholesaleCents(item);
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const options = optionsText(item);
    return [
      String(index + 1),
      `${item.name}${options ? `\n${options}` : ""}`,
      String(item.brand || ""),
      String(quantity),
      unit ? usd(unit) : "On quote",
      unit ? usd(unit * quantity) : "—",
    ];
  });

  const estimatedTotalCents = request.items.reduce((total, item) => {
    const unit = itemWholesaleCents(item);
    return unit ? total + unit * Math.max(1, Number(item.quantity) || 1) : total;
  }, 0);
  const hasQuoteOnly = request.items.some((item) => !itemWholesaleCents(item));

  autoTable(doc, {
    startY: y + 96,
    margin: { left: margin, right: margin, bottom: 96 },
    head: [["#", "Product", "Brand", "Qty", isWholesale ? "Wholesale / unit" : "Unit price", "Line total"]],
    body: rows,
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: INK,
      cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
      lineColor: LINE,
      lineWidth: { bottom: 0.75 },
      valign: "middle",
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: [246, 250, 253] },
    columnStyles: {
      0: { cellWidth: 24, textColor: MUTED },
      1: { cellWidth: "auto" },
      2: { cellWidth: 78 },
      3: { cellWidth: 34, halign: "right" },
      4: { cellWidth: 86, halign: "right" },
      5: { cellWidth: 74, halign: "right", fontStyle: "bold" },
    },
  });

  let afterTable = doc.lastAutoTable.finalY + 14;
  if (afterTable > pageHeight - 170) {
    doc.addPage();
    afterTable = margin;
  }

  // Totals
  doc.setFillColor(...NAVY);
  doc.roundedRect(pageWidth - margin - 232, afterTable, 232, 44, 8, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(191, 219, 254);
  doc.setCharSpace(1);
  doc.text(
    `${isWholesale ? "EST. WHOLESALE TOTAL" : "ESTIMATED TOTAL"}${hasQuoteOnly ? " (PRICED ITEMS)" : ""}`,
    pageWidth - margin - 218,
    afterTable + 17
  );
  doc.setCharSpace(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(estimatedTotalCents ? usd(estimatedTotalCents) : "On quote", pageWidth - margin - 218, afterTable + 35);

  // Terms
  const terms = [
    isWholesale
      ? "Estimate only — final pricing, availability, and MOQ are confirmed by our sales team."
      : "Estimate only — final pricing, availability, and shipping are confirmed by our sales team.",
    "All prices in USD. Freight, duties, and taxes are not included.",
    hasQuoteOnly ? "Items marked \u201cOn quote\u201d are priced individually after review." : null,
    `This quotation is valid until ${formatPdfDate(validUntil)}.`,
  ].filter(Boolean);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text("Terms", margin, afterTable + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...MUTED);
  doc.text(
    terms.map((term) => `•  ${term}`),
    margin,
    afterTable + 27,
    { lineHeightFactor: 1.5, maxWidth: pageWidth - margin * 2 - 250 }
  );

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.75);
    doc.line(margin, pageHeight - 54, pageWidth - margin, pageHeight - 54);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${fromLabel}  ·  ${ATHLETONIC_OFFICE_ADDRESS_TEXT}  ·  ${contact}`, margin, pageHeight - 38);
    doc.text(`${reference}  ·  Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 38, { align: "right" });
  }

  return {
    buffer: Buffer.from(doc.output("arraybuffer")),
    filename: `Athletonic-Quotation-${reference}.pdf`,
    reference,
  };
}

module.exports = { buildWholesaleQuotePdf, quoteReference };
