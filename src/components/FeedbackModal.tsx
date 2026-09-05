import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, MessageSquare, X, CheckCircle2, Send, HelpCircle, AlertCircle, Sparkles, ThumbsUp } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId?: string;
  initialCategory?: string;
  title?: string;
  subtitle?: string;
  isOptional?: boolean;
}

const CATEGORIES = [
  { id: 'general_feedback', label: 'General Feedback' },
  { id: 'booking_query', label: 'Booking & Slot Query' },
  { id: 'payment_issue', label: 'Payment / Refund Issue' },
  { id: 'service_issue', label: 'Washing / Machine Issue' },
  { id: 'suggestion', label: 'Feature Suggestion' },
  { id: 'other', label: 'Other Query' }
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  initialCategory = 'general_feedback',
  title = 'Help, Queries & Feedback',
  subtitle = 'How was your experience, or do you need assistance with anything?',
  isOptional = true
}) => {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [category, setCategory] = useState<string>(initialCategory);
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && rating === 0) {
      setError('Please provide a rating or enter your feedback / query.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user?.uid || 'anonymous',
        userName: user?.name || 'Guest User',
        userEmail: user?.email || '',
        userPhone: user?.phone || '',
        bookingId: bookingId || null,
        category,
        rating: rating || null,
        subject: subject.trim() || null,
        message: message.trim(),
        status: 'new',
        createdAt: new Date().toISOString()
      });

      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setRating(5);
    setMessage('');
    setSubject('');
    setError('');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800 relative overflow-hidden"
        >
          {/* Top Close Button */}
          <button
            onClick={handleResetAndClose}
            className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                Thank You!
              </h3>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
                Your feedback/query has been submitted successfully. Our team will review it and assist you if needed.
              </p>
              <button
                onClick={handleResetAndClose}
                className="mt-6 px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
              >
                Close Window
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1 pr-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                  <Sparkles className="w-3 h-3" /> Optional Feedback & Support
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  {title}
                </h3>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  {subtitle}
                </p>
              </div>

              {/* Rating Section */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-center space-y-2">
                <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                  How would you rate your experience? (Optional)
                </label>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= (hoverRating || rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">
                  Topic / Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`px-3 py-2 text-xs font-bold rounded-xl border text-left transition-all truncate ${
                        category === cat.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">
                  Subject / Short Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Slot timing query or app suggestion"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Feedback Text / Query */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">
                  Your Feedback or Query
                </label>
                <textarea
                  rows={3}
                  placeholder="Share details, issue description, or thoughts..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Modal Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {isOptional && (
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="flex-1 py-3 px-4 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all text-xs uppercase tracking-wider"
                  >
                    Skip / Not Now
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FeedbackModal;
