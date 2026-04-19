import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check backend health
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:3000/health');
        const data = await response.json();
        setHealthStatus(data);
      } catch (error) {
        console.error('Backend not available:', error);
        setHealthStatus({ error: 'Backend connection failed' });
      } finally {
        setLoading(false);
      }
    };
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Transcription AI Service
          </h1>
          <p className="text-gray-600 mt-2">
            Convert voice to structured insights
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Phase 1: Setup Status</h2>

          {loading ? (
            <p className="text-gray-600">Checking backend health...</p>
          ) : healthStatus?.error ? (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-800">
                ❌ Backend Error: {healthStatus.error}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Make sure backend is running: `cd backend && npm run dev`
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <p className="text-green-800 font-semibold">
                ✓ Backend is healthy
              </p>
              <div className="mt-3 text-sm text-gray-700">
                <p><strong>Status:</strong> {healthStatus?.status}</p>
                <p><strong>Environment:</strong> {healthStatus?.environment}</p>
                <p><strong>Uptime:</strong> {Math.round(healthStatus?.uptime || 0)}s</p>
              </div>
            </div>
          )}

          {/* Phase 1 Checklist */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Phase 1 Checklist</h3>
            <ul className="space-y-2">
              <li className="flex items-center">
                <input type="checkbox" checked disabled className="mr-3" />
                <span>Git repository initialized</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" checked disabled className="mr-3" />
                <span>Backend skeleton created</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" checked disabled className="mr-3" />
                <span>Frontend skeleton created</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" disabled className="mr-3" />
                <span>Deepgram API credentials configured</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" disabled className="mr-3" />
                <span>Claude API credentials configured</span>
              </li>
              <li className="flex items-center">
                <input type="checkbox" disabled className="mr-3" />
                <span>API calls tested and verified</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <p>Transcription AI Service — Phase 1 Setup</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
