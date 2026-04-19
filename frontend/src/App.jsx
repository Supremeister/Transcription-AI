import React, { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Transcription state
  const [audioFile, setAudioFile] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState('');

  // Check backend health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:3000/health');
        if (response.ok) {
          setBackendReady(true);
        }
      } catch (error) {
        console.error('Backend not available:', error);
        setBackendReady(false);
      } finally {
        setLoading(false);
      }
    };
    checkHealth();
  }, []);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
      if (validTypes.some(type => file.type.startsWith(type.split('/')[0]))) {
        setAudioFile(file);
        setError('');
        setTranscript('');
      } else {
        setError('Invalid audio format. Use MP3, WAV, OGG, or M4A');
        setAudioFile(null);
      }
    }
  };

  // Handle transcription
  const handleTranscribe = async () => {
    if (!audioFile) {
      setError('Please select an audio file');
      return;
    }

    setTranscribing(true);
    setError('');
    setTranscript('');

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', language);

      console.log(`📤 Uploading: ${audioFile.name}`);
      const response = await fetch('http://localhost:3000/api/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setTranscript(data.transcript);
        console.log('✅ Transcription complete!');
      } else {
        setError(data.error || 'Transcription failed');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
      console.error('Transcription error:', err);
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            🎤 Transcription Service
          </h1>
          <p className="text-gray-600 mt-2">
            Local AI-powered speech-to-text using Faster-Whisper
          </p>
          <div className="mt-3">
            {loading ? (
              <p className="text-gray-600 text-sm">Checking backend...</p>
            ) : backendReady ? (
              <p className="text-green-600 text-sm font-semibold">✅ Backend ready</p>
            ) : (
              <p className="text-red-600 text-sm font-semibold">❌ Backend unavailable</p>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {!backendReady && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">
              ⚠️ Backend not running. Start it with: <code className="bg-red-100 px-2 py-1 rounded">cd backend && npm run dev</code>
            </p>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold mb-6">Upload Audio</h2>

          {/* Language Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="en">🇬🇧 English</option>
              <option value="ru">🇷🇺 Russian</option>
              <option value="es">🇪🇸 Spanish</option>
              <option value="fr">🇫🇷 French</option>
              <option value="de">🇩🇪 German</option>
            </select>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Audio File (MP3, WAV, OGG, M4A)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
                id="audioInput"
              />
              <label
                htmlFor="audioInput"
                className="cursor-pointer block"
              >
                <p className="text-gray-600">
                  {audioFile ? (
                    <span className="text-green-600 font-semibold">✓ {audioFile.name}</span>
                  ) : (
                    <span>Click to upload or drag and drop</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Max 100MB</p>
              </label>
            </div>
          </div>

          {/* Transcribe Button */}
          <button
            onClick={handleTranscribe}
            disabled={!audioFile || transcribing || !backendReady}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            {transcribing ? '⏳ Transcribing...' : '📝 Transcribe'}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {transcript && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-4">📄 Transcript</h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {transcript}
              </p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => navigator.clipboard.writeText(transcript)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition"
              >
                📋 Copy to Clipboard
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <p>Transcription Service — Faster-Whisper (Local)</p>
          <p className="text-gray-400 mt-1">No API limits. 100% offline.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
