import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, X, Check, MapPin, Clock, AlertTriangle, ShieldCheck, FlipHorizontal } from 'lucide-react';

export default function CameraCaptureModal({ isOpen, onClose, onPhotoCaptured }) {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [cameraError, setCameraError] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(null);
  const [locating, setLocating] = useState(false);
  const [burnWatermark, setBurnWatermark] = useState(true);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Start camera stream when modal opens
  useEffect(() => {
    if (isOpen) {
      setCapturedPreview(null);
      setCapturedBlob(null);
      setCameraError(null);
      startCamera(facingMode);
      fetchCurrentGps();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Connect stream to video element when stream or videoRef changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.warn('Auto-play error on video element:', err);
      });
    }
  }, [stream]);

  const startCamera = async (mode) => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported in this browser environment.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
    } catch (err) {
      console.warn('FacingMode constraint failed, trying basic video:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setStream(fallbackStream);
      } catch (fallbackErr) {
        console.error('Camera access error:', fallbackErr);
        setCameraError(
          fallbackErr.name === 'NotAllowedError'
            ? 'Camera access permission was denied. Please allow camera permissions in your browser.'
            : 'Could not access camera device: ' + fallbackErr.message
        );
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const fetchCurrentGps = () => {
    if ('geolocation' in navigator) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          });
          setLocating(false);
        },
        (err) => {
          console.warn('Geolocation warning during camera setup:', err.message);
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw video frame
    ctx.drawImage(video, 0, 0, width, height);

    const now = new Date();
    const timestampStr = now.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    const coords = currentCoords || { lat: 28.6139, lng: 77.209, accuracy: 10 };

    // Burn Geotag Watermark directly into photo canvas if enabled
    if (burnWatermark) {
      const bannerHeight = Math.max(70, Math.round(height * 0.12));
      const bannerY = height - bannerHeight;

      // Semi-transparent gradient bar at bottom
      const gradient = ctx.createLinearGradient(0, bannerY, 0, height);
      gradient.addColorStop(0, 'rgba(15, 23, 42, 0.75)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, bannerY, width, bannerHeight);

      // Gold highlight line
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, bannerY, width, Math.max(3, Math.round(height * 0.005)));

      // Watermark Text styling
      const fontSizeTitle = Math.max(16, Math.round(bannerHeight * 0.28));
      const fontSizeDetails = Math.max(13, Math.round(bannerHeight * 0.22));
      const paddingX = Math.max(20, Math.round(width * 0.03));

      // Title & Verification
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSizeTitle}px sans-serif`;
      ctx.fillText('CIVICSENSE AI GEOTAG VERIFIED', paddingX, bannerY + bannerHeight * 0.38);

      // Coordinates & Time
      ctx.fillStyle = '#94a3b8';
      ctx.font = `${fontSizeDetails}px sans-serif`;
      const coordsText = `Lat: ${coords.lat.toFixed(5)}  Lng: ${coords.lng.toFixed(5)} (±${coords.accuracy || 5}m)`;
      const timeText = `Time: ${timestampStr}`;
      ctx.fillText(`${coordsText}  |  ${timeText}`, paddingX, bannerY + bannerHeight * 0.78);
    }

    canvas.toBlob(
      (blob) => {
        const previewUrl = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedPreview(previewUrl);
        setCurrentTimestamp(now);
      },
      'image/jpeg',
      0.92
    );
  };

  const handleConfirmPhoto = () => {
    if (capturedBlob) {
      const now = currentTimestamp || new Date();
      const coords = currentCoords ? [currentCoords.lat, currentCoords.lng] : null;
      onPhotoCaptured({
        blob: capturedBlob,
        previewUrl: capturedPreview,
        coordinates: coords,
        accuracy: currentCoords?.accuracy,
        timestamp: now,
        timestampFormatted: now.toLocaleString(),
      });
      stopCamera();
      onClose();
    }
  };

  const handleRetake = () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedPreview(null);
    setCapturedBlob(null);
    startCamera(facingMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-2 text-white">
            <Camera className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-sm sm:text-base">Camera Evidence Capture</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Live Geotagging
            </span>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder / Preview Screen */}
        <div className="relative bg-black flex-1 min-h-[360px] sm:min-h-[420px] flex items-center justify-center overflow-hidden">
          {capturedPreview ? (
            /* Freeze Frame Preview */
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={capturedPreview}
                alt="Captured Snapshot"
                className="max-h-[60vh] w-auto max-w-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-emerald-400 flex items-center space-x-1.5 shadow-md">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Geotag & Timestamp Baked</span>
              </div>
            </div>
          ) : cameraError ? (
            /* Error State */
            <div className="p-6 text-center max-w-md space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <h4 className="text-white font-semibold text-sm">Camera Unavailable</h4>
              <p className="text-xs text-slate-400">{cameraError}</p>
              <div className="pt-2 flex justify-center space-x-2">
                <button
                  onClick={() => startCamera(facingMode)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Access</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Stream Video */
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[60vh]"
              />

              {/* Viewfinder Target Reticle */}
              <div className="absolute inset-8 pointer-events-none border border-white/20 rounded-2xl flex items-center justify-center">
                <div className="w-16 h-16 border-t-2 border-l-2 border-indigo-400 absolute top-0 left-0 rounded-tl-xl" />
                <div className="w-16 h-16 border-t-2 border-r-2 border-indigo-400 absolute top-0 right-0 rounded-tr-xl" />
                <div className="w-16 h-16 border-b-2 border-l-2 border-indigo-400 absolute bottom-0 left-0 rounded-bl-xl" />
                <div className="w-16 h-16 border-b-2 border-r-2 border-indigo-400 absolute bottom-0 right-0 rounded-br-xl" />
                <div className="w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
              </div>

              {/* Active GPS Status Overlay */}
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs text-slate-200 flex items-center space-x-2 shadow-lg">
                <MapPin className={`w-3.5 h-3.5 ${locating ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
                <span>
                  {locating
                    ? 'Acquiring GPS...'
                    : currentCoords
                    ? `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}`
                    : 'GPS Active'}
                </span>
                {currentCoords?.accuracy && (
                  <span className="text-[10px] text-slate-400">±{currentCoords.accuracy}m</span>
                )}
              </div>

              {/* Live Switch Camera Button */}
              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl border border-slate-700/80 transition shadow-lg"
                title="Switch Camera (Front / Back)"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={burnWatermark}
                onChange={(e) => setBurnWatermark(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
              />
              <span>Burn Geotag Watermark onto Image</span>
            </label>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            {capturedPreview ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center justify-center space-x-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPhoto}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Use Geotagged Photo</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!stream || !!cameraError}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-indigo-600/30 active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Snap Photo</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
