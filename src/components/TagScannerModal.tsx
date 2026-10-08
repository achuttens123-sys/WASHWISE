import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, 
  CameraOff, 
  X, 
  QrCode, 
  Barcode as BarcodeIcon, 
  CheckCircle2, 
  AlertTriangle, 
  User, 
  Calendar, 
  Layers, 
  Search, 
  RotateCw, 
  Clock, 
  Check, 
  Loader2, 
  Tag, 
  Phone, 
  Upload,
  Info,
  Sparkles
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Booking } from '../types';

interface TagScannerModalProps {
  onClose: () => void;
  onOpenTagModal?: (booking: Booking) => void;
  storeId?: string;
}

export interface ScannedTagResult {
  rawText: string;
  orderId?: string;
  customerName?: string;
  deliveryDate?: string;
  piece?: string;
  specialInstructions?: string;
  service?: string;
  slot?: string;
  phone?: string;
  matchedBooking?: Booking;
}

export const TagScannerModal: React.FC<TagScannerModalProps> = ({
  onClose,
  onOpenTagModal,
  storeId
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualInput, setManualInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [scannedResult, setScannedResult] = useState<ScannedTagResult | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusUpdatedSuccess, setStatusUpdatedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'qr-reader-container';
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  // Parse raw text from QR or barcode
  const parseScannedText = async (text: string): Promise<ScannedTagResult> => {
    let result: ScannedTagResult = { rawText: text };

    // Try parsing as JSON first
    try {
      if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
        const data = JSON.parse(text);
        result.orderId = data.orderId || data.order || data.tagId;
        result.customerName = data.customer || data.name;
        result.deliveryDate = data.deliveryDate || data.delivery;
        result.piece = data.piece || data.pieceNumber;
        result.specialInstructions = data.specialInstructions || data.special;
        result.service = data.service;
        result.slot = data.slotNo || data.slot;
        result.phone = data.phone;
      }
    } catch {
      // Not JSON, continue to text parser
    }

    // If not JSON, parse structured human-readable text
    if (!result.orderId) {
      const lines = text.split('\n');
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes('name') && line.includes(':')) {
          result.customerName = line.split(':')[1]?.trim();
        } else if (lower.includes('customer') && line.includes(':')) {
          result.customerName = line.split(':')[1]?.trim();
        } else if (lower.includes('delivery') && line.includes(':')) {
          result.deliveryDate = line.split(':')[1]?.trim();
        } else if (lower.includes('piece') && line.includes(':')) {
          result.piece = line.split(':')[1]?.trim();
        } else if (lower.includes('special') && line.includes(':')) {
          result.specialInstructions = line.split(':')[1]?.trim();
        } else if (lower.includes('order') && line.includes(':')) {
          result.orderId = line.split(':')[1]?.trim();
        } else if (lower.includes('slot') && line.includes(':')) {
          result.slot = line.split(':')[1]?.trim();
        }
      }
    }

    // If still no orderId, test if the scanned text is a direct Order ID / Barcode ID
    if (!result.orderId) {
      result.orderId = text.trim();
    }

    // Clean up orderId (remove # or suffix like -P01/10)
    const cleanOrderId = result.orderId?.replace(/^#/, '').split('-P')[0]?.trim();

    // Query Firestore for this booking
    try {
      setIsSearching(true);
      const bookingsRef = collection(db, 'bookings');
      
      let q = query(bookingsRef, where('bookingId', '==', cleanOrderId));
      let snap = await getDocs(q);

      if (snap.empty && cleanOrderId && cleanOrderId.length >= 6) {
        q = query(bookingsRef, where('bookingId', '==', `#${cleanOrderId}`));
        snap = await getDocs(q);
      }

      if (snap.empty && result.orderId) {
        try {
          const docRef = doc(db, 'bookings', result.orderId.replace(/^#/, ''));
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const b = { id: docSnap.id, ...docSnap.data() } as Booking;
            result.matchedBooking = b;
            result.customerName = result.customerName || b.userName;
            result.deliveryDate = result.deliveryDate || b.deliveryDate || b.date;
            result.specialInstructions = result.specialInstructions || b.garmentInstructions;
            result.service = result.service || b.serviceType;
            result.slot = result.slot || b.timeSlot;
            result.phone = result.phone || b.phone;
          }
        } catch {}
      }

      if (!snap.empty) {
        const docData = snap.docs[0];
        const b = { id: docData.id, ...docData.data() } as Booking;
        result.matchedBooking = b;
        result.customerName = result.customerName || b.userName;
        result.deliveryDate = result.deliveryDate || b.deliveryDate || b.date;
        result.specialInstructions = result.specialInstructions || b.garmentInstructions;
        result.service = result.service || b.serviceType;
        result.slot = result.slot || b.timeSlot;
        result.phone = result.phone || b.phone;
      }
    } catch (e) {
      console.warn('Firestore booking query info:', e);
    } finally {
      setIsSearching(false);
    }

    return result;
  };

  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    setCameraError('');
    setIsStartingCamera(true);

    try {
      // Check if mediaDevices is supported in this context
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser window. Please use Barcode Gun or manual entry below.');
        setIsStartingCamera(false);
        return;
      }

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {}
      }

      const html5QrCode = new Html5Qrcode(readerElementId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: facing },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0
        },
        async (decodedText) => {
          // Play subtle beep audio feedback
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
          } catch {}

          // Stop camera once scanned
          try {
            await html5QrCode.stop();
            setIsCameraActive(false);
          } catch {}

          const parsed = await parseScannedText(decodedText);
          setScannedResult(parsed);
        },
        () => {
          // Scanning frame callback (no barcode in frame)
        }
      );

      setIsCameraActive(true);
    } catch (err: any) {
      // Handle permission denied or camera errors gracefully without throwing/logging console.error
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied') || err?.message?.includes('PermissionDismissedError')) {
        setCameraError('Camera permission was not granted. You can allow camera access in your browser settings, or simply enter/scan the code with a barcode gun below.');
      } else if (err?.name === 'NotFoundError' || err?.message?.includes('DevicesNotFoundError')) {
        setCameraError('No camera found on this device. Please use the barcode gun or manual lookup below.');
      } else {
        setCameraError('Camera is currently unavailable. Please use the barcode gun or manual lookup below.');
      }
      setIsCameraActive(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {}
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
    setIsStartingCamera(false);
  };

  const toggleCameraFacing = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (isCameraActive) {
      await startCamera(nextFacing);
    }
  };

  // Decode from uploaded image file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSearching(true);
      const html5QrCode = new Html5Qrcode('qr-file-hidden-mount');
      const decodedText = await html5QrCode.scanFile(file, true);
      const parsed = await parseScannedText(decodedText);
      setScannedResult(parsed);
    } catch (err) {
      setCameraError('Could not detect a QR code or barcode in this image. Please upload a clear photo of the tag.');
    } finally {
      setIsSearching(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    // Auto-focus the input on mount so barcode guns can work immediately
    if (manualInputRef.current) {
      manualInputRef.current.focus();
    }
    return () => {
      stopCamera();
    };
  }, []);

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const parsed = await parseScannedText(manualInput.trim());
    setScannedResult(parsed);
  };

  const handleUpdateStatus = async (newStatus: Booking['status']) => {
    if (!scannedResult?.matchedBooking?.id) return;
    setIsUpdatingStatus(true);
    try {
      const bookingId = scannedResult.matchedBooking.id;
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: newStatus
      });
      setScannedResult(prev => prev ? {
        ...prev,
        matchedBooking: prev.matchedBooking ? { ...prev.matchedBooking, status: newStatus } : undefined
      } : null);
      setStatusUpdatedSuccess(true);
      setTimeout(() => setStatusUpdatedSuccess(false), 2000);
    } catch (err) {
      console.warn('Failed to update status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleScanAnother = () => {
    setScannedResult(null);
    setManualInput('');
    setCameraError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-2xl border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                QR & Barcode Tag Scanner
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Scan garment tag to immediately read sorting, washing & delivery details.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          
          {/* Active Result View */}
          {scannedResult ? (
            <div className="space-y-4">
              
              {/* Top Banner */}
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-500 text-white rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-green-950 dark:text-green-100 uppercase tracking-tight">
                      Tag Recognized Successfully!
                    </h3>
                    <p className="text-xs text-green-700 dark:text-green-300 font-mono font-bold">
                      {scannedResult.orderId || 'Order ID Verified'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleScanAnother}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Scan Next Tag
                </button>
              </div>

              {/* Tag Details Card: The 4 Core Items */}
              <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-3xl p-5 shadow-sm space-y-4">
                
                {/* 1. Name */}
                <div className="border-b border-gray-100 dark:border-gray-700 pb-3">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block mb-0.5">
                    1. Customer Name
                  </span>
                  <p className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    {scannedResult.customerName || 'Customer'}
                  </p>
                  {scannedResult.phone && (
                    <p className="text-xs text-gray-500 font-medium mt-0.5 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      {scannedResult.phone}
                    </p>
                  )}
                </div>

                {/* 2. Date of Delivery & 3. Piece Number (Row) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black text-white p-3 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">
                      2. Date of Delivery
                    </span>
                    <p className="text-sm font-black mt-1 text-white leading-tight">
                      {scannedResult.deliveryDate || 'Scheduled Date'}
                    </p>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-700/60 p-3 rounded-2xl border border-gray-200 dark:border-gray-600 flex flex-col justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                      3. Piece Number
                    </span>
                    <p className="text-lg font-black text-indigo-700 dark:text-indigo-300 font-mono mt-0.5">
                      {scannedResult.piece || 'Piece Tag'}
                    </p>
                  </div>
                </div>

                {/* 4. Special Instructions */}
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-900 dark:text-amber-200 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>4. Special Garment Care Instructions:</span>
                  </div>
                  <p className="text-xs font-black text-amber-950 dark:text-amber-100 leading-snug">
                    {scannedResult.specialInstructions || 'Standard Cycle • No special handling requested.'}
                  </p>
                </div>

                {/* Machine / Slot / Service metadata */}
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div>
                    <span className="text-[9px] font-black uppercase text-gray-400 block">Service:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{scannedResult.service || scannedResult.matchedBooking?.serviceType || 'Wash & Fold'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-gray-400 block">Slot & Machine:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {scannedResult.slot || scannedResult.matchedBooking?.timeSlot || 'Slot #1'}
                      {scannedResult.matchedBooking?.machineNumber ? ` • M#${scannedResult.matchedBooking.machineNumber}` : ''}
                    </span>
                  </div>
                </div>

                {/* Quick Status Update from Scanner */}
                {scannedResult.matchedBooking && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                        Current Status: <span className="text-indigo-600 dark:text-indigo-400 uppercase font-black">{scannedResult.matchedBooking.status}</span>
                      </span>
                      {statusUpdatedSuccess && (
                        <span className="text-[10px] font-black text-green-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Updated!
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleUpdateStatus('In Wash')}
                        disabled={isUpdatingStatus}
                        className="py-2 px-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-indigo-200 dark:border-indigo-800"
                      >
                        In Wash
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('Washing completed')}
                        disabled={isUpdatingStatus}
                        className="py-2 px-2 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-teal-200 dark:border-teal-800"
                      >
                        Wash Done
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('Ready to deliver')}
                        disabled={isUpdatingStatus}
                        className="py-2 px-2 bg-green-50 hover:bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-green-200 dark:border-green-800"
                      >
                        Ready Delivery
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {scannedResult.matchedBooking && onOpenTagModal && (
                  <button
                    onClick={() => {
                      if (scannedResult.matchedBooking) {
                        onOpenTagModal(scannedResult.matchedBooking);
                      }
                      onClose();
                    }}
                    className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    <Tag className="w-4 h-4" />
                    Open Tag Editor / Print
                  </button>
                )}

                <button
                  onClick={handleScanAnother}
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-md"
                >
                  <Camera className="w-4 h-4" />
                  Scan Another Tag
                </button>
              </div>

            </div>
          ) : (
            /* Scanning Methods Container */
            <div className="space-y-4">
              
              {/* Method Switcher Header */}
              <div className="flex items-center justify-between p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
                <button
                  onClick={() => {
                    setActiveTab('camera');
                    setCameraError('');
                  }}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'camera'
                      ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Live Camera</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('manual');
                    stopCamera();
                    setTimeout(() => manualInputRef.current?.focus(), 100);
                  }}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'manual'
                      ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <BarcodeIcon className="w-3.5 h-3.5" />
                  <span>Barcode Gun / Manual</span>
                </button>
              </div>

              {/* Tab 1: Live Camera Scanner */}
              {activeTab === 'camera' && (
                <div className="space-y-3">
                  <div className="relative rounded-3xl overflow-hidden bg-black aspect-video flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 shadow-inner">
                    {/* HTML5 QR Code Mount Element */}
                    <div id={readerElementId} className="w-full h-full" />

                    {/* Laser animation overlay */}
                    {isCameraActive && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-52 h-52 border-2 border-indigo-400 rounded-2xl relative shadow-lg">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-indigo-500 -mt-1 -ml-1" />
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-indigo-500 -mt-1 -mr-1" />
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-indigo-500 -mb-1 -ml-1" />
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-indigo-500 -mb-1 -mr-1" />
                          <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse shadow-md" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-white/90 bg-black/60 px-3 py-1 rounded-full mt-4 backdrop-blur-xs">
                          Align QR or Barcode in Frame
                        </span>
                      </div>
                    )}

                    {/* Camera Inactive State */}
                    {!isCameraActive && (
                      <div className="p-6 text-center text-white space-y-3">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
                          <Camera className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-medium text-gray-300 max-w-sm mx-auto">
                          {cameraError ? cameraError : 'Click below to activate your camera and scan garment wash tags.'}
                        </p>
                        
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            onClick={() => startCamera(facingMode)}
                            disabled={isStartingCamera}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 shadow-md"
                          >
                            {isStartingCamera ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Accessing Camera...</span>
                              </>
                            ) : (
                              <>
                                <Camera className="w-4 h-4" />
                                <span>Turn On Camera</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 border border-gray-700"
                            title="Upload an image/photo of a tag"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Upload Photo</span>
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera Controls when Active */}
                  {isCameraActive && (
                    <div className="flex items-center justify-between px-1">
                      <button
                        onClick={toggleCameraFacing}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        Flip ({facingMode === 'environment' ? 'Back' : 'Front'})
                      </button>

                      <button
                        onClick={stopCamera}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-red-200"
                      >
                        <CameraOff className="w-3.5 h-3.5" /> Stop Camera
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Hardware Barcode Gun / Manual Input Bar */}
              <div className="pt-2">
                <form onSubmit={handleManualSearch} className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">
                    Fast Scanner / Barcode Gun Input (Instant):
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <BarcodeIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={manualInputRef}
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="Scan tag with barcode gun or type Order ID (e.g. 0001)..."
                        className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearching || !manualInput.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      Find Tag
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}

          {/* Educational Explainer Card */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 space-y-2">
            <div className="flex items-center gap-1.5 font-black uppercase text-[10px] text-gray-800 dark:text-gray-200 tracking-wider">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              <span>3 Ways to Read Laundry Tags</span>
            </div>
            <ul className="space-y-1 text-[11px] list-disc list-inside text-gray-500 dark:text-gray-400">
              <li>
                <strong className="text-gray-800 dark:text-gray-200">1. Any Smartphone Camera:</strong> Open the standard iPhone Camera app or Android Google Lens / QR Scanner and point it at the tag's QR code.
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-200">2. Barcode Gun / Keyboard Scanner:</strong> Handheld USB / Bluetooth laser barcode scanners scan directly into the input above without requiring camera permissions.
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-200">3. Built-in Web Scanner:</strong> Click "Turn On Camera" above to scan live via your webcam or laptop camera.
              </li>
            </ul>
          </div>

        </div>

        {/* Hidden mount for file-based QR decoding */}
        <div id="qr-file-hidden-mount" className="hidden" />

      </div>
    </div>
  );
};
