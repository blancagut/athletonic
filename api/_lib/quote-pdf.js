"use strict";

const { jsPDF } = require("jspdf");
const { autoTable } = require("jspdf-autotable");
const QRCode = require("qrcode");
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

const PAYMENT_INSTRUCTIONS_NOTE =
  "Please use the banking information above for USD wire transfers and ACH payments. If you require an invoice or additional payment information, please contact Athletonic LLC before sending funds.";

async function fetchItemImage(url, timeoutMs = 3000) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || !arrayBuffer.byteLength) return null;
    let format = "JPEG";
    if (/png/i.test(contentType) || /\.png($|\?)/i.test(url)) format = "PNG";
    else if (/webp/i.test(contentType) || /\.webp($|\?)/i.test(url)) format = "WEBP";
    return { data: Buffer.from(arrayBuffer).toString("base64"), format };
  } catch {
    return null;
  }
}

async function buildWholesaleQuotePdf({ request, supportEmail, siteHost, isWholesale = true, bankDetails = null }) {
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
  const statusUrl = `https://${host.replace(/^www\./, "www.")}/order-status?ref=${encodeURIComponent(request.id)}`;
  let qrDataUrl = null;
  try {
    qrDataUrl = await QRCode.toDataURL(statusUrl, { width: 220, margin: 1, errorCorrectionLevel: "M" });
  } catch {
    // QR generation failure must never break the PDF.
  }
  const itemImages = await Promise.all(request.items.map((item) => fetchItemImage(item && item.image_url)));

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
    pageWidth - margin - (qrDataUrl ? 78 : 0),
    38,
    { align: "right", lineHeightFactor: 1.5 }
  );

  // Live order-status QR code in the letterhead
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, "PNG", pageWidth - margin - 64, 22, 64, 64);
      doc.setFontSize(6.5);
      doc.setTextColor(191, 219, 254);
      doc.text("SCAN FOR LIVE STATUS", pageWidth - margin - 32, 94, { align: "center" });
    } catch {
      // Ignore QR rendering failures.
    }
  }

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
      String(request.name || "") !== preparedForLabel ? String(request.name || "") : null,
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
      "",
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
    head: [["Photo", "Product", "Brand", "Qty", isWholesale ? "Wholesale / unit" : "Unit price", "Line total"]],
    body: rows,
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: INK,
      cellPadding: { top: 7, bottom: 7, left: 6, right: 6 },
      lineColor: LINE,
      lineWidth: { bottom: 0.75 },
      valign: "middle",
      minCellHeight: 46,
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
      0: { cellWidth: 46 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 74 },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 82, halign: "right" },
      5: { cellWidth: 70, halign: "right", fontStyle: "bold" },
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const image = itemImages[data.row.index];
      if (!image) return;
      try {
        const padding = 5;
        const size = Math.min(data.cell.width, data.cell.height) - padding * 2;
        const x = data.cell.x + (data.cell.width - size) / 2;
        const yPos = data.cell.y + (data.cell.height - size) / 2;
        doc.addImage(image.data, image.format, x, yPos, size, size);
      } catch {
        // Skip images jsPDF can't decode instead of failing the whole PDF.
      }
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

  // Payment instructions (bank transfer details)
  if (bankDetails) {
    const boxHeight = 196;
    let paymentY = afterTable + 92;
    if (paymentY + boxHeight > pageHeight - 60) {
      doc.addPage();
      paymentY = margin;
    }
    const AMBER_BG = [255, 247, 237];
    const AMBER_BORDER = [253, 186, 116];
    const AMBER_INK = [124, 45, 18];
    const boxWidth = pageWidth - margin * 2;
    const pad = 18;
    const leftColX = margin + pad;
    const rightColX = margin + boxWidth / 2 + 6;

    const compactAddress = (value) =>
      String(value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    doc.setFillColor(...AMBER_BG);
    doc.setDrawColor(...AMBER_BORDER);
    doc.setLineWidth(1);
    doc.roundedRect(margin, paymentY, boxWidth, boxHeight, 10, 10, "FD");

    // Heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...AMBER_INK);
    doc.setCharSpace(1.4);
    doc.text("PAYMENT INSTRUCTIONS", leftColX, paymentY + 22);
    doc.setCharSpace(0);
    doc.setFontSize(14);
    doc.text("ATHLETONIC LLC", leftColX, paymentY + 42);

    // Divider under heading
    doc.setDrawColor(...AMBER_BORDER);
    doc.setLineWidth(0.5);
    doc.line(leftColX, paymentY + 50, margin + boxWidth - pad, paymentY + 50);

    // Left column: banking numbers (bold label + value on same line)
    const rowsY = paymentY + 66;
    const bankRows = [
      ["Company name", bankDetails.company_name],
      ["Account number", bankDetails.account_number],
      ["Routing (ACH/wire)", bankDetails.routing_number],
      ["SWIFT / BIC", bankDetails.swift_bic],
      ["Receiving bank", bankDetails.bank_name],
    ];
    const rowGap = 14.5;
    bankRows.forEach(([label, value], i) => {
      const lineY = rowsY + i * rowGap;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(`${label}:`, leftColX, lineY);
      doc.setFont("helvetica", "normal");
      doc.text(String(value || ""), leftColX + 96, lineY);
    });

    // Right column: addresses
    const bankAddr = compactAddress(bankDetails.bank_address);
    const companyAddr = compactAddress(bankDetails.company_address);
    let addrY = rowsY;
    const addrGap = 12;
    const writeAddress = (heading, lines) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(heading, rightColX, addrY);
      addrY += addrGap;
      doc.setFont("helvetica", "normal");
      lines.forEach((line) => {
        doc.text(line, rightColX, addrY);
        addrY += addrGap;
      });
      addrY += 4;
    };
    writeAddress("Bank address", bankAddr);
    writeAddress("Company address", companyAddr);

    // Note along the bottom
    doc.setDrawColor(...AMBER_BORDER);
    doc.setLineWidth(0.5);
    doc.line(leftColX, paymentY + boxHeight - 34, margin + boxWidth - pad, paymentY + boxHeight - 34);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.6);
    doc.setTextColor(...AMBER_INK);
    doc.text(PAYMENT_INSTRUCTIONS_NOTE, leftColX, paymentY + boxHeight - 20, {
      maxWidth: boxWidth - pad * 2,
      lineHeightFactor: 1.35,
    });
  }

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
