import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { 
  Printer, 
  Download, 
  X, 
  Tag, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Check, 
  Save, 
  QrCode, 
  User, 
  Barcode as BarcodeIcon, 
  ChevronLeft, 
  ChevronRight, 
  ListOrdered, 
  Sparkles,
  Camera
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Booking } from '../types';
import { format, addDays } from 'date-fns';
import { jsPDF } from 'jspdf';
import { TagScannerModal } from './TagScannerModal';

interface WashingTagModalProps {
  booking: Booking;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  onClose: () => void;
  onUpdated?: (updatedBooking: Partial<Booking>) => void;
  onOpenScanner?: () => void;
}

// 1D Linear Barcode Renderer Component - Small Barcode
const LinearBarcode: React.FC<{ value: string; height?: number; width?: number; className?: string }> = ({
  value,
  height = 18,
  width = 1.05,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        const cleanVal = value.replace(/[^A-Za-z0-9\-_.]/g, '');
        JsBarcode(svgRef.current, cleanVal || 'TAG1001', {
          format: 'CODE128',
          width: width,
          height: height,
          displayValue: true,
          fontSize: 8,
          font: 'monospace',
          textMargin: 1,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000'
        });
      } catch (e) {
        console.warn('Barcode render warning:', e);
      }
    }
  }, [value, height, width]);

  return <svg ref={svgRef} className={`mx-auto block ${className}`} />;
};

export const WashingTagModal: React.FC<WashingTagModalProps> = ({
  booking,
  storeName = 'WASHWISE Central',
  storePhone = '+91 98470 12345',
  storeAddress = 'Main Hub, Store #1',
  onClose,
  onUpdated,
  onOpenScanner
}) => {
  // 1. Customer Name
  const [customerName, setCustomerName] = useState(booking.userName || 'Customer');

  // 2. Date of Delivery
  const defaultPickDate = booking.pickupDate || booking.date || format(new Date(), 'yyyy-MM-dd');
  const defaultDeliveryDate = booking.deliveryDate || (
    booking.serviceType === 'Express Wash'
      ? defaultPickDate
      : format(addDays(new Date(defaultPickDate || new Date()), 1), 'yyyy-MM-dd')
  );
  const [deliveryDate, setDeliveryDate] = useState(defaultDeliveryDate);

  // 3. Number of Pieces
  const defaultPieces = booking.totalPieces ? booking.totalPieces :
    (booking.pieceBreakdown ? booking.pieceBreakdown.reduce((acc, curr) => acc + curr.count, 0) : 5);
  const [pieces, setPieces] = useState<number>(Math.max(1, defaultPieces));
  const [currentPiece, setCurrentPiece] = useState<number>(1);

  // 4. Special Instructions
  const [specialInstructions, setSpecialInstructions] = useState(booking.garmentInstructions || '');

  // Secondary states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewMode, setPreviewMode] = useState<'single' | 'list'>('single');
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  const displayOrderId = booking.bookingId || `#${booking.id?.slice(-6).toUpperCase() || 'ORDER'}`;
  const validCurrentPiece = Math.min(Math.max(1, currentPiece), pieces);

  // Quick instruction presets for laundry staff
  const quickInstructionPresets = [
    'Whites are separate',
    'Delicate wash, cold water only',
    'Do not tumble dry (Air dry)',
    'Collar & cuff stain treatment',
    'Low heat iron only',
    'Hand wash cycle only'
  ];

  // Formatted Delivery Date display
  const formattedDeliveryDate = useMemo(() => {
    try {
      return format(new Date(deliveryDate), 'dd/MM/yyyy');
    } catch {
      return deliveryDate;
    }
  }, [deliveryDate]);

  // Formats human-readable scan text so anyone scanning knows EXACTLY what it means
  const getScannableDetailsText = (pieceIndex: number, totalPieces: number) => {
    const lines = [
      `WASHWISE LAUNDRY TAG`,
      `ID: ${displayOrderId}`,
      `NAME: ${customerName.toUpperCase()}`,
      `NO PIECES: ${pieceIndex} / ${totalPieces}`,
      `DATE OF DELIVERY: ${deliveryDate} (${formattedDeliveryDate})`,
      `SPECIAL: ${specialInstructions || 'None'}`,
      `STORE: ${storeName}`
    ];
    return lines.join('\n');
  };

  const getCleanTagBarcodeId = (pieceIndex: number, totalPieces: number) => {
    const rawId = (booking.bookingId || booking.id?.slice(-6) || 'ORD').replace(/[^a-zA-Z0-9]/g, '');
    return `${rawId}-P${String(pieceIndex).padStart(2, '0')}-${totalPieces}`;
  };

  const handleSaveChanges = async () => {
    if (!booking.id) return;
    setIsSaving(true);
    try {
      const updateData: Partial<Booking> = {
        userName: customerName,
        deliveryDate: deliveryDate,
        totalPieces: pieces,
        garmentInstructions: specialInstructions,
        tagPrinted: true,
        tagPrintedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'bookings', booking.id), updateData);
      setSaveSuccess(true);
      if (onUpdated) onUpdated(updateData);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${booking.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to open clean print window with user's exact layout
  const executePrint = (htmlContent: string, title: string) => {
    if (booking.id) {
      updateDoc(doc(db, 'bookings', booking.id), {
        tagPrinted: true,
        tagPrintedAt: new Date().toISOString()
      }).catch(() => {});
    }

    const printWindow = window.open('', '_blank', 'width=460,height=800');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              @page {
                size: 80mm auto;
                margin: 2mm;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                margin: 0;
                padding: 4px;
                color: #000;
                background: #fff;
                width: 76mm;
                box-sizing: border-box;
              }
              .tag-page {
                page-break-after: always;
                break-after: page;
                page-break-inside: avoid;
                margin-bottom: 12px;
                padding-bottom: 4px;
              }
              .tag-page:last-child {
                page-break-after: avoid;
                break-after: avoid;
              }
              .tag-container {
                border: 2px solid #000;
                border-radius: 8px;
                padding: 8px 10px;
                box-sizing: border-box;
                background: #fff;
              }
              .brand-header {
                text-align: center;
                border-bottom: 1.5px solid #000;
                padding-bottom: 3px;
                margin-bottom: 6px;
              }
              .brand-title {
                font-size: 14px;
                font-weight: 900;
                letter-spacing: 1px;
                margin: 0;
                text-transform: uppercase;
              }
              .brand-sub {
                font-size: 7.5px;
                font-weight: 700;
                color: #444;
                margin: 1px 0 0 0;
              }
              /* User's Exact Layout Grid */
              .tag-main-row {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 4px 0;
              }
              .qr-col {
                width: 80px;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1.5px solid #000;
                border-radius: 8px;
                padding: 3px;
                background: #fff;
              }
              .details-col {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 4px;
                min-width: 0;
              }
              .info-block {
                line-height: 1.15;
              }
              .info-label {
                font-size: 7px;
                font-weight: 900;
                text-transform: uppercase;
                color: #555;
                display: block;
                letter-spacing: 0.5px;
              }
              .info-val {
                font-size: 11px;
                font-weight: 900;
                color: #000;
                text-transform: uppercase;
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .info-val.val-id {
                font-family: monospace;
                font-size: 10px;
              }
              .instructions-box {
                border: 1.5px solid #000;
                border-radius: 6px;
                padding: 4px 6px;
                background: #fff8e1;
                margin-top: 5px;
              }
              .instructions-head {
                font-size: 7.5px;
                font-weight: 900;
                text-transform: uppercase;
                color: #b78103;
                margin-bottom: 1px;
              }
              .instructions-content {
                font-size: 10px;
                font-weight: 800;
                color: #000;
                line-height: 1.2;
              }
              .barcode-bottom {
                border-top: 1.5px dashed #000;
                padding-top: 4px;
                margin-top: 6px;
                text-align: center;
              }
              .footer {
                text-align: center;
                font-size: 7px;
                color: #666;
                margin-top: 3px;
                font-weight: bold;
              }
              svg {
                display: block;
                margin: 0 auto;
              }
            </style>
          </head>
          <body>
            ${htmlContent}
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

  // 1-Click Print All N Tags (1/N to N/N)
  const handlePrintAllTags = () => {
    const allTagsContainer = document.getElementById('printable-all-tags-container');
    if (!allTagsContainer) return;
    executePrint(allTagsContainer.innerHTML, `Washing Tags (1 to ${pieces}) - ${customerName}`);
  };

  // Print single piece tag
  const handlePrintSingleTag = () => {
    const singleTagContainer = document.getElementById(`tag-piece-${validCurrentPiece}`);
    if (!singleTagContainer) return;
    executePrint(singleTagContainer.innerHTML, `Washing Tag (${validCurrentPiece}/${pieces}) - ${customerName}`);
  };

  // Draw tag on PDF according to user's layout:
  // [ QR ] on left, ID/NAME/NO PIECES/DATE OF DELIVERY on right, small barcode on bottom
  const drawTagOnPDF = (doc: jsPDF, pieceIdx: number, totalPcs: number) => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 80, 110, 'F');

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.rect(3, 3, 74, 104);

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('WASHWISE', 40, 8.5, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(storeName, 40, 12, { align: 'center' });

    doc.setLineWidth(0.3);
    doc.line(5, 14, 75, 14);

    // Left Column: QR box (x: 5, y: 16, w: 26, h: 26)
    doc.setLineWidth(0.4);
    doc.rect(5, 16, 26, 26);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('QR CODE', 18, 28, { align: 'center' });
    doc.setFontSize(5);
    doc.text(`TAG ${pieceIdx}/${totalPcs}`, 18, 33, { align: 'center' });

    // Right Column: 4 items (ID, NAME, NO PIECES, DATE OF DELIVERY)
    // 1. ID
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.text('ID:', 34, 19);
    doc.setFontSize(7.5);
    doc.setFont('courier', 'bold');
    doc.text(displayOrderId, 34, 23);

    // 2. NAME
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text('NAME:', 34, 27);
    doc.setFontSize(8.5);
    doc.text(customerName.toUpperCase(), 34, 31);

    // 3. NO PIECES
    doc.setFontSize(5.5);
    doc.text('NO PIECES:', 34, 35);
    doc.setFontSize(8.5);
    doc.text(`${pieceIdx} / ${totalPcs}`, 34, 39);

    // 4. DATE OF DELIVERY
    doc.setFontSize(5.5);
    doc.text('DATE OF DELIVERY:', 34, 43);
    doc.setFontSize(8);
    doc.text(formattedDeliveryDate, 34, 47);

    // Special Instructions (if any)
    let currentY = 51;
    if (specialInstructions) {
      doc.setFillColor(255, 248, 225);
      doc.rect(5, currentY, 70, 9, 'FD');
      doc.setTextColor(180, 120, 0);
      doc.setFontSize(5.5);
      doc.text('SPECIAL INSTRUCTIONS:', 7, currentY + 3.5);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(6.5);
      doc.text(specialInstructions, 7, currentY + 7);
      currentY += 12;
    } else {
      currentY += 3;
    }

    // Small barcode bottom
    doc.setLineDashPattern([1, 1], 0);
    doc.line(5, currentY, 75, currentY);
    doc.setLineDashPattern([], 0);

    doc.setFontSize(7);
    doc.setFont('courier', 'bold');
    doc.text(`*${getCleanTagBarcodeId(pieceIdx, totalPcs)}*`, 40, currentY + 6, { align: 'center' });

    // Footer
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tag ${pieceIdx}/${totalPcs} • Washwise Systems`, 40, 104, { align: 'center' });
  };

  // Download multi-page PDF with 1 page per piece tag
  const handleDownloadAllPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 110]
      });

      for (let p = 1; p <= pieces; p++) {
        if (p > 1) {
          doc.addPage([80, 110], 'portrait');
        }
        drawTagOnPDF(doc, p, pieces);
      }

      const cleanName = (customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Washing_Tags_1_to_${pieces}_${cleanName}.pdf`);
    } catch (e) {
      console.warn('Failed to create PDF:', e);
    }
  };

  // User's Requested Tag Markup:
  // [           ]  ID
  // [  QR    ]  NAME
  // [           ]  NO PIECES
  // [           ]  DATE OF DELIVERY
  // small barcode
  const renderTagMarkup = (pieceIdx: number, totalPcs: number, isPrintOnly = false) => {
    const scanData = getScannableDetailsText(pieceIdx, totalPcs);
    const barcodeId = getCleanTagBarcodeId(pieceIdx, totalPcs);

    return (
      <div 
        key={pieceIdx}
        id={`tag-piece-${pieceIdx}`} 
        className={`tag-page ${isPrintOnly ? '' : 'w-full max-w-[340px] select-none'}`}
      >
        <div className="tag-container bg-white text-gray-900 border-2 border-black rounded-3xl p-4 shadow-lg relative space-y-2">
          
          {/* Laundry net tie hole */}
          <div className="absolute top-3 right-3 w-4 h-4 rounded-full border border-black bg-gray-100 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
          </div>

          {/* Minimal Header */}
          <div className="brand-header text-center border-b border-black pb-1.5">
            <h1 className="brand-title text-sm font-black tracking-wider uppercase leading-none">WASHWISE</h1>
            <p className="brand-sub text-[8px] font-bold text-gray-600 mt-0.5">
              {storeName}
            </p>
          </div>

          {/* User's Exact Layout:
              [           ]  ID
              [  QR    ]  NAME
              [           ]  NO PIECES
              [           ]  DATE OF DELIVERY
          */}
          <div className="tag-main-row flex items-center gap-3 py-1">
            
            {/* [ QR ] Column on the left */}
            <div className="qr-col shrink-0 flex items-center justify-center p-1 bg-white border-2 border-black rounded-2xl shadow-xs">
              <QRCodeSVG
                value={scanData}
                size={82}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Right Column: 4 items (ID, NAME, NO PIECES, DATE OF DELIVERY) */}
            <div className="details-col flex-1 min-w-0 flex flex-col justify-center space-y-1.5">
              
              {/* Line 1: ID */}
              <div className="info-block leading-tight">
                <span className="info-label text-[7.5px] font-black uppercase tracking-wider text-gray-400 block">
                  ID
                </span>
                <span className="info-val val-id text-xs font-mono font-black text-black block truncate">
                  {displayOrderId}
                </span>
              </div>

              {/* Line 2: NAME */}
              <div className="info-block leading-tight">
                <span className="info-label text-[7.5px] font-black uppercase tracking-wider text-gray-400 block">
                  NAME
                </span>
                <span className="info-val text-sm font-black uppercase text-black block truncate">
                  {customerName}
                </span>
              </div>

              {/* Line 3: NO PIECES */}
              <div className="info-block leading-tight">
                <span className="info-label text-[7.5px] font-black uppercase tracking-wider text-gray-400 block">
                  NO PIECES
                </span>
                <span className="info-val text-xs font-black text-black font-mono block">
                  {pieceIdx} / {totalPcs}
                </span>
              </div>

              {/* Line 4: DATE OF DELIVERY */}
              <div className="info-block leading-tight">
                <span className="info-label text-[7.5px] font-black uppercase tracking-wider text-gray-400 block">
                  DATE OF DELIVERY
                </span>
                <span className="info-val text-xs font-black text-black block truncate">
                  {formattedDeliveryDate}
                </span>
              </div>

            </div>

          </div>

          {/* Special Instructions (if present) */}
          {specialInstructions && (
            <div className="instructions-box border border-black rounded-xl p-2 bg-amber-50">
              <div className="flex items-center gap-1 instructions-head text-[7.5px] font-black uppercase text-amber-900 mb-0.5">
                <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                <span>Special Instructions:</span>
              </div>
              <p className="instructions-content text-[10px] font-black text-black leading-snug">
                {specialInstructions}
              </p>
            </div>
          )}

          {/* Small Barcode at the bottom */}
          <div className="barcode-bottom border-t border-dashed border-gray-400 pt-1.5 text-center">
            <div className="overflow-hidden w-full flex flex-col items-center justify-center">
              <LinearBarcode value={barcodeId} height={18} width={1.05} />
            </div>
          </div>

          {/* Minimal Footer */}
          <div className="footer text-center text-[7px] font-bold text-gray-400 pt-0.5 border-t border-gray-100">
            Washwise Smart Laundry • Tag {pieceIdx}/{totalPcs}
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-5xl border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="px-8 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                Essential Laundry Tag
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold">
                  {displayOrderId}
                </span>
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Compact layout: QR alongside ID, Name, Pieces & Delivery Date, with small barcode at bottom.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Open Scanner Shortcut Button */}
            <button
              onClick={() => setIsScannerModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800"
              title="Open QR & Barcode Scanner to test or read tags"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Test QR Scanner</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Form, Right Preview */}
        <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Form Fields (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            
            <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Tag Data</h3>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-md">
                Live Sync
              </span>
            </div>

            {/* 1. Customer Name */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 block mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />
            </div>

            {/* 2. Date of Delivery */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 block mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Date of Delivery
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 pl-1">
                Formatted on tag: {formattedDeliveryDate}
              </p>
            </div>

            {/* 3. Number of Pieces (1/N to N/N) */}
            <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <ListOrdered className="w-4 h-4 text-indigo-600" />
                  No of Pieces
                </label>
                <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full shadow-xs">
                  Tags 1/{pieces} to {pieces}/{pieces}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={pieces}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setPieces(Math.max(1, Math.min(50, val)));
                  }}
                  className="w-20 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-indigo-300 dark:border-indigo-600 rounded-xl text-base font-black text-indigo-950 dark:text-indigo-100 outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                />
                <div className="flex-1 text-xs text-indigo-800 dark:text-indigo-300 font-medium">
                  Prints <span className="font-black">{pieces} tags</span> with piece number 1/{pieces} to {pieces}/{pieces}.
                </div>
              </div>
            </div>

            {/* 4. Special Instructions */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 block mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Special Instructions
              </label>
              <textarea
                rows={2}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Whites are separate, delicate wash."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {quickInstructionPresets.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (!specialInstructions) {
                        setSpecialInstructions(preset);
                      } else if (!specialInstructions.includes(preset)) {
                        setSpecialInstructions(`${specialInstructions}, ${preset}`);
                      }
                    }}
                    className="text-[9px] font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Save details to order */}
            <button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors border border-gray-200 dark:border-gray-700"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-bold">Saved to Order!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Update Details in Order'}</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Piece Tag Preview & Batch Printing (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            
            {/* Piece Navigator Header */}
            <div className="w-full max-w-[340px] flex items-center justify-between mb-3 bg-gray-50 dark:bg-gray-800 p-2 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPiece(prev => Math.max(1, prev - 1))}
                  disabled={validCurrentPiece <= 1}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Previous piece tag"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                </button>
                <div className="px-2 text-xs font-black uppercase tracking-wide text-gray-800 dark:text-gray-100">
                  Tag <span className="text-indigo-600 dark:text-indigo-400 font-mono text-sm">{validCurrentPiece}</span> of {pieces}
                </div>
                <button
                  onClick={() => setCurrentPiece(prev => Math.min(pieces, prev + 1))}
                  disabled={validCurrentPiece >= pieces}
                  className="p-1 rounded-lg hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  title="Next piece tag"
                >
                  <ChevronRight className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                </button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewMode('single')}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
                    previewMode === 'single'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setPreviewMode('list')}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
                    previewMode === 'list'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  All {pieces}
                </button>
              </div>
            </div>

            {/* Quick Chips 1..N */}
            {pieces > 1 && (
              <div className="w-full max-w-[340px] flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                {Array.from({ length: pieces }, (_, idx) => idx + 1).map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setCurrentPiece(num);
                      setPreviewMode('single');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap transition-all ${
                      validCurrentPiece === num
                        ? 'bg-indigo-600 text-white shadow-xs scale-105'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                    }`}
                  >
                    {num}/{pieces}
                  </button>
                ))}
              </div>
            )}

            {/* Live Tag Preview Area */}
            <div className="w-full max-w-[340px] max-h-[460px] overflow-y-auto px-1 flex flex-col items-center gap-4">
              {previewMode === 'single' ? (
                renderTagMarkup(validCurrentPiece, pieces)
              ) : (
                <div className="space-y-4 w-full flex flex-col items-center">
                  <div className="text-center py-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                      Viewing all {pieces} tags list (1/{pieces} to {pieces}/{pieces})
                    </span>
                  </div>
                  {Array.from({ length: pieces }, (_, i) => i + 1).map((pNum) => (
                    renderTagMarkup(pNum, pieces)
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons: 1-Click Print All N Tags */}
            <div className="w-full max-w-[340px] space-y-2 mt-4">
              
              <button
                onClick={handlePrintAllTags}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Printer className="w-4 h-4" />
                <span>Print All {pieces} Tags (1/{pieces} to {pieces}/{pieces})</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePrintSingleTag}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Piece {validCurrentPiece}/{pieces}</span>
                </button>

                <button
                  onClick={handleDownloadAllPDF}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF ({pieces} Tags)</span>
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Hidden Container with all piece tags rendered for instantaneous batch printing */}
      <div id="printable-all-tags-container" className="hidden">
        {Array.from({ length: pieces }, (_, i) => i + 1).map((pNum) => (
          renderTagMarkup(pNum, pieces, true)
        ))}
      </div>

      {/* Tag Scanner Modal */}
      {isScannerModalOpen && (
        <TagScannerModal
          onClose={() => setIsScannerModalOpen(false)}
          onOpenTagModal={() => setIsScannerModalOpen(false)}
          storeId={booking.storeId}
        />
      )}

    </div>
  );
};
