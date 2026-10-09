import React from 'react';
import { ShieldCheck, PlusCircle, LayoutDashboard, Globe, BarChart3, Database } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onSeedData, loadingSeed }) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                CivicSense AI
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-xs font-medium bg-indigo-950 text-indigo-300 rounded-full border border-indigo-800">
                Resolution Dispatch
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'report'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden md:inline">Citizen Portal</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Command Center</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'simulator'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span className="hidden md:inline">External Ingestion</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden md:inline">Analytics</span>
            </button>
          </nav>

          {/* Seed demo data */}
          <div>
            <button
              onClick={onSeedData}
              disabled={loadingSeed}
              title="Reset and populate realistic demo incidents"
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{loadingSeed ? 'Seeding...' : 'Seed Demo Data'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
