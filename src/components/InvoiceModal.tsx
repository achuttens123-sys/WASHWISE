import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Printer, 
  Download, 
  X, 
  Receipt, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  Sparkles,
  CreditCard,
  ShieldCheck,
  Building,
  FileText
} from 'lucide-react';
import { Booking } from '../types';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface InvoiceModalProps {
  booking: Booking;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  booking,
  storeName = 'WASHWISE Central',
  storePhone = '+91 98470 12345',
  storeAddress = 'Main Hub, Store #1',
  onClose
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const displayId = booking.bookingId || `#${booking.id?.slice(-6).toUpperCase() || 'ORDER'}`;
  const invoiceNo = `INV-2026-${(booking.bookingId || booking.id?.slice(-6).toUpperCase() || '001').replace(/[^a-zA-Z0-9]/g, '')}`;
  const isCreditPayment = booking.paymentType === 'laundry_credits' || (booking.creditsUsed !== undefined && booking.creditsUsed > 0);
  const deliveryFee = booking.pickupDrop ? (booking.deliveryFee ?? 30) : 0;
  const basePrice = Math.max(0, booking.price - deliveryFee);
  const currentDateStr = format(new Date(), 'dd MMM yyyy');

  // Verify weight and pieces
  const displayWeight = booking.weightKg ? `${booking.weightKg} kg` : (booking.approxLoad || '5 kg');
  const displayPieces = booking.totalPieces 
    ? `${booking.totalPieces} pcs` 
    : (booking.pieceBreakdown ? `${booking.pieceBreakdown.reduce((sum, item) => sum + item.count, 0)} pcs` : 'N/A');

  const invoiceQrData = JSON.stringify({
    invoiceNo,
    orderId: displayId,
    customer: booking.userName,
    phone: booking.phone || '',
    amount: isCreditPayment ? `${booking.creditsUsed} Credits` : `₹${booking.price.toFixed(2)}`,
    status: 'PAID',
    service: booking.serviceType,
    date: booking.date,
    storeId: booking.storeId || 'Store #1'
  });

  const handlePrint = () => {
    // Record printed flag
    if (booking.id) {
      updateDoc(doc(db, 'bookings', booking.id), {
        invoicePrinted: true,
        invoicePrintedAt: new Date().toISOString()
      }).catch(() => {});
    }

    const printContent = document.getElementById('printable-tax-invoice');
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Tax Invoice - ${invoiceNo}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 12mm;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                margin: 0;
                padding: 10px;
                color: #111827;
                background: #fff;
              }
              .invoice-box {
                max-width: 800px;
                margin: 0 auto;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                padding: 24px;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #2563eb;
                padding-bottom: 16px;
                margin-bottom: 20px;
              }
              .logo {
                font-size: 28px;
                font-weight: 900;
                color: #2563eb;
                letter-spacing: -0.5px;
                margin: 0;
              }
              .tagline {
                font-size: 11px;
                color: #6b7280;
                font-weight: 600;
                margin: 2px 0 0 0;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .store-info {
                font-size: 11px;
                color: #4b5563;
                margin-top: 6px;
                line-height: 1.4;
              }
              .invoice-meta {
                text-align: right;
              }
              .invoice-title {
                font-size: 18px;
                font-weight: 900;
                color: #1f2937;
                margin: 0 0 4px 0;
              }
              .meta-text {
                font-size: 12px;
                color: #4b5563;
                margin: 2px 0;
              }
              .badge-paid {
                display: inline-block;
                background: #dcfce7;
                color: #15803d;
                font-size: 11px;
                font-weight: 900;
                padding: 2px 10px;
                border-radius: 9999px;
                margin-top: 4px;
                text-transform: uppercase;
              }
              .two-col {
                display: flex;
                justify-content: space-between;
                gap: 20px;
                margin-bottom: 20px;
                background: #f9fafb;
                padding: 14px;
                border-radius: 8px;
              }
              .col {
                flex: 1;
              }
              .section-heading {
                font-size: 10px;
                font-weight: 900;
                color: #9ca3af;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin: 0 0 6px 0;
              }
              .info-name {
                font-size: 14px;
                font-weight: 800;
                color: #111827;
                margin: 0 0 2px 0;
              }
              .info-detail {
                font-size: 12px;
                color: #4b5563;
                margin: 2px 0;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }
              th {
                background: #f3f4f6;
                padding: 10px 12px;
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                color: #374151;
                text-align: left;
                border-bottom: 2px solid #e5e7eb;
              }
              td {
                padding: 12px;
                font-size: 12px;
                color: #374151;
                border-bottom: 1px solid #e5e7eb;
              }
              .text-right {
                text-align: right;
              }
              .summary-box {
                margin-left: auto;
                width: 280px;
                margin-top: 10px;
              }
              .summary-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                font-size: 12px;
                color: #4b5563;
              }
              .total-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                font-size: 15px;
                font-weight: 900;
                color: #111827;
                border-top: 2px solid #111827;
                margin-top: 6px;
              }
              .footer {
                margin-top: 30px;
                border-top: 1px dashed #d1d5db;
                padding-top: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .footer-notes {
                font-size: 10px;
                color: #6b7280;
                line-height: 1.5;
                max-width: 480px;
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [37, 99, 235];
      const darkColor = [31, 41, 55];
      const margin = 20;
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // Top decorative stripe
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, width, 5, 'F');

      // Brand Title
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.text('WASHWISE', margin, 24);

      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text('SMART LAUNDRY & DRY CLEANING SYSTEMS', margin, 29);
      doc.text(`${storeName} • Store ID: ${booking.storeId || 'Central'}`, margin, 34);
      doc.text(`Phone: ${storePhone} | ${storeAddress}`, margin, 38);

      // Invoice Details on Right
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(14);
      doc.text('TAX INVOICE', width - margin - 55, 22);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.text(`Invoice No: ${invoiceNo}`, width - margin - 55, 28);
      doc.text(`Order ID: ${displayId}`, width - margin - 55, 33);
      doc.text(`Date: ${currentDateStr}`, width - margin - 55, 38);

      // Line
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(margin, 44, width - margin, 44);

      // Billed To Box
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, 48, width - margin * 2, 26, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('BILLED TO:', margin + 4, 54);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(`Customer Name: ${booking.userName}`, margin + 4, 60);
      doc.text(`Phone: ${booking.phone || 'N/A'}`, margin + 4, 65);
      if (booking.address) {
        doc.text(`Address: ${booking.address}`, margin + 4, 70, { maxWidth: width - margin * 2 - 10 });
      }

      // Machine & Slot Information Box
      const machineY = 78;
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.rect(margin, machineY, width - margin * 2, 14, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 138);
      doc.text(`Slot: ${booking.timeSlot} (Slot #${booking.slotNumber || '1'})`, margin + 4, machineY + 8);
      doc.text(`Assigned Machine: Machine #${booking.machineNumber || 'Auto'}`, margin + 70, machineY + 8);
      doc.text(`Status: PAID`, width - margin - 30, machineY + 8);

      // Table Header
      const tableY = machineY + 20;
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, tableY, width - margin * 2, 8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
      doc.text('SERVICE / ITEM DESCRIPTION', margin + 4, tableY + 5.5);
      doc.text('WEIGHT / PIECES', margin + 85, tableY + 5.5);
      doc.text('RATE / TYPE', margin + 120, tableY + 5.5);
      doc.text('AMOUNT', width - margin - 20, tableY + 5.5);

      // Table Rows
      let rowY = tableY + 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);

      doc.text(booking.serviceType, margin + 4, rowY);
      doc.text(`${displayWeight} • ${displayPieces}`, margin + 85, rowY);
      doc.text('Standard Unit', margin + 120, rowY);
      if (isCreditPayment) {
        doc.text(`${booking.creditsUsed} Credits`, width - margin - 20, rowY);
      } else {
        doc.text(`₹${basePrice.toFixed(2)}`, width - margin - 20, rowY);
      }

      if (booking.pickupDrop) {
        rowY += 8;
        doc.text('Pickup & Doorstep Delivery Fee', margin + 4, rowY);
        doc.text('Logistics', margin + 85, rowY);
        doc.text('Standard', margin + 120, rowY);
        if (isCreditPayment) {
          doc.text('FREE', width - margin - 20, rowY);
        } else {
          doc.text(`₹${deliveryFee.toFixed(2)}`, width - margin - 20, rowY);
        }
      }

      // Divider line
      rowY += 10;
      doc.setDrawColor(209, 213, 219);
      doc.line(margin, rowY, width - margin, rowY);

      // Total Section
      const totalY = rowY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text('TOTAL AMOUNT PAID', width - margin - 90, totalY);

      doc.setFontSize(12);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      if (isCreditPayment) {
        doc.text(`${booking.creditsUsed} Credits (₹0.00)`, width - margin - 35, totalY);
      } else {
        doc.text(`₹${booking.price.toFixed(2)}`, width - margin - 25, totalY);
      }

      // Payment Details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(`Payment Mode: ${booking.paymentType ? booking.paymentType.toUpperCase().replace(/_/g, ' ') : 'PREPAID'}`, margin + 4, totalY);
      doc.text(`Special Notes: ${booking.garmentInstructions || 'None'}`, margin + 4, totalY + 6);

      // Footer
      doc.setFontSize(8);
      doc.text('Computer-generated tax invoice for Washwise Smart Laundry. Keep for store records.', margin, height - 25);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('THANK YOU FOR YOUR BUSINESS!', margin, height - 18);

      const cleanInvoiceId = invoiceNo.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Invoice_${cleanInvoiceId}.pdf`);
    } catch (err) {
      console.error('Invoice PDF error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-3xl border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden my-6">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                Store Tax Invoice
                <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full font-bold">
                  {invoiceNo}
                </span>
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Official store challan & receipt with itemized service charges.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="p-8 max-h-[70vh] overflow-y-auto">
          <div id="printable-tax-invoice" className="invoice-box bg-white text-gray-900 border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            
            {/* Invoice Top Header */}
            <div className="header flex flex-col sm:flex-row justify-between items-start pb-4 border-b-2 border-blue-600 gap-4">
              <div>
                <h1 className="logo text-3xl font-black text-blue-600 tracking-tight">WASHWISE</h1>
                <p className="tagline text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                  Automated Smart Laundry & Dry Cleaning
                </p>
                <div className="store-info text-xs text-gray-600 mt-2 space-y-0.5">
                  <p className="font-bold text-gray-800">{storeName}</p>
                  <p>{storeAddress}</p>
                  <p>Store ID: <span className="font-mono font-bold text-blue-600">{booking.storeId || 'WW001KT'}</span> • Tel: {storePhone}</p>
                </div>
              </div>

              <div className="invoice-meta sm:text-right">
                <h3 className="invoice-title text-xl font-black text-gray-800 uppercase tracking-tight">TAX INVOICE</h3>
                <p className="meta-text text-xs text-gray-600 font-mono font-bold">{invoiceNo}</p>
                <p className="meta-text text-xs text-gray-500">Order ID: <span className="font-bold text-gray-800">{displayId}</span></p>
                <p className="meta-text text-xs text-gray-500">Date Issued: {currentDateStr}</p>
                <span className="badge-paid inline-block bg-green-100 text-green-800 text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full mt-1">
                  PAYMENT COMPLETED
                </span>
              </div>
            </div>

            {/* Customer & Machine Details */}
            <div className="two-col grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 my-4 text-xs">
              <div>
                <p className="section-heading text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                  CUSTOMER / BILLED TO
                </p>
                <p className="info-name text-sm font-black text-gray-900">{booking.userName}</p>
                <p className="info-detail text-gray-600">Phone: <span className="font-semibold text-gray-800">{booking.phone || 'N/A'}</span></p>
                {booking.address && (
                  <p className="info-detail text-gray-600 mt-1">
                    Delivery Address: <span className="text-gray-800 font-medium">{booking.address}</span>
                  </p>
                )}
              </div>

              <div>
                <p className="section-heading text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                  SERVICE & SLOT SPECIFICATIONS
                </p>
                <p className="info-detail text-gray-600">
                  Assigned Slot: <span className="font-bold text-gray-900">{booking.timeSlot} ({booking.slotNumber ? `Slot #${booking.slotNumber}` : 'Slot #1'})</span>
                </p>
                <p className="info-detail text-gray-600">
                  Assigned Machine: <span className="font-bold text-blue-700">Machine #{booking.machineNumber || 'Auto'}</span>
                </p>
                <p className="info-detail text-gray-600">
                  Service Date: <span className="font-bold text-gray-900">{booking.date}</span>
                </p>
                <p className="info-detail text-gray-600">
                  Type: <span className="font-bold text-indigo-700">{booking.serviceType}</span>
                </p>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="overflow-x-auto my-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="py-2.5 px-3 font-black text-gray-700 uppercase">Service Description</th>
                    <th className="py-2.5 px-3 font-black text-gray-700 uppercase">Load / Pieces</th>
                    <th className="py-2.5 px-3 font-black text-gray-700 uppercase">Rate</th>
                    <th className="py-2.5 px-3 font-black text-gray-700 uppercase text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 px-3">
                      <p className="font-bold text-gray-900">{booking.serviceType}</p>
                      <p className="text-[10px] text-gray-500">Commercial wash, sanitized rinse, and tumble fold</p>
                    </td>
                    <td className="py-3 px-3 font-medium text-gray-700">
                      {displayWeight} • {displayPieces}
                    </td>
                    <td className="py-3 px-3 text-gray-600 font-medium">Standard</td>
                    <td className="py-3 px-3 font-black text-gray-900 text-right">
                      {isCreditPayment ? `${booking.creditsUsed} Credits` : `₹${basePrice.toFixed(2)}`}
                    </td>
                  </tr>

                  {booking.pickupDrop && (
                    <tr>
                      <td className="py-3 px-3">
                        <p className="font-bold text-gray-900">Doorstep Pickup & Delivery</p>
                        <p className="text-[10px] text-gray-500">Scheduled vehicle logistics dispatch</p>
                      </td>
                      <td className="py-3 px-3 text-gray-500">2-Way Transit</td>
                      <td className="py-3 px-3 text-gray-600 font-medium">Fixed</td>
                      <td className="py-3 px-3 font-black text-gray-900 text-right">
                        {isCreditPayment ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary & QR Breakdown */}
            <div className="flex flex-col sm:flex-row justify-between items-end gap-6 pt-4 border-t border-gray-200">
              
              {/* QR Code for validation */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                  <QRCodeSVG
                    value={invoiceQrData}
                    size={64}
                    level="M"
                  />
                </div>
                <div className="text-[10px] text-gray-500 space-y-0.5">
                  <p className="font-black uppercase tracking-wider text-gray-700">Official Invoice QR</p>
                  <p>Scan to verify authenticity</p>
                  <p className="font-mono text-gray-400">{invoiceNo}</p>
                </div>
              </div>

              {/* Totals */}
              <div className="w-full sm:w-64 space-y-1 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold">
                    {isCreditPayment ? `${booking.creditsUsed} Credits` : `₹${basePrice.toFixed(2)}`}
                  </span>
                </div>
                {booking.pickupDrop && (
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Charges:</span>
                    <span className="font-semibold">
                      {isCreditPayment ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-black text-gray-900 pt-2 border-t-2 border-gray-900 mt-2">
                  <span>Total Amount Paid:</span>
                  <span className="text-base text-blue-600">
                    {isCreditPayment ? `${booking.creditsUsed} CREDITS` : `₹${booking.price.toFixed(2)}`}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 text-right font-medium">
                  Payment Mode: {booking.paymentType?.toUpperCase().replace(/_/g, ' ') || 'ONLINE / STORE'}
                </p>
              </div>

            </div>

            {/* Special Instructions Note */}
            {booking.garmentInstructions && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span className="font-black uppercase tracking-wider text-[10px] block mb-0.5">
                  Special Garment Instructions:
                </span>
                <p className="font-medium">{booking.garmentInstructions}</p>
              </div>
            )}

            {/* Footer */}
            <div className="footer text-[10px] text-gray-400 mt-6 pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-center sm:text-left">
              <p>Washwise Technologies Private Limited • Computer Generated Challan Slip • No signature required.</p>
              <p className="font-bold text-blue-600">THANK YOU FOR CHOOSING WASHWISE</p>
            </div>

          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-8 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-500 font-medium">
            Ready to print on standard A4 or thermal printer.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="py-2.5 px-4 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </button>

            <button
              onClick={handlePrint}
              className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
