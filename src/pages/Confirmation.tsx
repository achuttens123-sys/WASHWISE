import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, Calendar, Clock, Monitor, ArrowRight, Download, Share2, Printer, ReceiptText, User, Hash, CreditCard, AlertCircle, RefreshCw, Check, MessageSquare, Star, Sparkles } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Booking } from '../types';
import FeedbackModal from '../components/FeedbackModal';

const Confirmation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      const id = searchParams.get('id') || localStorage.getItem('lastBookingId');
      if (!id) {
        navigate('/dashboard');
        return;
      }
      setBookingId(id);

      try {
        const bookingDoc = await getDoc(doc(db, 'bookings', id));
        if (bookingDoc.exists()) {
          setBooking(bookingDoc.data() as Booking);
        }
      } catch (error) {
        console.error("Error fetching booking:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [navigate]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!booking) return;
    setIsDownloading(true);

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Colors
      const primaryColor = [37, 99, 235]; // Blue 600 (#2563eb)
      const secondaryColor = [31, 41, 55]; // Gray 800
      const lightGray = [243, 244, 246]; // Gray 100
      const borderGray = [229, 231, 235]; // Gray 200

      // Margins & Dimensions
      const margin = 20;
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();

      // Background decorative top bar
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, width, 5, 'F');

      // Brand Header
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.text('WASHWISE', margin, 25);

      doc.setTextColor(156, 163, 175); // Gray 400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('LAUNDRY & DRY CLEANING CHALLAN SLIP', margin, 31);

      // Invoice metadata (top-right)
      const displayId = booking.bookingId || bookingId?.toUpperCase() || 'N/A';

      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('INVOICE / CHALLAN', width - margin - 55, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128); // Gray 500
      doc.text(`Invoice No: ${displayId}`, width - margin - 55, 25);
      doc.text(`Date Issued: ${new Date().toLocaleDateString()}`, width - margin - 55, 30);
      doc.text(`Service Date: ${booking.date}`, width - margin - 55, 35);

      // Divider line
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, 42, width - margin, 42);

      // Customer Details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('BILL TO:', margin, 52);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99); // Gray 600
      doc.text(`Customer Name: ${booking.userName}`, margin, 58);
      doc.text(`Phone: ${booking.phone || 'N/A'}`, margin, 64);
      if (booking.pickupDrop && booking.address) {
        doc.text(`Address: ${booking.address}`, margin, 70, { maxWidth: width - (margin * 2) - 10 });
      }

      // Machine Assignment Box
      const machineY = booking.pickupDrop && booking.address ? 82 : 76;
      doc.setFillColor(239, 246, 255); // Blue 50
      doc.setDrawColor(191, 219, 254); // Blue 200
      doc.rect(margin, machineY, width - (margin * 2), 16, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 138); // Blue 900
      doc.text(`ASSIGNED MACHINE: Machine #${booking.machineNumber || 'Pending'}`, margin + 5, machineY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text(`Status: ${booking.status.toUpperCase()}`, width - margin - 40, machineY + 10);

      // Service Summary Table Header
      const tableY = machineY + 28;
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(margin, tableY, width - (margin * 2), 10, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81); // Gray 700
      doc.text('DESCRIPTION', margin + 4, tableY + 6.5);
      doc.text('WEIGHT/LOAD', margin + 100, tableY + 6.5);
      doc.text('AMOUNT', width - margin - 25, tableY + 6.5);

      // Table Row
      const rowY = tableY + 16;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      
      const isCreditPayment = booking.paymentType === 'laundry_credits' || (booking.creditsUsed !== undefined && booking.creditsUsed > 0);
      const deliveryFee = booking.pickupDrop ? (booking.deliveryFee ?? 30) : 0;
      const basePrice = booking.price - deliveryFee;

      doc.text(`${booking.serviceType}`, margin + 4, rowY);
      doc.text(`${booking.approxLoad}`, margin + 100, rowY);
      if (isCreditPayment) {
        doc.text(`${booking.creditsUsed} Credits (Covered)`, width - margin - 35, rowY);
      } else {
        doc.text(`₹${basePrice.toFixed(2)}`, width - margin - 25, rowY);
      }

      // If pickupDrop is enabled, show the delivery fee line
      let totalY = rowY + 12;
      if (booking.pickupDrop) {
        doc.text('Pickup & Drop Service Fee', margin + 4, rowY + 8);
        if (isCreditPayment) {
          doc.text('FREE (Subscriber)', width - margin - 35, rowY + 8);
        } else {
          doc.text(`₹${deliveryFee.toFixed(2)}`, width - margin - 25, rowY + 8);
        }
        totalY += 8;
      }

      // Divider for totals
      doc.line(margin, totalY - 4, width - margin, totalY - 4);

      // Total Paid
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('TOTAL AMOUNT PAID', margin + 4, totalY + 4);
      doc.setFontSize(13);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      if (isCreditPayment) {
        doc.text(`${booking.creditsUsed} CREDITS (₹0.00)`, width - margin - 45, totalY + 4);
      } else {
        doc.text(`₹${booking.price.toFixed(2)}`, width - margin - 25, totalY + 4);
      }

      // Footer Notes
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text('This is a computer-generated challan and receipt for services booked on Washwise.', margin, height - 30);
      doc.text('Please keep this invoice handy when picking up your laundry.', margin, height - 25);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('THANK YOU FOR CHOOSING WASHWISE!', margin, height - 18);

      // Save PDF
      const pdfId = (booking.bookingId || bookingId || 'Booking').replace(/\//g, '_');
      doc.save(`Washwise_Invoice_${pdfId}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF invoice:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareReceipt = async () => {
    if (!booking) return;

    const isCreditPayment = booking.paymentType === 'laundry_credits' || (booking.creditsUsed !== undefined && booking.creditsUsed > 0);
    const displayId = booking.bookingId || bookingId?.toUpperCase() || 'N/A';
    const amountStr = isCreditPayment ? `${booking.creditsUsed} Laundry Credits (₹0.00)` : `₹${booking.price.toFixed(2)}`;
    const shareText = `WASHWISE LAUNDRY CHALLAN\n\nBooking ID: ${displayId}\nCustomer: ${booking.userName}\nService: ${booking.serviceType} (${booking.approxLoad})\nDate: ${booking.date} at ${booking.timeSlot}\nAssigned Machine: Machine #${booking.machineNumber || 'Pending'}\nTotal Paid: ${amountStr}\nStatus: ${booking.status.toUpperCase()}\n\nThank you for choosing Washwise!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Washwise Booking Receipt',
          text: shareText,
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!booking) return null;

  const isRejected = booking.status === 'rejected';
  const isRescheduled = booking.status === 'rescheduled';

  const deliveryFee = booking.pickupDrop ? (booking.deliveryFee ?? 30) : 0;
  const basePrice = booking.price - deliveryFee;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Status Header */}
        <div className="text-center space-y-4">
          <motion.div 
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-sm animate-pulse-glow ${
              isRejected ? 'bg-red-100 glow-red' : isRescheduled ? 'bg-blue-100 glow-blue' : 'bg-green-100 glow-green'
            }`}
          >
            {isRejected ? (
              <AlertCircle className="w-10 h-10 text-red-600" />
            ) : isRescheduled ? (
              <RefreshCw className="w-10 h-10 text-blue-600 animate-spin-slow" />
            ) : (
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            )}
          </motion.div>
          
          <h1 className={`text-3xl font-black tracking-tight uppercase ${
            isRejected ? 'text-red-600' : isRescheduled ? 'text-blue-600' : 'text-gray-800 dark:text-gray-100'
          }`}>
            {isRejected ? 'BOOKING REJECTED' : isRescheduled ? 'BOOKING RESCHEDULED' : 'BOOKING SUCCESSFUL!'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium max-w-xs mx-auto">
            {isRejected 
              ? 'Unfortunately, your booking could not be processed at this time.' 
              : isRescheduled 
              ? 'Your booking time has been adjusted by the administrator.' 
              : 'Your laundry slot has been reserved. Please arrive 5 minutes before your time.'}
          </p>
          
          {(isRejected || isRescheduled) && booking.rejectionReason && (
            <div className={`mt-4 p-4 rounded-2xl border ${
              isRejected ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-400'
            } text-sm font-bold`}>
              Reason: {booking.rejectionReason}
            </div>
          )}
        </div>

        {/* Challan Slip / Receipt */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className={`bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl border overflow-hidden relative print:shadow-none print:border-none ${
            isRejected ? 'border-red-100 dark:border-red-900/30 grayscale-[0.5]' : 'border-gray-100 dark:border-gray-800'
          }`}
        >
          {/* Decorative Top Bar */}
          <div className={`h-3 w-full ${isRejected ? 'bg-red-600' : 'bg-blue-600'}`} />
          
          <div className="p-8 md:p-12 space-y-8">
            {/* Receipt Header */}
            <div className="flex justify-between items-start border-b border-dashed border-gray-200 dark:border-gray-700 pb-8">
              <div className="space-y-1">
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">WASHWISE</p>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Laundry Challan Slip</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Date Issued</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Main Details Grid */}
            <div className="grid grid-cols-2 gap-y-8 gap-x-4">
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="space-y-1">
                <div className="flex items-center text-gray-400 dark:text-gray-500 mb-1">
                  <Hash className="w-3 h-3 mr-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Booking ID</span>
                </div>
                <p className="text-sm font-black text-gray-800 dark:text-gray-100 break-all">{booking.bookingId || bookingId?.toUpperCase()}</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="space-y-1">
                <div className="flex items-center text-gray-400 dark:text-gray-500 mb-1">
                  <User className="w-3 h-3 mr-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Customer</span>
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{booking.userName}</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }} className="space-y-1">
                <div className="flex items-center text-gray-400 dark:text-gray-500 mb-1">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Service Date</span>
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{booking.date}</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 }} className="space-y-1">
                <div className="flex items-center text-gray-400 dark:text-gray-500 mb-1">
                  <Clock className="w-3 h-3 mr-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Time Slot</span>
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{booking.timeSlot}</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="col-span-full bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/30 flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div className="bg-blue-600 p-3 rounded-2xl mr-4 shadow-lg shadow-blue-200 dark:shadow-none">
                    <Monitor className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Assigned Machine</p>
                    <p className="text-2xl font-black text-gray-800 dark:text-gray-100">Machine #{booking.machineNumber || 'Pending'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Status</p>
                  <p className={`text-sm font-black uppercase tracking-tight ${
                    isRejected ? 'text-red-600' : isRescheduled ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {booking.status.toUpperCase()}
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Service Summary */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center text-gray-400 dark:text-gray-500">
                <ReceiptText className="w-4 h-4 mr-2" />
                <span className="text-xs font-bold uppercase tracking-wider">Service Summary</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-2">
                {booking.paymentType === 'laundry_credits' || (booking.creditsUsed !== undefined && booking.creditsUsed > 0) ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{booking.serviceType} ({booking.approxLoad})</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{booking.creditsUsed} Credits</span>
                    </div>
                    {booking.serviceType === 'Wash & Fold (Per Piece)' && booking.pieceBreakdown && booking.pieceBreakdown.length > 0 && (
                      <div className="py-2 px-3 my-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Itemized Garments</p>
                        {booking.pieceBreakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>{item.count}x {item.name}</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {item.totalCredits || (item.subscriberCredits ? item.subscriberCredits * item.count : (item.unitCredits ? item.unitCredits * item.count : item.count * 3))} Credits
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {booking.pickupDrop && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Pickup & Drop Service</span>
                        <span className="font-bold text-green-600 dark:text-green-400">FREE (Subscriber Benefit)</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                      <div className="flex items-center text-green-600 dark:text-green-400">
                        <CreditCard className="w-4 h-4 mr-2" />
                        <span className="text-xs font-bold uppercase tracking-wider">Total Paid</span>
                      </div>
                      <span className="text-lg font-black text-green-600 dark:text-green-400">
                        {booking.creditsUsed} Credits (₹0.00)
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{booking.serviceType} ({booking.approxLoad})</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">₹{basePrice.toFixed(2)}</span>
                    </div>
                    {booking.serviceType === 'Wash & Fold (Per Piece)' && booking.pieceBreakdown && booking.pieceBreakdown.length > 0 && (
                      <div className="py-2 px-3 my-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Itemized Garments</p>
                        {booking.pieceBreakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                            <span>{item.count}x {item.name}</span>
                            <span>₹{item.totalPrice}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {booking.pickupDrop && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Pickup & Drop Service</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">₹{deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                      <div className="flex items-center text-blue-600 dark:text-blue-400">
                        <CreditCard className="w-4 h-4 mr-2" />
                        <span className="text-xs font-bold uppercase tracking-wider">Total Amount Paid</span>
                      </div>
                      <span className="text-xl font-black text-gray-800 dark:text-gray-100">₹{booking.price.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer Note */}
            <div className="text-center pt-4">
              <div className="inline-block bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Thank you for choosing WASHWISE
                </p>
              </div>
            </div>
          </div>

          {/* Receipt Cut Line (Visual Only) */}
          <div className="absolute bottom-0 left-0 right-0 h-1 flex justify-between px-2">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="w-2 h-2 bg-gray-50 dark:bg-gray-900 rounded-full -mb-1" />
            ))}
          </div>
        </motion.div>

        {/* Optional Post-Payment Feedback Card */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900/40 rounded-3xl p-5 sm:p-6 shadow-sm no-print flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                  Optional Feedback
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                How was your payment & booking process?
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Help us improve WashWise! Takes less than 15 seconds.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsFeedbackModalOpen(true)}
            className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 uppercase tracking-wider shrink-0"
          >
            <Star className="w-4 h-4 fill-amber-300 text-amber-300" /> Rate & Feedback
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 no-print">
          <button 
            onClick={handlePrint}
            className="flex-1 py-4 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center shadow-sm haptic-feedback"
          >
            <Printer className="w-5 h-5 mr-2" /> Print Challan
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center haptic-feedback glow-blue"
          >
            Go to Dashboard <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>

        {/* Secondary Actions */}
        <div className="flex justify-center gap-6 no-print">
          <button 
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </button>
          <button 
            onClick={handleShareReceipt}
            className="text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center transition-colors"
          >
            {isCopied ? (
              <Check className="w-4 h-4 mr-2 text-green-500" />
            ) : (
              <Share2 className="w-4 h-4 mr-2" />
            )}
            {isCopied ? 'Copied!' : 'Share Receipt'}
          </button>
        </div>
      </motion.div>

      {/* Optional Post-Payment Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        bookingId={booking?.bookingId || bookingId || undefined}
        title="Payment & Booking Feedback"
        subtitle="How was your booking & payment experience? This is completely optional."
        isOptional={true}
      />

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          main { padding: 0 !important; }
          header, footer { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Confirmation;
