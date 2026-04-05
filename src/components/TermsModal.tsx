import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, ShieldCheck, ExternalLink, ScrollText, Loader2 } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  mode?: 'disclaimer' | 'detailed';
  loading?: boolean;
}

const TermsModal: React.FC<TermsModalProps> = ({ 
  isOpen, 
  onClose, 
  onAccept, 
  mode = 'disclaimer',
  loading = false
}) => {
  const [view, setView] = useState<'disclaimer' | 'detailed'>(mode);

  const disclaimerPoints = [
    "We provide washing, cleaning, and basic garment care services. Our service is intended for routine laundry and hygiene maintenance.",
    "While we strive to clean garments thoroughly, we do not guarantee complete removal of tough stains such as oil, ink, dye, paint, or old stains.",
    "We are not responsible for damage due to: Weak or worn-out fabrics, Loose buttons, embellishments, or stitching, or Pre-existing damage.",
    "We are not responsible for items left in pockets (e.g., money, electronics, accessories). Customers must ensure all garments are checked before submission.",
    "Clothes are cleaned, dried, and returned with a fresh finish. However, minor wrinkles may remain unless ironing services are specifically requested.",
    "Customers must be available during scheduled pickup/delivery time slots. Delays may result in rescheduling.",
    "In case of proven damage directly caused by our process, compensation will be limited to a maximum of 3× the service charge for that garment/load, and not the original garment value."
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-blue-50 dark:border-gray-800 flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-blue-50/50 dark:bg-blue-900/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              {view === 'disclaimer' ? (
                <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              ) : (
                <ScrollText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                {view === 'disclaimer' ? 'Service Terms & Disclaimers' : 'Detailed Terms & Conditions'}
              </h2>
              {view === 'disclaimer' && (
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Please review before proceeding</p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {view === 'disclaimer' ? (
            <div className="space-y-4">
              {disclaimerPoints.map((point, index) => (
                <div key={index} className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-xs font-black text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                    {point}
                  </p>
                </div>
              ))}
              
              <div className="pt-4">
                <button 
                  onClick={() => setView('detailed')}
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Detailed Terms & Conditions
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-gray-600 dark:text-gray-400">
              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">1. INTRODUCTION</h3>
                <p>These Terms & Conditions (“Terms”) govern the use of our laundry services and booking platform. By accessing or using our service, you agree to comply with and be bound by these Terms.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">2. SERVICE DESCRIPTION</h3>
                <p>We provide on-demand and subscription-based laundry services including:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Washing and cleaning of garments</li>
                  <li>Pickup and delivery (if opted)</li>
                  <li>Slot-based machine allocation</li>
                  <li>Optional add-on services (if available)</li>
                </ul>
                <p>Our services are intended for routine garment cleaning and hygiene maintenance only.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">3. USER RESPONSIBILITIES</h3>
                <p>By using our service, you agree to:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Provide accurate booking details</li>
                  <li>Ensure garments are suitable for machine washing</li>
                  <li>Check all pockets before submission</li>
                  <li>Separate delicate or color-bleeding garments</li>
                  <li>Inform us of any special care requirements</li>
                </ul>
                <p>Failure to do so may result in damage for which we shall not be held responsible.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">4. MACHINE USAGE POLICY</h3>
                <p>Each customer’s laundry is processed using a dedicated washing machine, ensuring no mixing of garments with other users and reducing the risk of cross-contamination.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">5. STAIN REMOVAL POLICY</h3>
                <p>We strive to clean garments effectively; however:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>We do not guarantee removal of all stains</li>
                  <li>Stains such as oil, ink, paint, dye, or old stains may not be fully removable</li>
                </ul>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">6. COLOR BLEEDING & FABRIC DAMAGE</h3>
                <p>We are not responsible for:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Color bleeding or dye transfer</li>
                  <li>Fading due to fabric nature</li>
                  <li>Shrinkage or deformation</li>
                  <li>Damage caused by weak or worn-out fabrics</li>
                </ul>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">7. DELICATE & SPECIAL GARMENTS</h3>
                <p>We do not recommend submitting silk, wool, or highly delicate fabrics, or expensive/designer garments. Unless explicitly declared and accepted, such items are processed at the customer’s risk.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">8. LOSS OR DAMAGE OF ITEMS</h3>
                <p>We shall not be responsible for items left in pockets or missing accessories. In case of proven damage caused directly due to our service, compensation is limited to a maximum of 3× the service charge for the affected load.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">9. PICKUP & DELIVERY TERMS</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Customers must be available at the scheduled time</li>
                  <li>Delays may result in rescheduling</li>
                  <li>We are not responsible for delays caused by external factors</li>
                </ul>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">10. BOOKING & SLOT POLICY</h3>
                <p>Bookings are subject to slot availability. Each slot corresponds to machine availability. Late arrivals may result in cancellation or rescheduling.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">11. PAYMENT TERMS</h3>
                <p>Payment must be completed before or at the time of service. Subscription plans must be prepaid. Prices are subject to change with prior notice.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">12. SUBSCRIPTION POLICY</h3>
                <p>Subscription benefits are limited to defined usage. Unused benefits may expire. Plans are non-transferable and non-refundable.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">13. CANCELLATION & REFUND POLICY</h3>
                <p>Cancellations must be made before service initiation. No refunds once washing process has begun. Refunds are processed at our discretion.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">14. HYGIENE & SAFETY</h3>
                <p>We follow standard hygiene practices; however, complete disinfection or sterilization is not guaranteed. Service is intended for general cleaning purposes.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">15. LIMITATION OF LIABILITY</h3>
                <p>Our liability is limited to the service value of the affected order and direct damages only. We are not liable for indirect or consequential losses.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">16. FORCE MAJEURE</h3>
                <p>We are not responsible for failure or delay in performance due to natural disasters, government restrictions, power outages, or unforeseen operational disruptions.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">17. MODIFICATION OF TERMS</h3>
                <p>We reserve the right to modify these Terms at any time. Continued use of the service implies acceptance of updated Terms.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">18. GOVERNING LAW</h3>
                <p>These Terms shall be governed by and interpreted in accordance with the laws of India.</p>
              </section>

              <section>
                <h3 className="text-gray-800 dark:text-gray-100 font-black uppercase tracking-tight">19. ACCEPTANCE OF TERMS</h3>
                <p>By using our service, you acknowledge that you have read, understood, and agreed to these Terms & Conditions.</p>
              </section>

              {view === 'detailed' && mode === 'disclaimer' && (
                <div className="pt-4">
                  <button 
                    onClick={() => setView('disclaimer')}
                    className="text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline"
                  >
                    Back to Disclaimer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          {onAccept && view === 'disclaimer' ? (
            <div className="space-y-4">
              <button
                disabled={loading}
                onClick={onAccept}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center ${
                  !loading
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 dark:shadow-none' 
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue to Profile'}
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
            >
              Close
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default TermsModal;
