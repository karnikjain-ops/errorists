import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { 
  AlertCircle, Users, CheckCircle2, Clock, ChevronDown, ChevronUp, 
  MapPin, RefreshCw, Flame, ExternalLink, ShieldAlert, Camera, ZoomIn, X, ShieldCheck
} from 'lucide-react';
import { fetchIncidents, updateIncidentStatus, getMediaUrl } from '../api';

// Custom icons based on category
const createColoredIcon = (color) => {
  return new L.DivIcon({
    className: 'custom-pin',
    html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

const CATEGORY_COLORS = {
  road_infrastructure: '#ef4444', // Red
  water_supply: '#0ea5e9',        // Sky blue
  electricity: '#f59e0b',         // Amber
  waste_management: '#10b981',    // Emerald
  sewage: '#8b5cf6',              // Purple
  other: '#64748b',               // Slate
};

export default function OfficerDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [expandedIncidentId, setExpandedIncidentId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const loadIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIncidents(selectedCategory, selectedStatus);
      setIncidents(data);
    } catch (err) {
      console.error('Error fetching incidents:', err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [selectedCategory, selectedStatus]);

  const handleStatusChange = async (incidentId, newStatus) => {
    setUpdatingId(incidentId);
    try {
      await updateIncidentStatus(incidentId, newStatus);
      await loadIncidents();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedIncidentId(expandedIncidentId === id ? null : id);
  };

  // Center map around first incident or default
  const mapCenter = incidents.length > 0
    ? [incidents[0].latitude, incidents[0].longitude]
    : [28.6139, 77.2090];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Municipal Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Aggregated Master Incidents ranked by Dynamic Priority Score & Lead Informative Reports
          </p>
        </div>

        <button
          onClick={loadIncidents}
          disabled={loading}
          className="self-start sm:self-auto flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
        <span className="text-xs font-semibold text-slate-500 mr-1">Category:</span>
        {[
          { id: 'all', label: 'All Issues' },
          { id: 'road_infrastructure', label: 'Roads & Potholes' },
          { id: 'water_supply', label: 'Water Supply' },
          { id: 'electricity', label: 'Electricity' },
          { id: 'waste_management', label: 'Waste Management' },
          { id: 'sewage', label: 'Sewage & Drainage' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              selectedCategory === cat.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}

        <div className="h-4 w-[1px] bg-slate-300 mx-2 hidden sm:block" />

        <span className="text-xs font-semibold text-slate-500 mr-1">Status:</span>
        {['all', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              selectedStatus === st
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {st === 'all' ? 'All Status' : st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Backend Disconnection Banner */}
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3 text-amber-900 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-amber-900">Backend / Database Connection Unavailable</h4>
            <p className="text-xs text-amber-700 mt-1">
              Could not retrieve incidents from the backend API ({error}). Please ensure the FastAPI backend is running at <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">http://localhost:8000</code>.
            </p>
            <button
              onClick={loadIncidents}
              className="mt-2.5 px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Map & List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interactive GIS Map */}
        <div className="lg:col-span-5 h-[340px] lg:h-[750px] sticky top-20 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
          <MapContainer
            center={mapCenter}
            zoom={13}
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {incidents.map((inc) => (
              <Marker
                key={inc.id}
                position={[inc.latitude, inc.longitude]}
                icon={createColoredIcon(CATEGORY_COLORS[inc.category] || '#64748b')}
              >
                <Popup>
                  <div className="p-1 space-y-1 text-xs">
                    <span className="font-bold text-slate-900 block">{inc.title}</span>
                    <span className="text-slate-500 block">Category: {inc.category.replace('_', ' ')}</span>
                    <span className="font-semibold text-red-600 block">Priority Score: {inc.priority_score}</span>
                    <span className="text-indigo-600 font-medium block">Reports Clustered: {inc.complaint_count}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Right Column: Master Incident Queue */}
        <div className="lg:col-span-7 space-y-4">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading incident queue...
            </div>
          ) : incidents.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 p-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-slate-800">No active incidents found</h3>
              <p className="text-xs text-slate-500 mt-1">Try resetting filters or seeding demo complaints.</p>
            </div>
          ) : (
            incidents.map((incident) => {
              const isExpanded = expandedIncidentId === incident.id;
              const canonical = incident.canonical_complaint;
              const supporting = incident.supporting_complaints || [];

              return (
                <div
                  key={incident.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow transition overflow-hidden"
                >
                  {/* Incident Header */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          {/* Category Badge */}
                          <span
                            className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white uppercase tracking-wider text-[10px]"
                            style={{ backgroundColor: CATEGORY_COLORS[incident.category] || '#64748b' }}
                          >
                            {incident.category.replace('_', ' ')}
                          </span>

                          {/* Status Badge */}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            incident.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' :
                            incident.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {incident.status.replace('_', ' ')}
                          </span>

                          {/* Department */}
                          <span className="text-xs text-slate-500 font-medium">
                            • {incident.assigned_department}
                          </span>
                        </div>

                        <h2 className="text-base font-bold text-slate-900 leading-snug">
                          {incident.title}
                        </h2>
                      </div>

                      {/* Priority Score badge */}
                      <div className="shrink-0 flex flex-col items-end">
                        <div className="flex items-center space-x-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-xl border border-red-200">
                          <Flame className="w-4 h-4 fill-red-500 text-red-500" />
                          <span className="text-xs font-extrabold">{incident.priority_score}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5">Priority</span>
                      </div>
                    </div>

                    {/* Canonical / Golden Lead Complaint Card */}
                    {canonical && (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-700">
                            <span>👑 Lead Informative Report</span>
                            <span className="text-slate-400 font-normal">by {canonical.user_name}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            Richness: {canonical.richness_score}/100
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                          "{canonical.raw_text}"
                        </p>

                        {canonical.media_url && (
                          <div className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border border-slate-200/80">
                            <div
                              onClick={() => setPreviewImage({
                                url: canonical.media_url,
                                title: canonical.raw_text,
                                lat: canonical.latitude,
                                lng: canonical.longitude,
                                time: canonical.created_at,
                                user: canonical.user_name
                              })}
                              className="relative w-12 h-12 rounded-lg overflow-hidden bg-black shrink-0 cursor-pointer group"
                            >
                              <img
                                src={getMediaUrl(canonical.media_url)}
                                alt="Photographic Proof"
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                <ZoomIn className="w-3.5 h-3.5" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-bold text-slate-800 flex items-center space-x-1">
                                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Geotagged Photo Evidence Attached</span>
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate">
                                Click thumbnail to view high-resolution geotagged evidence
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Channel: {canonical.source}</span>
                          <span>Lat: {canonical.latitude.toFixed(4)}, Lng: {canonical.longitude.toFixed(4)}</span>
                        </div>
                      </div>
                    )}

                    {/* Aggregated Citations Counter & Status Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs border-t border-slate-100">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-medium">
                          <Users className="w-3.5 h-3.5" />
                          <span>
                            <strong>{incident.complaint_count}</strong> {incident.complaint_count === 1 ? 'Citizen' : 'Citizens'} Reported
                          </span>
                        </div>

                        {supporting.length > 0 && (
                          <button
                            onClick={() => toggleExpand(incident.id)}
                            className="flex items-center space-x-1 text-slate-500 hover:text-slate-800 font-medium transition"
                          >
                            <span>{isExpanded ? 'Hide Supporting Complaints' : `View ${supporting.length} Clubbed Reports`}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>

                      {/* Quick Status Buttons */}
                      <div className="flex items-center space-x-2">
                        {incident.status === 'OPEN' && (
                          <button
                            onClick={() => handleStatusChange(incident.id, 'IN_PROGRESS')}
                            disabled={updatingId === incident.id}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                          >
                            Dispatch Crew
                          </button>
                        )}
                        {incident.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleStatusChange(incident.id, 'RESOLVED')}
                            disabled={updatingId === incident.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                          >
                            Mark Resolved
                          </button>
                        )}
                        {incident.status === 'RESOLVED' && (
                          <button
                            onClick={() => handleStatusChange(incident.id, 'OPEN')}
                            disabled={updatingId === incident.id}
                            className="px-2.5 py-1 text-slate-500 hover:text-slate-700 font-medium"
                          >
                            Re-open
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Supporting Complaints Accordion */}
                  {isExpanded && (
                    <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Clubbed Reports within 500m
                      </h4>
                      <div className="space-y-2">
                        {supporting.map((comp) => (
                          <div
                            key={comp.id}
                            className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1 shadow-2xs"
                          >
                            <div className="flex justify-between items-center text-slate-500 text-[11px]">
                              <span className="font-medium text-slate-700">{comp.user_name} ({comp.source})</span>
                              <span>Richness Score: {comp.richness_score}/100</span>
                            </div>
                            <p className="text-slate-600">"{comp.raw_text}"</p>
                            {comp.media_url && (
                              <button
                                type="button"
                                onClick={() => setPreviewImage({
                                  url: comp.media_url,
                                  title: comp.raw_text,
                                  lat: comp.latitude,
                                  lng: comp.longitude,
                                  time: comp.created_at,
                                  user: comp.user_name
                                })}
                                className="mt-1 flex items-center space-x-1.5 text-indigo-600 hover:text-indigo-800 font-semibold text-[11px]"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>View Photo Evidence</span>
                              </button>
                            )}
                            <span className="text-[10px] text-slate-400 block pt-1">
                              Logged: {new Date(comp.created_at).toLocaleTimeString()} • Lat: {comp.latitude.toFixed(4)}, Lng: {comp.longitude.toFixed(4)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Officer Inspection Image Lightbox */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full"
          >
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-white bg-slate-900/90">
              <div className="flex items-center space-x-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">Geotagged Civic Evidence</span>
                {previewImage.user && (
                  <span className="text-slate-400">submitted by {previewImage.user}</span>
                )}
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black min-h-[300px]">
              <img
                src={getMediaUrl(previewImage.url)}
                alt="Enlarged Evidence"
                className="max-h-[72vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 text-xs space-y-1.5 text-slate-400">
              {previewImage.title && (
                <p className="text-slate-200 text-xs italic">
                  "{previewImage.title}"
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800 text-[11px]">
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Lat: {Number(previewImage.lat).toFixed(5)}, Lng: {Number(previewImage.lng).toFixed(5)}</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Captured / Logged: {new Date(previewImage.time).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
