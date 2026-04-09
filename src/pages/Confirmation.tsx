import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, Calendar, Clock, Monitor, ArrowRight, Download, Share2, Printer, ReceiptText, User, Hash, CreditCard, AlertCircle, RefreshCw } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Booking } from '../types';

const Confirmation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
                <p className="text-sm font-black text-gray-800 dark:text-gray-100 break-all">{bookingId?.toUpperCase()}</p>
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
                    <p className="text-2xl font-black text-gray-800 dark:text-gray-100">Machine #{booking.machineNumber}</p>
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{booking.serviceType} ({booking.approxLoad})</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">₹{booking.price.toFixed(2)}</span>
                </div>
                {booking.pointsEarned && booking.pointsEarned > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">Points Earned</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">+{booking.pointsEarned} pts</span>
                  </div>
                )}
                {booking.pointsRedeemed && booking.pointsRedeemed > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-600 dark:text-red-400 font-medium">Points Redeemed</span>
                    <span className="font-bold text-red-600 dark:text-red-400">-{booking.pointsRedeemed} pts</span>
                  </div>
                )}
                {booking.pickupDrop && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Pickup & Drop Service</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">Included</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                  <div className="flex items-center text-blue-600 dark:text-blue-400">
                    <CreditCard className="w-4 h-4 mr-2" />
                    <span className="text-xs font-bold uppercase tracking-wider">Total Amount Paid</span>
                  </div>
                  <span className="text-xl font-black text-gray-800 dark:text-gray-100">₹{booking.price.toFixed(2)}</span>
                </div>
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
          <button className="text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center transition-colors">
            <Download className="w-4 h-4 mr-2" /> Download PDF
          </button>
          <button className="text-sm font-bold text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center transition-colors">
            <Share2 className="w-4 h-4 mr-2" /> Share Receipt
          </button>
        </div>
      </motion.div>

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
