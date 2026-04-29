import React, { useEffect, useState } from 'react';
import './App.css';

const BACKEND = 'http://localhost:3000';

const AI_ANALYSIS_ENABLED = true;

function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [whisperReady, setWhisperReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioFile, setAudioFile] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState([]); // speaker diarization blocks
  const [language, setLanguage] = useState('ru');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastElapsed, setLastElapsed] = useState(null); // итоговое время последней транскрипции
  const [whisperDevice, setWhisperDevice] = useState(null); // 'cuda' | 'cpu'

  // AI состояние
  const [ollamaReady, setOllamaReady] = useState(false);
  const [aiProvider, setAiProvider] = useState('none'); // 'groq' | 'ollama' | 'none'
  const [botUsername, setBotUsername] = useState(null);
  const [analyzing, setAnalyzing] = useState(null); // 'correct' | 'tasks' | 'keypoints' | null
  const [aiResults, setAiResults] = useState({ correct: null, tasks: null, keypoints: null });
  const [aiError, setAiError] = useState('');
  const [analyzeElapsed, setAnalyzeElapsed] = useState(0);
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

  // Диаризация — настройки
  const [modelDownload, setModelDownload] = useState(null); // {pct, done, total}

  const [diarizeStatus, setDiarizeStatus] = useState(null); // {python, pyannote, hfToken, ready}
  const [hfTokenDraft, setHfTokenDraft] = useState('');
  const [hfTokenSaved, setHfTokenSaved] = useState(false);
  const [diarizeInstalling, setDiarizeInstalling] = useState(false);
  const [diarizeInstallMsg, setDiarizeInstallMsg] = useState('');
  const [diarizeInstallPct, setDiarizeInstallPct] = useState(0);

  const checkDiarizeStatus = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/diarize/status`);
      const data = await res.json();
      setDiarizeStatus(data);
    } catch {}
  };

  const saveHfToken = async () => {
    if (!hfTokenDraft.startsWith('hf_')) return;
    try {
      await fetch(`${BACKEND}/api/diarize/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: hfTokenDraft })
      });
      setHfTokenSaved(true);
      setTimeout(() => setHfTokenSaved(false), 2000);
      checkDiarizeStatus();
    } catch {}
  };

  const installDiarize = async () => {
    setDiarizeInstalling(true);
    setDiarizeInstallMsg('Запускаем установку...');
    setDiarizeInstallPct(5);
    try {
      const res = await fetch(`${BACKEND}/api/diarize/install`, { method: 'POST' });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.msg) { setDiarizeInstallMsg(data.msg); setDiarizeInstallPct(data.pct || 0); }
          if (data.done) { checkDiarizeStatus(); }
        }
      }
    } catch (e) {
      setDiarizeInstallMsg('Ошибка: ' + e.message);
    } finally {
      setDiarizeInstalling(false);
    }
  };

  // Тип диалога
  const [dialogType, setDialogType] = useState(() => localStorage.getItem('dialogType') || 'client');
  const setAndSaveDialogType = (type) => { setDialogType(type); localStorage.setItem('dialogType', type); };

  // Профиль пользователя
  const [userProfile, setUserProfile] = useState(() => localStorage.getItem('userProfile') || '');
  const [showProfile, setShowProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState('');

  const openProfile = () => { setProfileDraft(userProfile); setShowProfile(true); };
  const saveProfile = () => { localStorage.setItem('userProfile', profileDraft); setUserProfile(profileDraft); setShowProfile(false); };

  // История сессий
  const getHistory = () => { try { return JSON.parse(localStorage.getItem('analysisHistory') || '[]'); } catch { return []; } };
  const addToHistory = (filename, summary) => {
    const history = getHistory();
    history.unshift({ date: new Date().toISOString(), filename: filename || 'unknown', summary: summary.slice(0, 500) });
    localStorage.setItem('analysisHistory', JSON.stringify(history.slice(0, 10)));
  };

  const useApiMode = !!apiKey;

  useEffect(() => {
    if (window.electronAPI?.onModelDownloadProgress) {
      window.electronAPI.onModelDownloadProgress((data) => {
        setModelDownload(data);
        if (data.pct >= 100) setTimeout(() => setModelDownload(null), 2000);
      });
    }
    if (window.electronAPI?.getBotUsername) {
      window.electronAPI.getBotUsername().then(u => { if (u) setBotUsername(u); });
      window.electronAPI.onBotUsername(u => setBotUsername(u));
    }
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BACKEND}/health`);
        setBackendReady(res.ok);
        if (res.ok) {
          const aiRes = await fetch(`${BACKEND}/api/analyze/health`);
          const aiData = await aiRes.json();
          setOllamaReady(aiData.hasModel);
          setAiProvider(aiData.provider || 'none');
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
    const allowedExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'mp4', 'mov', 'mkv', 'avi', 'webm'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      setError(`Формат не поддерживается. Допустимые: ${allowedExts.join(', ').toUpperCase()}`);
      setAudioFile(null);
      return;
    }
    setAudioFile(file);
    setError('');
    setTranscript('');
    setSegments([]);
    setStatus('');
    setAiResults({ correct: null, tasks: null, keypoints: null });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange({ target: { files: [file] } });
  };

  useEffect(() => {
    if (!analyzing) { setAnalyzeElapsed(0); return; }
    setAnalyzeElapsed(0);
    const t = setInterval(() => setAnalyzeElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [analyzing]);

  const runAutoAnalysis = async (text) => {
    const action = dialogType === 'mentor' ? 'full_mentor' : 'full_client';
    setAnalyzing(action);
    setAiError('');
    const history = getHistory().slice(0, 3);
    try {
      const response = await fetch(`${BACKEND}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: text,
          action,
          userContext: userProfile || undefined,
          history: history.length ? history : undefined,
        })
      });
      const data = await response.json();
      if (data.success) {
        setAiResults(prev => ({ ...prev, full: data.result }));
        addToHistory(audioFile?.name, data.result);
      } else {
        setAiError(data.error || 'Ошибка AI анализа');
      }
    } catch (err) {
      setAiError(`Ошибка AI: ${err.message}`);
    } finally {
      setAnalyzing(null);
    }
  };

  const DIALOG_TYPES = [
    { value: 'client', label: 'Клиент', desc: 'Переговоры с клиентом' },
    { value: 'mentor', label: 'Ментор', desc: 'Коучинговая беседа' },
  ];

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setTranscribing(true);
    setError('');
    setTranscript('');
    setElapsed(0);
    setStatus('Загружаем файл...');
    setAiResults({ correct: null, tasks: null, keypoints: null, full: null });

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
          setSegments(data.segments || []);
          if (AI_ANALYSIS_ENABLED) {
            setStatus('Анализируем...');
            const analysisText = data.segments?.length > 0
              ? data.segments.map(s => `${s.speaker}:\n${s.text}`).join('\n\n')
              : data.transcript;
            await runAutoAnalysis(analysisText);
          }
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
    const history = action === 'full' ? getHistory().slice(0, 3) : undefined;
    try {
      const response = await fetch(`${BACKEND}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          action,
          apiKey: apiKey || undefined,
          apiEndpoint: apiEndpoint || undefined,
          apiModel: apiModel || undefined,
          userContext: userProfile || undefined,
          history: history?.length ? history : undefined,
        })
      });
      const data = await response.json();
      if (data.success) {
        setAiResults(prev => ({ ...prev, [action]: data.result }));
        if (action === 'full') addToHistory(audioFile?.name, data.result);
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

  const handleSave = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFilename = (suffix) => {
    const base = audioFile ? audioFile.name.replace(/\.[^.]+$/, '') : 'transcript';
    return `${base}_${suffix}.txt`;
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
          <div className="mt-3 flex justify-center items-center gap-4 flex-wrap">
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
            {backendReady && ollamaReady && (
              <span className="text-xs font-medium" style={{ color: '#6ee7a8' }}>
                ● AI · {aiProvider === 'groq' ? 'Groq' : aiProvider === 'ollama' ? 'Ollama' : 'готов'}
              </span>
            )}
            <button
              onClick={openProfile}
              className="text-xs px-3 py-1 rounded-full font-medium transition"
              style={{ background: userProfile ? 'rgba(110,231,168,0.2)' : 'rgba(255,255,255,0.12)', color: userProfile ? '#6ee7a8' : 'rgba(255,255,255,0.6)', border: '1px solid', borderColor: userProfile ? 'rgba(110,231,168,0.4)' : 'rgba(255,255,255,0.2)' }}
            >
              👤 {userProfile ? 'Профиль' : 'Добавить профиль'}
            </button>
            {botUsername && (
              <a
                href={`https://t.me/${botUsername.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-1 rounded-full font-medium transition"
                style={{ background: 'rgba(41,182,246,0.2)', color: '#29b6f6', border: '1px solid rgba(41,182,246,0.4)', textDecoration: 'none' }}
              >
                ✈️ {botUsername}
              </a>
            )}
            <button
              onClick={() => { setShowApiSettings(true); checkDiarizeStatus(); }}
              className="text-xs px-3 py-1 rounded-full font-medium transition"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              ⚙️ Настройки
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {!backendReady && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-800">
            ⚠️ Сервис не запущен. Перезапустите приложение. Если ошибка повторяется — обратитесь к разработчику.
          </div>
        )}


        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Загрузить аудио</h2>

          {/* Язык */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Язык аудио</label>
            <div className="flex gap-2">
              {[
                { value: 'ru', label: 'Русский', flag: (
                  <svg width="20" height="14" viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg">
                    <rect width="20" height="14" fill="#fff"/>
                    <rect y="4.67" width="20" height="4.67" fill="#0039A6"/>
                    <rect y="9.33" width="20" height="4.67" fill="#D52B1E"/>
                  </svg>
                )},
                { value: 'en', label: 'English', flag: (
                  <svg width="20" height="14" viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg">
                    <rect width="20" height="14" fill="#012169"/>
                    <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" strokeWidth="2.5"/>
                    <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.5"/>
                    <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="4"/>
                    <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="2.5"/>
                  </svg>
                )},
              ].map(({ value, label, flag }) => (
                <button
                  key={value}
                  onClick={() => setLanguage(value)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition"
                  style={{
                    background: language === value ? '#0c3b26' : '#fff',
                    color: language === value ? '#fff' : '#374151',
                    borderColor: language === value ? '#0c3b26' : '#d1d5db',
                  }}
                >
                  <span className="rounded-sm overflow-hidden flex-shrink-0">{flag}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Тип диалога */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Тип диалога</label>
            <div className="flex gap-2">
              {DIALOG_TYPES.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setAndSaveDialogType(value)}
                  title={desc}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition"
                  style={{
                    background: dialogType === value ? '#0c3b26' : '#fff',
                    color: dialogType === value ? '#fff' : '#374151',
                    borderColor: dialogType === value ? '#0c3b26' : '#d1d5db',
                  }}
                >
                  {value === 'client' ? '🤝' : '🎯'} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Загрузка файла */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Файл (аудио или видео · до 500 МБ)
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer"
              onClick={() => document.getElementById('audioInput').click()}
            >
              <input
                type="file"
                accept="audio/*,video/*"
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
                  <p className="text-gray-400 text-xs mt-1">MP3, WAV, OGG, M4A, AAC, MP4, MOV, MKV, AVI</p>
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
            {transcribing ? '⏳ Обрабатываем...' : !whisperReady && backendReady ? (modelDownload ? `⬇️ Загрузка модели ${modelDownload.pct}% (${modelDownload.done} / ${modelDownload.total} МБ)` : '⏳ Запуск сервиса...') : '📝 Транскрибировать'}
          </button>
          {!whisperReady && backendReady && modelDownload && (
            <div style={{ marginTop: 8, background: '#eaf3ee', borderRadius: 8, overflow: 'hidden', height: 6 }}>
              <div style={{ width: `${modelDownload.pct}%`, height: '100%', background: '#0c3b26', transition: 'width 0.5s' }} />
            </div>
          )}
          {!whisperReady && backendReady && !modelDownload && (
            <p className="text-xs text-center mt-2" style={{ color: '#9ca3af' }}>
              При первом запуске скачивается модель Whisper (~800 МБ) — это займёт несколько минут
            </p>
          )}

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
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              📄 Транскрипция
              {segments.length > 0 && (
                <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: '#eaf3ee', color: '#0c3b26' }}>
                  👥 {[...new Set(segments.map(s => s.speaker))].length} спикера
                </span>
              )}
            </h2>

            {segments.length > 0 ? (
              <div className="space-y-3">
                {segments.map((seg, i) => {
                  const isFirst = seg.speaker === [...new Set(segments.map(s => s.speaker))][0];
                  return (
                    <div key={i} className={`rounded-lg p-3 border ${isFirst ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
                      <div className={`text-xs font-semibold mb-1 ${isFirst ? 'text-blue-700' : 'text-orange-700'}`}>
                        {seg.speaker}
                      </div>
                      <p className={`text-sm leading-relaxed ${isFirst ? 'text-blue-900' : 'text-orange-900'}`}>
                        {seg.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{transcript}</p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const text = segments.length > 0
                    ? segments.map(s => `${s.speaker}:\n${s.text}`).join('\n\n')
                    : transcript;
                  handleCopy(text);
                }}
                className="text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                style={{ background: '#0c3b26' }}
              >
                {copied ? '✅ Скопировано!' : '📋 Копировать'}
              </button>
              <button
                onClick={() => {
                  const text = segments.length > 0
                    ? segments.map(s => `${s.speaker}:\n${s.text}`).join('\n\n')
                    : transcript;
                  handleSave(`=== ТРАНСКРИПЦИЯ ===\n\n${text}${aiResults.full ? `\n\n=== AI АНАЛИЗ ===\n\n${aiResults.full}` : ''}`, getFilename('всё'));
                }}
                className="text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                style={{ background: '#1a5c3a' }}
              >
                💾 Сохранить
              </button>
              <button
                onClick={() => { setTranscript(''); setSegments([]); setAudioFile(null); setAiResults({ correct: null, tasks: null, keypoints: null, full: null }); setLastElapsed(null); const inp = document.getElementById('audioInput'); if (inp) inp.value = ''; }}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-lg transition text-sm"
              >
                Очистить
              </button>
            </div>
          </div>
        )}

        {/* AI Анализ */}
        {AI_ANALYSIS_ENABLED && transcript && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">🤖 AI Анализ</h2>
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: '#eaf3ee', color: '#0c3b26' }}>
                {aiProvider === 'groq' ? 'Groq' : aiProvider === 'ollama' ? 'Ollama' : 'AI'}
              </span>
            </div>

            {/* Кнопка анализа */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => runAutoAnalysis(transcript)}
                disabled={!!analyzing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                style={{ background: '#0c3b26', color: '#fff' }}
              >
                {analyzing?.startsWith('full') ? (
                  <>
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Анализ... {analyzeElapsed > 0 && `(${analyzeElapsed}с)`}
                  </>
                ) : '📊 Повторить анализ'}
              </button>
            </div>

            {aiError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-800 text-sm">⚠️ {aiError}</p>
              </div>
            )}


            {aiResults.full && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 flex justify-between items-center" style={{ background: '#eaf3ee' }}>
                  <span className="font-semibold text-sm" style={{ color: '#0c3b26' }}>📊 Полный отчёт</span>
                  <button onClick={() => handleCopy(aiResults.full)} className="text-xs" style={{ color: '#1a5c3a' }}>
                    📋 Копировать
                  </button>
                </div>
                <div className="bg-gray-50 px-4 py-3">
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{aiResults.full}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Модал профиля */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-gray-800">👤 Профиль пользователя</h3>
              <button onClick={() => setShowProfile(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Кто вы, чем занимаетесь, ваши принципы. Это подтягивается в каждый AI-анализ.</p>
            <textarea
              value={profileDraft}
              onChange={(e) => setProfileDraft(e.target.value)}
              rows={8}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-green-600"
              placeholder="Пример: Я Михаил, брокер по недвижимости. Работаю над контрактингом и эксклюзивами. Принципы: чёткое разделение метрики/результата/плана/приёма, системное описание бизнес-процессов..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowProfile(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Отмена</button>
              <button onClick={saveProfile} className="px-4 py-2 text-sm text-white rounded-lg font-medium" style={{ background: '#0c3b26' }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Модал настроек / диаризация */}
      {showApiSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-800">⚙️ Настройки</h3>
              <button onClick={() => setShowApiSettings(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* Диаризация спикеров */}
            <div className="mb-6">
              <h4 className="font-semibold text-gray-700 mb-3">👥 Разделение по спикерам</h4>

              {/* Статус */}
              {diarizeStatus && (
                <div className="mb-4 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{diarizeStatus.python ? '✅' : '❌'}</span>
                    <span className="text-gray-600">Python: {diarizeStatus.python ? diarizeStatus.python.split('\\').pop() : 'не найден'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{diarizeStatus.pyannote ? '✅' : '❌'}</span>
                    <span className="text-gray-600">pyannote.audio: {diarizeStatus.pyannote ? 'установлен' : 'не установлен'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{diarizeStatus.hfToken ? '✅' : '❌'}</span>
                    <span className="text-gray-600">HuggingFace токен: {diarizeStatus.hfToken ? 'сохранён' : 'не задан'}</span>
                  </div>
                  {diarizeStatus.ready && (
                    <div className="mt-2 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: '#eaf3ee', color: '#0c3b26' }}>
                      🎉 Диаризация готова к работе
                    </div>
                  )}
                </div>
              )}
              {!diarizeStatus && (
                <button onClick={checkDiarizeStatus} className="text-sm text-blue-600 underline mb-3">Проверить статус</button>
              )}

              {/* Установка pyannote */}
              {diarizeStatus && !diarizeStatus.pyannote && diarizeStatus.python && (
                <div>
                  <button
                    onClick={installDiarize}
                    disabled={diarizeInstalling}
                    className="w-full py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50"
                    style={{ background: '#1a5c3a' }}
                  >
                    {diarizeInstalling ? '⏳ Устанавливаем...' : '⬇️ Установить pyannote.audio'}
                  </button>
                  {diarizeInstalling && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${diarizeInstallPct}%`, background: '#0c3b26' }} />
                      </div>
                      <p className="text-xs text-gray-500">{diarizeInstallMsg}</p>
                    </div>
                  )}
                  {!diarizeInstalling && diarizeInstallMsg && (
                    <p className="text-xs text-gray-500 mt-1">{diarizeInstallMsg}</p>
                  )}
                </div>
              )}

              {diarizeStatus && !diarizeStatus.python && (
                <div className="text-xs text-orange-600 bg-orange-50 rounded-lg p-3">
                  Python не найден. Установите <a href="https://python.org" target="_blank" rel="noreferrer" className="underline">Python 3.10+</a>, затем перезапустите приложение.
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setShowApiSettings(false)} className="px-4 py-2 text-sm text-white rounded-lg font-medium" style={{ background: '#0c3b26' }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 py-5 text-white" style={{ background: '#0c3b26' }}>
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <p style={{ color: 'rgba(255,255,255,0.45)' }}>Developed by <span className="font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>Supremeister</span></p>
        </div>
      </footer>
    </div>
  );
}

export default App;
