import React, { useEffect, useState } from 'react';
import './App.css';

const BACKEND = 'http://localhost:3000';

function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [whisperReady, setWhisperReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioFile, setAudioFile] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState('ru');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastElapsed, setLastElapsed] = useState(null); // итоговое время последней транскрипции
  const [whisperDevice, setWhisperDevice] = useState(null); // 'cuda' | 'cpu'

  // AI состояние
  const [ollamaReady, setOllamaReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(null); // 'correct' | 'tasks' | 'keypoints' | null
  const [aiResults, setAiResults] = useState({ correct: null, tasks: null, keypoints: null });
  const [aiError, setAiError] = useState('');
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [setupProgress, setSetupProgress] = useState({ msg: '', pct: 0 });
  const [showAiOnboarding, setShowAiOnboarding] = useState(
    () => !localStorage.getItem('aiOnboardingDismissed')
  );

  // API настройки
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('apiKey') || '');
  const [apiEndpoint, setApiEndpoint] = useState(() => localStorage.getItem('apiEndpoint') || 'https://api.openai.com/v1');
  const [apiModel, setApiModel] = useState(() => localStorage.getItem('apiModel') || 'gpt-4o-mini');

  const saveApiSettings = () => {
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('apiEndpoint', apiEndpoint);
    localStorage.setItem('apiModel', apiModel);
    setShowApiSettings(false);
  };

  const useApiMode = !!apiKey;

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BACKEND}/health`);
        setBackendReady(res.ok);
        if (res.ok) {
          const aiRes = await fetch(`${BACKEND}/api/analyze/health`);
          const aiData = await aiRes.json();
          setOllamaReady(aiData.ollama && aiData.hasModel);
        }
      } catch {
        setBackendReady(false);
      } finally {
        setLoading(false);
      }
    };
    checkHealth();
  }, []);

  // Поллинг Whisper до готовности
  useEffect(() => {
    if (!backendReady) return;
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/transcribe/health`);
        const data = await res.json();
        if (data.status === 'ok') {
          setWhisperReady(true);
          setWhisperDevice(data.whisper?.device || null);
          return;
        }
      } catch {}
      setTimeout(poll, 2000);
    };
    poll();
  }, [backendReady]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      setError(`Формат не поддерживается. Допустимые: ${allowedExts.join(', ').toUpperCase()}`);
      setAudioFile(null);
      return;
    }
    setAudioFile(file);
    setError('');
    setTranscript('');
    setStatus('');
    setAiResults({ correct: null, tasks: null, keypoints: null });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange({ target: { files: [file] } });
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setTranscribing(true);
    setError('');
    setTranscript('');
    setElapsed(0);
    setStatus('Загружаем файл...');
    setAiResults({ correct: null, tasks: null, keypoints: null });

    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', language);
      if (apiKey) { formData.append('apiKey', apiKey); formData.append('apiEndpoint', apiEndpoint); }

      setStatus('Транскрибируем...');

      const response = await fetch(`${BACKEND}/api/transcribe`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      const finalElapsed = Math.floor((Date.now() - startTime) / 1000);
      setLastElapsed(finalElapsed);

      if (data.success) {
        if (!data.transcript?.trim()) {
          setError('Транскрипция пуста — речь не найдена в файле. Проверьте аудио или смените язык.');
        } else {
          setTranscript(data.transcript);
        }
        setStatus('');
      } else {
        setError(data.error || 'Ошибка транскрибации');
        setStatus('');
      }
    } catch (err) {
      setError(`Ошибка соединения: ${err.message}`);
      setStatus('');
    } finally {
      clearInterval(timer);
      setTranscribing(false);
      setElapsed(0);
    }
  };

  const handleAnalyze = async (action) => {
    setAnalyzing(action);
    setAiError('');
    try {
      const response = await fetch(`${BACKEND}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, action, apiKey: apiKey || undefined, apiEndpoint: apiEndpoint || undefined, apiModel: apiModel || undefined })
      });
      const data = await response.json();
      if (data.success) {
        setAiResults(prev => ({ ...prev, [action]: data.result }));
      } else if (data.error === 'ollama_not_running') {
        setAiError('Ollama не запущен. Установите Ollama и запустите: ollama pull qwen2.5:3b');
      } else if (data.error === 'model_not_found') {
        setAiError('Модель не найдена. Выполните: ollama pull qwen2.5:3b');
      } else {
        setAiError(data.error || 'Ошибка анализа');
      }
    } catch (err) {
      setAiError(`Ошибка: ${err.message}`);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  };

  const handleSetupAI = async () => {
    if (!window.electronAPI?.setupAI) return;
    setSetupInProgress(true);
    setSetupProgress({ msg: 'Начинаем...', pct: 0 });
    window.electronAPI.onSetupProgress((data) => setSetupProgress(data));
    const result = await window.electronAPI.setupAI();
    if (result.success) {
      setOllamaReady(true);
      setShowAiOnboarding(false);
      setSetupProgress({ msg: '', pct: 0 });
    } else {
      setSetupProgress({ msg: `Ошибка: ${result.error}`, pct: 0, error: true });
    }
    setSetupInProgress(false);
  };

  const AI_ACTIONS = [
    { key: 'correct', label: 'Исправить текст', icon: '✏️', desc: 'Исправить ошибки распознавания' },
    { key: 'tasks', label: 'Задачи', icon: '✅', desc: 'Вытащить задачи и договорённости' },
    { key: 'keypoints', label: 'Ключевые мысли', icon: '💡', desc: 'Главные тезисы разговора' },
  ];

  const ChipIcon = () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block align-middle">
      <rect x="9" y="9" width="18" height="18" rx="3" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5"/>
      <rect x="13" y="13" width="10" height="10" rx="1.5" fill="white" fillOpacity="0.3"/>
      {/* Pins left */}
      <line x1="5" y1="13" x2="9" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5" y1="18" x2="9" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5" y1="23" x2="9" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Pins right */}
      <line x1="27" y1="13" x2="31" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="27" y1="18" x2="31" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="27" y1="23" x2="31" y2="23" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Pins top */}
      <line x1="13" y1="5" x2="13" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="5" x2="18" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="23" y1="5" x2="23" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Pins bottom */}
      <line x1="13" y1="27" x2="13" y2="31" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="18" y1="27" x2="18" y2="31" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="23" y1="27" x2="23" y2="31" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f1' }}>
      {/* Header */}
      <header style={{ background: '#0c3b26' }}>
        <div className="max-w-6xl mx-auto px-4 py-7 text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <ChipIcon />
            <h1 className="text-4xl font-bold tracking-tight text-white">Транскрибатор</h1>
          </div>
          <p className="mt-1 text-sm tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Speech to Text · AI Analysis</p>
          <div className="mt-3 flex justify-center gap-4">
            {loading ? (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Проверяем сервер...</span>
            ) : backendReady ? (
              <span className="text-xs font-medium" style={{ color: '#6ee7a8' }}>● Сервер готов</span>
            ) : (
              <span className="text-red-400 text-xs font-medium">● Сервер недоступен</span>
            )}
            {backendReady && whisperDevice && (
              <span className="text-xs font-medium" style={{ color: whisperDevice === 'cuda' ? '#6ee7a8' : 'rgba(255,255,255,0.6)' }}>
                ● {whisperDevice === 'cuda' ? 'GPU (CUDA)' : 'CPU'} · medium
              </span>
            )}
            {backendReady && (
              ollamaReady
                ? <span className="text-xs font-medium" style={{ color: '#6ee7a8' }}>● AI готов</span>
                : <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>● AI не настроен</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {!backendReady && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-800">
            ⚠️ Запустите backend: <code className="bg-red-100 px-2 py-0.5 rounded">cd backend && npm run dev</code>
            <br />
            и Python сервис: <code className="bg-red-100 px-2 py-0.5 rounded">python backend/whisper_service.py</code>
          </div>
        )}

        {/* Онбординг AI */}
        {!loading && !ollamaReady && showAiOnboarding && (
          <div className="rounded-xl p-6 mb-6 shadow-sm border" style={{ background: '#eaf3ee', borderColor: '#b6d5c4' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: '#0c3b26' }}>🤖 Хотите AI-анализ транскрипций?</h3>
                <p className="text-sm mb-4" style={{ color: '#1a5c3a' }}>
                  Установите Ollama — и сможете исправлять текст, вытаскивать задачи и ключевые мысли прямо в приложении. Работает полностью локально, ~2 ГБ.
                </p>
                {setupInProgress ? (
                  <div>
                    <p className="text-sm mb-2" style={{ color: '#0c3b26' }}>{setupProgress.msg}</p>
                    <div className="w-full rounded-full h-3 mb-1" style={{ background: '#b6d5c4' }}>
                      <div
                        className="h-3 rounded-full transition-all duration-300"
                        style={{ width: `${setupProgress.pct || 0}%`, background: '#0c3b26' }}
                      />
                    </div>
                    <p className="text-xs" style={{ color: '#3a7d58' }}>Не закрывайте приложение...</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {setupProgress.error && (
                      <p className="w-full text-red-700 text-sm mb-1">{setupProgress.msg}</p>
                    )}
                    <button
                      onClick={handleSetupAI}
                      className="text-white font-semibold py-2 px-5 rounded-lg transition text-sm"
                      style={{ background: '#0c3b26' }}
                      onMouseOver={e => e.currentTarget.style.background='#0a2e1e'}
                      onMouseOut={e => e.currentTarget.style.background='#0c3b26'}
                    >
                      Установить AI
                    </button>
                    <button
                      onClick={() => {
                        localStorage.setItem('aiOnboardingDismissed', '1');
                        setShowAiOnboarding(false);
                      }}
                      className="text-sm underline"
                      style={{ color: '#1a5c3a' }}
                    >
                      Пропустить
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Загрузить аудио</h2>

          {/* Язык */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Язык</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ru">🇷🇺 Русский</option>
              <option value="en">🇬🇧 English</option>
              <option value="es">🇪🇸 Español</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="de">🇩🇪 Deutsch</option>
            </select>
          </div>

          {/* Загрузка файла */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Файл (MP3, WAV, OGG, M4A · до 100 МБ)
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer"
              onClick={() => document.getElementById('audioInput').click()}
            >
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
                id="audioInput"
              />
              {audioFile ? (
                <div>
                  <p className="text-green-600 font-semibold">✓ {audioFile.name}</p>
                  <p className="text-gray-400 text-xs mt-1">{formatSize(audioFile.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500">Нажмите или перетащите файл</p>
                  <p className="text-gray-400 text-xs mt-1">MP3, WAV, OGG, M4A, AAC</p>
                </div>
              )}
            </div>
          </div>

          {/* Кнопка */}
          <button
            onClick={handleTranscribe}
            disabled={!audioFile || transcribing || !backendReady || !whisperReady}
            className="w-full disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-lg transition"
            style={{ background: (!audioFile || transcribing || !backendReady || !whisperReady) ? undefined : '#0c3b26' }}
          >
            {transcribing ? '⏳ Обрабатываем...' : !whisperReady && backendReady ? '⏳ Запуск сервиса...' : '📝 Транскрибировать'}
          </button>

          {status && (
            <div className="mt-4 text-sm rounded-lg p-3" style={{ color: '#0c3b26', background: '#eaf3ee', border: '1px solid #b6d5c4' }}>
              {status}{elapsed > 0 ? ` (${elapsed} сек)` : ''}
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Результат транскрипции */}
        {lastElapsed !== null && !transcribing && (
          <div className="mb-3 text-xs text-center" style={{ color: '#6b7280' }}>
            ⏱ Транскрибировано за {lastElapsed} сек
            {whisperDevice && <span> · {whisperDevice === 'cuda' ? '🟢 GPU (CUDA)' : '🟡 CPU'}</span>}
          </div>
        )}
        {transcript && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">📄 Транскрипция</h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{transcript}</p>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => handleCopy(transcript)}
                className="text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                style={{ background: '#0c3b26' }}
              >
                {copied ? '✅ Скопировано!' : '📋 Копировать'}
              </button>
              <button
                onClick={() => { setTranscript(''); setAudioFile(null); setAiResults({ correct: null, tasks: null, keypoints: null }); }}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-lg transition text-sm"
              >
                Очистить
              </button>
            </div>
          </div>
        )}

        {/* AI Анализ */}
        {transcript && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold mb-2 text-gray-800">🤖 AI Анализ</h2>

            {!ollamaReady ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                <p className="font-semibold mb-2">AI не настроен</p>
                {setupInProgress ? (
                  <div>
                    <p className="mb-2 text-sm">{setupProgress.msg}</p>
                    <div className="w-full bg-amber-200 rounded-full h-3">
                      <div
                        className="bg-amber-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${setupProgress.pct || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-amber-600 mt-1">Не закрывайте приложение...</p>
                  </div>
                ) : (
                  <>
                    {setupProgress.error && <p className="mb-2 text-red-700 text-sm">{setupProgress.msg}</p>}
                    <button
                      onClick={handleSetupAI}
                      className="text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                      style={{ background: '#0c3b26' }}
                    >
                      Установить AI одной кнопкой
                    </button>
                    <p className="text-xs text-amber-600 mt-2">Скачает Ollama + модель ~2 ГБ</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-500 text-sm">Выберите что нужно сделать с транскриптом:</p>
                  <button
                    onClick={() => setShowApiSettings(v => !v)}
                    className="text-xs px-3 py-1 rounded-lg border transition"
                    style={{ borderColor: useApiMode ? '#0c3b26' : '#d1d5db', color: useApiMode ? '#0c3b26' : '#6b7280', background: useApiMode ? '#eaf3ee' : 'white' }}
                    title="Настройки API"
                  >
                    {useApiMode ? '🔑 API включён' : '⚙️ API ключ'}
                  </button>
                </div>

                {showApiSettings && (
                  <div className="mb-4 p-4 rounded-lg border text-sm" style={{ background: '#f8faf9', borderColor: '#b6d5c4' }}>
                    <p className="font-semibold mb-3" style={{ color: '#0c3b26' }}>Внешний AI (быстро, без нагрева)</p>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">API ключ (OpenAI, Groq, Together...)</label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={e => setApiKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Endpoint</label>
                        <input
                          type="text"
                          value={apiEndpoint}
                          onChange={e => setApiEndpoint(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Модель</label>
                        <input
                          type="text"
                          value={apiModel}
                          onChange={e => setApiModel(e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={saveApiSettings} className="text-white text-xs font-semibold px-4 py-1.5 rounded-lg" style={{ background: '#0c3b26' }}>Сохранить</button>
                        <button onClick={() => { setApiKey(''); localStorage.removeItem('apiKey'); }} className="text-xs px-4 py-1.5 rounded-lg border border-gray-300 text-gray-600">Очистить</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mb-4">
                  {AI_ACTIONS.map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => handleAnalyze(key)}
                      disabled={!!analyzing}
                      className="flex items-center gap-2 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                      style={{ background: '#0c3b26' }}
                    >
                      {analyzing === key ? '⏳' : icon} {label}
                    </button>
                  ))}
                </div>

                {analyzing && (
                  <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg" style={{ background: '#eaf3ee' }}>
                    <svg className="animate-spin h-4 w-4 flex-shrink-0" style={{ color: '#0c3b26' }} fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <span className="text-sm" style={{ color: '#0c3b26' }}>
                      {AI_ACTIONS.find(a => a.key === analyzing)?.label}... {useApiMode ? 'запрос к API' : 'Ollama думает'}
                    </span>
                  </div>
                )}

                {aiError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-red-800 text-sm">{aiError}</p>
                  </div>
                )}

                {AI_ACTIONS.map(({ key, label, icon }) =>
                  aiResults[key] ? (
                    <div key={key} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 flex justify-between items-center" style={{ background: '#eaf3ee' }}>
                        <span className="font-semibold text-sm" style={{ color: '#0c3b26' }}>{icon} {label}</span>
                        <button
                          onClick={() => handleCopy(aiResults[key])}
                          className="text-xs"
                          style={{ color: '#1a5c3a' }}
                        >
                          📋 Копировать
                        </button>
                      </div>
                      <div className="bg-gray-50 px-4 py-3">
                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{aiResults[key]}</p>
                      </div>
                    </div>
                  ) : null
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="mt-12 py-5 text-white" style={{ background: '#0c3b26' }}>
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <p style={{ color: 'rgba(255,255,255,0.45)' }}>Developed by <span className="font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>Supremeister</span></p>
        </div>
      </footer>
    </div>
  );
}

export default App;
