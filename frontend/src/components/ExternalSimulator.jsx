import React, { useState } from 'react';
import { Globe, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { submitExternalWebhook } from '../api';

const PRESET_EXTERNAL_FEEDS = [
  {
    name: 'CPGRAMS Central Govt Portal',
    portal: 'cpgrams',
    ticketId: 'CPG-2026-89412',
    text: 'Severe road cave-in and pothole opposite Metro Pillar 412, causing long jams and bike hazards.',
    lat: 28.6141,
    lng: 77.2092,
    user: 'Citizen via CPGRAMS',
  },
  {
    name: 'Twitter / X Citizen Tweet',
    portal: 'twitter',
    ticketId: 'TWT-19827361',
    text: '@MCD_Delhi drinking water pipe has burst outside hospital emergency gate! Gallons wasted since 6 AM!!',
    lat: 28.6251,
    lng: 77.2181,
    user: '@delhi_commuter',
  },
  {
    name: 'Municipal WhatsApp Chatbot Ingestion',
    portal: 'whatsapp_bot',
    ticketId: 'WA-MSG-7712',
    text: 'Streetlight pole wire sparking and flickering outside St Mary school. Please fix urgently before school opening.',
    lat: 28.6012,
    lng: 77.1952,
    user: '+919811223344',
  },
];

export default function ExternalSimulator({ onComplaintSubmitted }) {
  const [selectedPreset, setSelectedPreset] = useState(PRESET_EXTERNAL_FEEDS[0]);
  const [portalName, setPortalName] = useState(PRESET_EXTERNAL_FEEDS[0].portal);
  const [ticketId, setTicketId] = useState(PRESET_EXTERNAL_FEEDS[0].ticketId);
  const [text, setText] = useState(PRESET_EXTERNAL_FEEDS[0].text);
  const [lat, setLat] = useState(PRESET_EXTERNAL_FEEDS[0].lat);
  const [lng, setLng] = useState(PRESET_EXTERNAL_FEEDS[0].lng);
  const [userName, setUserName] = useState(PRESET_EXTERNAL_FEEDS[0].user);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset);
    setPortalName(preset.portal);
    setTicketId(preset.ticketId);
    setText(preset.text);
    setLat(preset.lat);
    setLng(preset.lng);
    setUserName(preset.user);
    setResponse(null);
    setError(null);
  };

  const handleSimulate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        portal_name: portalName,
        external_ticket_id: ticketId,
        raw_text: text,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        user_name: userName,
      };

      const res = await submitExternalWebhook(payload);
      setResponse(res);
      if (onComplaintSubmitted) onComplaintSubmitted();
    } catch (err) {
      setError(err.message || 'Webhook failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <Globe className="w-6 h-6 text-indigo-600" />
          <span>External Govt Portal Ingestion Simulator</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Simulate incoming webhooks from external channels (CPGRAMS, Twitter, WhatsApp bot, State Portals). Notice how they automatically club into the same 500m incident without manual triage!
        </p>
      </div>

      {/* Preset selector buttons */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
          Quick Test Scenarios:
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PRESET_EXTERNAL_FEEDS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`p-3 text-left rounded-xl border text-xs font-medium transition ${
                selectedPreset.ticketId === preset.ticketId
                  ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
              }`}
            >
              <span className="font-bold block text-slate-900 mb-0.5">{preset.name}</span>
              <span className="text-[11px] text-slate-500 truncate block">"{preset.text}"</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ingestion Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleSimulate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Portal Name
              </label>
              <input
                type="text"
                required
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                placeholder="e.g. cpgrams, twitter, mcd_portal"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                External Ticket / Reference ID
              </label>
              <input
                type="text"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="e.g. EXT-998811"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Complaint Raw Text
            </label>
            <textarea
              rows={3}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Latitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Longitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reporter Handle</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
          >
            <span>{loading ? 'Processing Webhook...' : 'Send Webhook Payload to /api/v1/complaints/external-webhook'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {response && (
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Ingested & Processed Successfully!</span>
            </div>
            <div className="text-slate-700 space-y-1">
              <div><strong>Complaint ID:</strong> {response.id}</div>
              <div><strong>Master Incident ID:</strong> {response.incident_id}</div>
              <div><strong>Extracted Category:</strong> {response.category}</div>
              <div><strong>Informativeness Score:</strong> {response.richness_score} / 100</div>
              <div><strong>Canonical Role:</strong> {response.is_canonical ? '👑 Promoted to Lead Canonical' : 'Clubbed as Supporting Citation'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
