import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingDown, Layers, CheckCircle2, Clock, Activity } from 'lucide-react';
import { fetchStats } from '../api';

export default function AnalyticsView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">
        Loading civic analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6">
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-base">Backend Connection Unavailable</span>
          </div>
          <p className="text-xs text-amber-700">
            Unable to load analytics data ({error}). Please ensure the backend is running at <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">http://localhost:8000</code>.
          </p>
          <button
            onClick={loadStats}
            className="px-3.5 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <span>Municipal Impact & Triage Efficiency Analytics</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tracking complaint volume reduction, spatial deduplication ratios, and category workloads.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Citizen Inputs</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total_complaints}</div>
          <span className="text-xs text-slate-400 mt-1 block">Ingested across all channels</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Master Incidents</span>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600">{stats.total_incidents}</div>
          <span className="text-xs text-slate-400 mt-1 block">Dispatched to field crews</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Triage Workload Saved</span>
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{stats.clustering_reduction_percent}%</div>
          <span className="text-xs text-slate-400 mt-1 block">Fewer duplicate tickets created</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolution Status</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-slate-800 space-x-2">
            <span className="text-red-600">{stats.open_incidents} Open</span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-600">{stats.resolved_incidents} Resolved</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Live field tracking</span>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Category Distribution & Clubbing Efficiency
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400">
                <th className="pb-3 font-semibold">Civic Domain</th>
                <th className="pb-3 font-semibold">Total Complaints</th>
                <th className="pb-3 font-semibold">Aggregated Incidents</th>
                <th className="pb-3 font-semibold">Clubbing Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.categories.map((cat, i) => {
                const ratio = cat.incident_count > 0 ? (cat.complaint_count / cat.incident_count).toFixed(1) : 0;
                return (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-800 capitalize">
                      {cat.category.replace('_', ' ')}
                    </td>
                    <td className="py-3 text-slate-600 font-medium">
                      {cat.complaint_count} reports
                    </td>
                    <td className="py-3 text-indigo-600 font-semibold">
                      {cat.incident_count} tickets
                    </td>
                    <td className="py-3 text-emerald-600 font-bold">
                      {ratio}x compression
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
