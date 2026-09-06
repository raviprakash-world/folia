import { formatCurrencyForPdf as formatCurrency, formatDate } from '@/utils/currency';
import { generateInvoiceNumber } from '@/utils/orderId';
import type { Order } from '@/types/order';

const COMPANY = {
  name: 'Folia',
  tagline: 'Living design for the home.',
  address: '412 Alder Street, Portland, OR 97205',
  email: 'hello@folia.example',
  phone: '(555) 019-2043',
  // Explicitly labeled mock — this project has no real business registration.
  gstin: '22AAAAA0000A1Z5 (mock GSTIN)',
};

const PINE = [31, 51, 41] as const;
const INK_SOFT = [85, 83, 76] as const;
const STONE_DARK = [222, 217, 203] as const;

/**
 * Generates and downloads a real PDF invoice via jsPDF, loaded with a
 * dynamic import so it never touches the main bundle — only fetched when
 * someone actually clicks "download invoice". jsPDF is a deliberate,
 * scoped exception to "continue using the existing stack" (see
 * ARCHITECTURE.md): small, dependency-free, and does exactly this one job.
 */
export async function downloadInvoice(order: Order): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 56;

  // Header — company branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...PINE);
  doc.text(COMPANY.name, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK_SOFT);
  doc.text(COMPANY.tagline, margin, y + 14);

  doc.setFontSize(9);
  doc.text(COMPANY.address, pageWidth - margin, y - 6, { align: 'right' });
  doc.text(`${COMPANY.email}  ·  ${COMPANY.phone}`, pageWidth - margin, y + 8, { align: 'right' });
  doc.text(`GSTIN: ${COMPANY.gstin}`, pageWidth - margin, y + 22, { align: 'right' });

  y += 46;
  doc.setDrawColor(...STONE_DARK);
  doc.line(margin, y, pageWidth - margin, y);
  y += 28;

  // Invoice / order meta
  const invoiceNumber = generateInvoiceNumber(order.id);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...PINE);
  doc.text('INVOICE', margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK_SOFT);
  const metaLines = [
    `Invoice number: ${invoiceNumber}`,
    `Order number: ${order.id}`,
    `Date: ${formatDate(order.createdAt)}`,
  ];
  metaLines.forEach((line, i) => doc.text(line, margin, y + i * 13));
  y += metaLines.length * 13 + 20;

  // Addresses, side by side
  const colWidth = (pageWidth - margin * 2 - 20) / 2;
  const addrY = y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PINE);
  doc.text('SHIPPING ADDRESS', margin, y);
  doc.text('BILLING ADDRESS', margin + colWidth + 20, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...INK_SOFT);
  const addrLines = (addr: Order['shippingAddress']) => [
    addr.fullName,
    addr.companyName ?? '',
    addr.addressLine1,
    `${addr.city}, ${addr.state} ${addr.postalCode}`,
    addr.phone,
  ].filter(Boolean);

  const shipLines = addrLines(order.shippingAddress);
  const billLines = addrLines(order.billingAddress);
  shipLines.forEach((line, i) => doc.text(line, margin, y + i * 12));
  billLines.forEach((line, i) => doc.text(line, margin + colWidth + 20, y + i * 12));
  y = addrY + Math.max(shipLines.length, billLines.length) * 12 + 26;

  // Line items table
  doc.setDrawColor(...STONE_DARK);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PINE);
  doc.text('ITEM', margin, y);
  doc.text('QTY', pageWidth - margin - 140, y, { align: 'right' });
  doc.text('PRICE', pageWidth - margin - 70, y, { align: 'right' });
  doc.text('TOTAL', pageWidth - margin, y, { align: 'right' });
  y += 10;
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...INK_SOFT);
  for (const item of order.items) {
    const label = item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name;
    doc.text(label, margin, y, { maxWidth: pageWidth - margin * 2 - 160 });
    doc.text(String(item.quantity), pageWidth - margin - 140, y, { align: 'right' });
    doc.text(formatCurrency(item.price), pageWidth - margin - 70, y, { align: 'right' });
    doc.text(formatCurrency(item.price * item.quantity), pageWidth - margin, y, { align: 'right' });
    y += 16;
  }

  y += 8;
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Totals — right-aligned block
  const totalsX = pageWidth - margin;
  const totalsLabelX = pageWidth - margin - 150;
  function totalRow(label: string, value: string, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const [r, g, b] = bold ? PINE : INK_SOFT;
    doc.setTextColor(r, g, b);
    doc.text(label, totalsLabelX, y);
    doc.text(value, totalsX, y, { align: 'right' });
    y += 15;
  }
  doc.setFontSize(9);
  totalRow('Subtotal', formatCurrency(order.subtotal));
  if (order.discount > 0) {
    totalRow(`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, `-${formatCurrency(order.discount)}`);
  }
  totalRow('Shipping', order.shippingCost === 0 ? 'Free' : formatCurrency(order.shippingCost));
  totalRow('Tax', formatCurrency(order.tax));
  doc.setDrawColor(...STONE_DARK);
  doc.line(totalsLabelX, y, totalsX, y);
  y += 14;
  doc.setFontSize(11);
  totalRow('Total', formatCurrency(order.total), true);

  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK_SOFT);
  doc.text(`Paid via ${order.payment.displayLabel}`, margin, y);
  doc.text(`Transaction ${order.payment.transactionId}`, margin, y + 13);

  // QR placeholder — explicitly not a real, scannable QR code.
  const qrSize = 64;
  const qrX = pageWidth - margin - qrSize;
  const qrY = y - 10;
  doc.setDrawColor(...PINE);
  doc.setLineWidth(1);
  doc.rect(qrX, qrY, qrSize, qrSize);
  const cornerSize = 14;
  [
    [qrX + 4, qrY + 4],
    [qrX + qrSize - cornerSize - 4, qrY + 4],
    [qrX + 4, qrY + qrSize - cornerSize - 4],
  ].forEach(([cx, cy]) => doc.rect(cx!, cy!, cornerSize, cornerSize));
  doc.setFontSize(6.5);
  doc.setTextColor(...INK_SOFT);
  doc.text('QR placeholder', qrX + qrSize / 2, qrY + qrSize + 12, { align: 'center' });
  doc.text('(not scannable)', qrX + qrSize / 2, qrY + qrSize + 21, { align: 'center' });

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 48;
  doc.setDrawColor(...STONE_DARK);
  doc.line(margin, footerY - 14, pageWidth - margin, footerY - 14);
  doc.setFontSize(8);
  doc.setTextColor(...INK_SOFT);
  doc.text(
    `Questions about this order? ${COMPANY.email}  ·  ${COMPANY.phone}  ·  This is a portfolio project — not a real business.`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  doc.save(`invoice-${order.id}.pdf`);
}
