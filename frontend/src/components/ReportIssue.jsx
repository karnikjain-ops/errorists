import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  MapPin, Navigation, Send, CheckCircle2, AlertTriangle, Sparkles, 
  Layers, Image as ImageIcon, Camera, Upload, Trash2, Clock, ShieldCheck, 
  RefreshCw, Check, ZoomIn, X
} from 'lucide-react';
import { submitComplaint, uploadImage, getMediaUrl } from '../api';
import CameraCaptureModal from './CameraCaptureModal';

// Fix default Leaflet marker icon in React/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapRecenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && position[0] && position[1]) {
      map.flyTo(position, 15, { duration: 1.0 });
    }
  }, [position, map]);
  return null;
}

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

export default function ReportIssue({ onComplaintSubmitted }) {
  // Default to New Delhi coordinates
  const [position, setPosition] = useState([28.6139, 77.2090]);
  const [rawText, setRawText] = useState('');
  const [userName, setUserName] = useState('');
  const [userContact, setUserContact] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmissionResult, setLastSubmissionResult] = useState(null);
  const [error, setError] = useState(null);

  // Camera & Geotagged Photo Evidence state
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoGeotag, setPhotoGeotag] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [manualUrlMode, setManualUrlMode] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const fileInputRef = useRef(null);
  const nativeCameraInputRef = useRef(null);

  // Auto detect location on initial load
  useEffect(() => {
    handleDetectLocation();
  }, []);

  const handleDetectLocation = () => {
    if ('geolocation' in navigator) {
      setDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
          setDetectingLocation(false);
        },
        (err) => {
          console.warn('Geolocation denied or unavailable, using default coords:', err.message);
          setDetectingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const handleCameraPhotoCaptured = async (capturedData) => {
    setPhotoPreview(capturedData.previewUrl);
    const coords = capturedData.coordinates || position;
    const now = capturedData.timestamp || new Date();
    
    setPhotoGeotag({
      lat: coords[0],
      lng: coords[1],
      accuracy: capturedData.accuracy,
      timestamp: now,
      formattedTime: capturedData.timestampFormatted || now.toLocaleString(),
    });

    if (capturedData.coordinates) {
      setPosition(capturedData.coordinates);
    }

    setUploadingPhoto(true);
    setUploadError(null);
    try {
      const uploadRes = await uploadImage(capturedData.blob);
      setImageUrl(uploadRes.url);
    } catch (err) {
      console.error('Failed to upload captured photo:', err);
      setUploadError(err.message || 'Failed to upload photo to server');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    const now = new Date();

    // Query high-accuracy GPS for geotagging uploaded image
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setPosition(coords);
          setPhotoGeotag({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: now,
            formattedTime: now.toLocaleString(),
          });
        },
        (err) => {
          console.warn('Geolocation fallback for file upload:', err.message);
          setPhotoGeotag({
            lat: position[0],
            lng: position[1],
            accuracy: null,
            timestamp: now,
            formattedTime: now.toLocaleString(),
          });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setPhotoGeotag({
        lat: position[0],
        lng: position[1],
        accuracy: null,
        timestamp: now,
        formattedTime: now.toLocaleString(),
      });
    }

    setUploadingPhoto(true);
    setUploadError(null);
    try {
      const uploadRes = await uploadImage(file);
      setImageUrl(uploadRes.url);
    } catch (err) {
      console.error('Failed to upload selected file:', err);
      setUploadError(err.message || 'Failed to upload image');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setImageUrl('');
    setPhotoGeotag(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (nativeCameraInputRef.current) nativeCameraInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        raw_text: rawText,
        latitude: position[0],
        longitude: position[1],
        user_name: userName || 'Anonymous Citizen',
        user_contact: userContact || null,
        media_url: imageUrl || null,
        source: 'web_portal',
      };

      const result = await submitComplaint(payload);
      setLastSubmissionResult(result);
      setRawText('');
      handleRemovePhoto();
      if (onComplaintSubmitted) onComplaintSubmitted();
    } catch (err) {
      setError(err.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Report a Civic Issue
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Describe the issue in your own words. Our AI automatically extracts categories, assesses severity, and clusters matching reports within 500 meters.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Unstructured Text Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Describe the Problem <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="e.g. Huge crater pothole opposite Metro Pillar 412 causing bike skids since 3 days. Water filled inside..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 placeholder-slate-400"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                💡 Tip: Mention landmarks and how long the problem has existed for a higher richness score!
              </span>
            </div>

            {/* Geotagging coordinates & Map Picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-800 flex items-center space-x-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span>Geotagged Location (500m radius check)</span>
                </label>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  className="flex items-center space-x-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition disabled:opacity-50"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{detectingLocation ? 'Locating...' : 'Use My GPS'}</span>
                </button>
              </div>

              <div className="h-52 w-full rounded-xl overflow-hidden border border-slate-200 relative shadow-inner">
                <MapContainer
                  center={position}
                  zoom={15}
                  scrollWheelZoom={false}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationMarker position={position} setPosition={setPosition} />
                  <MapRecenter position={position} />
                </MapContainer>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                <span>Lat: {position[0].toFixed(5)}, Lng: {position[1].toFixed(5)}</span>
                <span className="text-slate-400">Click anywhere on map to reposition pin</span>
              </div>
            </div>

            {/* Optional details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Name (Optional)
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact / Phone (Optional)
                </label>
                <input
                  type="text"
                  value={userContact}
                  onChange={(e) => setUserContact(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Camera & Geotagged Photo Evidence */}
            <div className="space-y-2">
              {/* Hidden file inputs for camera / gallery */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={nativeCameraInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <span>Photo Evidence & Camera Geotag</span>
                </label>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  +15 Richness Bonus
                </span>
              </div>

              {!photoPreview && !imageUrl && !manualUrlMode ? (
                /* Capture / Select Mode Buttons */
                <div className="p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50/70 transition space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCameraModalOpen(true)}
                      className="flex-1 flex items-center justify-center space-x-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-indigo-600/20 active:scale-98"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo (Camera Viewfinder)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition"
                      title="Direct Device Camera"
                    >
                      <Camera className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Device Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Upload File</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>💡 Capturing automatically tags GPS coordinates & exact timestamp</span>
                    <button
                      type="button"
                      onClick={() => setManualUrlMode(true)}
                      className="text-indigo-600 hover:underline"
                    >
                      Or paste photo URL
                    </button>
                  </div>
                </div>
              ) : manualUrlMode && !photoPreview ? (
                /* Manual URL Input mode */
                <div className="space-y-2">
                  <div className="relative">
                    <ImageIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/pothole_photo.jpg"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Direct image link</span>
                    <button
                      type="button"
                      onClick={() => setManualUrlMode(false)}
                      className="text-indigo-600 hover:underline font-medium text-xs"
                    >
                      Back to Camera Capture
                    </button>
                  </div>
                </div>
              ) : (
                /* Geotagged Photo Attached Card */
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-start space-x-3">
                    {/* Thumbnail preview with zoom */}
                    <div
                      onClick={() => setIsZoomed(true)}
                      className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-300 bg-black cursor-pointer group shrink-0"
                    >
                      <img
                        src={photoPreview || getMediaUrl(imageUrl)}
                        alt="Evidence Preview"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <ZoomIn className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Geotag & Time Badges */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Geotagged Evidence</span>
                        </span>
                        {uploadingPhoto ? (
                          <span className="text-[11px] text-indigo-600 font-medium flex items-center space-x-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Uploading...</span>
                          </span>
                        ) : imageUrl ? (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>Uploaded</span>
                          </span>
                        ) : null}
                      </div>

                      {/* Coordinates */}
                      <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-mono">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">
                          Lat: {photoGeotag?.lat ? photoGeotag.lat.toFixed(5) : position[0].toFixed(5)}, Lng: {photoGeotag?.lng ? photoGeotag.lng.toFixed(5) : position[1].toFixed(5)}
                        </span>
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">
                          {photoGeotag?.formattedTime || new Date().toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {uploadError && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                      {uploadError}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        if (photoGeotag?.lat && photoGeotag?.lng) {
                          setPosition([photoGeotag.lat, photoGeotag.lng]);
                        }
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center space-x-1"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Re-center Map on Photo</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsCameraModalOpen(true)}
                        className="text-slate-600 hover:text-slate-900 font-medium"
                      >
                        Retake
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="text-red-600 hover:text-red-800 font-medium flex items-center space-x-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-md shadow-indigo-500/20 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Analyzing & Dispatching...' : 'Submit Complaint'}</span>
            </button>
          </form>
        </div>

        {/* Right Panel: AI Live Extraction Feedback */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
            <div className="flex items-center space-x-2 text-indigo-400 mb-3">
              <Sparkles className="w-5 h-5" />
              <h2 className="font-semibold text-sm tracking-wide uppercase">
                AI Pipeline Status
              </h2>
            </div>

            {lastSubmissionResult ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Complaint Processed & Geotagged Successfully!</span>
                </div>

                {/* Extracted Details */}
                <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Structured Summary:</span>
                    <span className="font-medium text-slate-100 text-sm mt-0.5 block">
                      {lastSubmissionResult.summary}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
                    <div>
                      <span className="text-slate-400 block">Category:</span>
                      <span className="font-semibold text-indigo-300 capitalize">
                        {lastSubmissionResult.category.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Severity:</span>
                      <span className={`font-semibold ${
                        lastSubmissionResult.severity_level === 'CRITICAL' ? 'text-red-400' :
                        lastSubmissionResult.severity_level === 'HIGH' ? 'text-amber-400' : 'text-blue-300'
                      }`}>
                        {lastSubmissionResult.severity_level}
                      </span>
                    </div>
                  </div>

                  {/* Informativeness Score */}
                  <div className="pt-2 border-t border-slate-700/60">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-400">Information Richness Score:</span>
                      <span className="font-bold text-amber-400 text-sm">
                        {lastSubmissionResult.richness_score} / 100
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${lastSubmissionResult.richness_score}%` }}
                      />
                    </div>
                  </div>

                  {/* Leader Status */}
                  <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                    <span className="text-slate-400">Cluster Status:</span>
                    {lastSubmissionResult.is_canonical ? (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md font-semibold text-[11px] flex items-center space-x-1">
                        <span>👑 Canonical Lead Record</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md font-medium text-[11px] flex items-center space-x-1">
                        <Layers className="w-3 h-3" />
                        <span>Clubbed Endorsement</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-xs leading-relaxed space-y-3 py-4">
                <p>
                  When you submit a complaint:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-slate-300">
                  <li><strong>AI Skeleton Extraction:</strong> Converts your raw text into standard attributes without manual forms.</li>
                  <li><strong>500m Geospatial Filter:</strong> Queries active issues within 500m of the same category.</li>
                  <li><strong>Intelligent Clubbing:</strong> Merges duplicate complaints to avoid bloating dispatch queues.</li>
                  <li><strong>Informative Leader Election:</strong> Promotes the most detailed complaint to the top of the municipal officer's dashboard.</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onPhotoCaptured={handleCameraPhotoCaptured}
      />

      {/* Zoom / Full Preview Lightbox */}
      {isZoomed && (photoPreview || imageUrl) && (
        <div 
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-3 border-b border-slate-800 flex items-center justify-between text-white bg-slate-900/90">
              <div className="flex items-center space-x-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">Geotagged Photo Evidence</span>
                {photoGeotag && (
                  <span className="text-slate-400 font-mono">
                    ({photoGeotag.lat?.toFixed(5)}, {photoGeotag.lng?.toFixed(5)})
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsZoomed(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black">
              <img
                src={photoPreview || getMediaUrl(imageUrl)}
                alt="Enlarged Evidence"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>

            {photoGeotag && (
              <div className="p-3 bg-slate-900 border-t border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-400">
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Lat: {photoGeotag.lat?.toFixed(5)}, Lng: {photoGeotag.lng?.toFixed(5)}</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Time: {photoGeotag.formattedTime}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
