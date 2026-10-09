import React, { useState } from 'react';
import Navbar from './components/Navbar';
import ReportIssue from './components/ReportIssue';
import OfficerDashboard from './components/OfficerDashboard';
import ExternalSimulator from './components/ExternalSimulator';
import AnalyticsView from './components/AnalyticsView';
import { seedDemoData } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSeedData = async () => {
    setLoadingSeed(true);
    try {
      await seedDemoData();
      setRefreshTrigger((prev) => prev + 1);
      setActiveTab('dashboard');
    } catch (err) {
      alert('Failed to seed demo data: ' + err.message);
    } finally {
      setLoadingSeed(false);
    }
  };

  const handleComplaintSubmitted = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 font-sans flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSeedData={handleSeedData}
        loadingSeed={loadingSeed}
      />

      <main className="flex-1">
        {activeTab === 'report' && (
          <ReportIssue onComplaintSubmitted={handleComplaintSubmitted} />
        )}
        {activeTab === 'dashboard' && (
          <OfficerDashboard key={refreshTrigger} />
        )}
        {activeTab === 'simulator' && (
          <ExternalSimulator onComplaintSubmitted={handleComplaintSubmitted} />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView key={refreshTrigger} />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        CivicSense AI Engine • Multi-source Ingestion, 500m Geospatial Gating, & Canonical Informative Ranking
      </footer>
    </div>
  );
}
