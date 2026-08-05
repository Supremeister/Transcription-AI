import React, { useEffect, useState } from 'react';
import './App.css';

const BACKEND = 'http://localhost:3000';

const AI_ANALYSIS_ENABLED = true;

const KNOWLEDGE_KIND_LABELS = {
  fact: 'Факт',
  metric: 'Метрика',
  decision: 'Решение',
  principle: 'Принцип',
  process: 'Процесс',
  script: 'Скрипт',
  risk: 'Риск',
  open_question: 'Открытый вопрос',
};

const KNOWLEDGE_STATUS_LABELS = {
  direct: 'Прямо сказано',
  inferred: 'Следует из контекста',
  needs_confirmation: 'Требует подтверждения',
  asr_risk: 'ASR-риск',
};

const SPEAKER_STYLES = [
  { block: 'border-blue-200 bg-blue-50', label: 'text-blue-700', text: 'text-blue-900' },
  { block: 'border-orange-200 bg-orange-50', label: 'text-orange-700', text: 'text-orange-900' },
  { block: 'border-emerald-200 bg-emerald-50', label: 'text-emerald-700', text: 'text-emerald-900' },
  { block: 'border-purple-200 bg-purple-50', label: 'text-purple-700', text: 'text-purple-900' },
  { block: 'border-pink-200 bg-pink-50', label: 'text-pink-700', text: 'text-pink-900' },
  { block: 'border-cyan-200 bg-cyan-50', label: 'text-cyan-700', text: 'text-cyan-900' },
];

const formatTimestamp = (seconds, precise = false) => {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return null;
  const totalTenths = Math.max(0, Math.round(value * 10));
  const totalSeconds = precise
    ? Math.floor(totalTenths / 10)
    : Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const secondsLabel = precise
    ? `${String(secs).padStart(2, '0')}.${totalTenths % 10}`
    : String(secs).padStart(2, '0');
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secondsLabel}`
    : `${String(minutes).padStart(2, '0')}:${secondsLabel}`;
};

const getSegmentTimeLabel = (segment) => {
  const startValue = Number(segment?.start);
  const endValue = Number(segment?.end);
  const precise = (
    Number.isFinite(startValue)
    && Number.isFinite(endValue)
    && endValue > startValue
    && Math.floor(startValue) === Math.floor(endValue)
  );
  const start = formatTimestamp(startValue, precise);
  const end = formatTimestamp(endValue, precise);
  return start && end ? `[${start}–${end}]` : '';
};

const formatSegmentsForExport = (items) => items
  .map((segment) => {
    const timestamp = getSegmentTimeLabel(segment);
    const overlapSeconds = Number(segment.overlap_seconds);
    const overlap = segment.has_overlap
      ? ` ⚠ заметное наложение${Number.isFinite(overlapSeconds) ? ` ~${overlapSeconds.toFixed(1)} с` : ''}`
      : '';
    const prefix = [timestamp, segment.speaker || 'Речь'].filter(Boolean).join(' ');
    return `${prefix}${overlap}:\n${segment.text}`;
  })
  .join('\n\n');

function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [asrReady, setAsrReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioFile, setAudioFile] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState([]); // speaker diarization blocks
  const [overlaps, setOverlaps] = useState([]);
  const [diarizationNotice, setDiarizationNotice] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastElapsed, setLastElapsed] = useState(null); // итоговое время последней транскрипции
  const [asrDevice, setAsrDevice] = useState(null); // 'cuda' | 'cpu'
  const [asrModel, setAsrModel] = useState(null);
  const [diarizationModel, setDiarizationModel] = useState(null);
  const [diarizationReady, setDiarizationReady] = useState(false);

  // AI состояние
  const [ollamaReady, setOllamaReady] = useState(false);
  const [aiProvider, setAiProvider] = useState('none'); // 'pi' | 'groq' | 'custom-api' | 'none'
  const [aiModel, setAiModel] = useState(null);
  const [piStatus, setPiStatus] = useState(null);
  const [botUsername, setBotUsername] = useState(null);
  const [analyzing, setAnalyzing] = useState(null); // 'correct' | 'tasks' | 'keypoints' | null
  const [aiResults, setAiResults] = useState({ correct: null, tasks: null, keypoints: null });
  const [aiError, setAiError] = useState('');
  const [analyzeElapsed, setAnalyzeElapsed] = useState(0);
  const [obsidianStatus, setObsidianStatus] = useState(null);
  const [contextProject, setContextProject] = useState(
    () => localStorage.getItem('contextProject') || ''
  );
  const [agentContext, setAgentContext] = useState(null);
  const [transcriptArchive, setTranscriptArchive] = useState(null);
  const [transcriptArchiveError, setTranscriptArchiveError] = useState('');
  const [taskProposals, setTaskProposals] = useState([]);
  const [proposalDrafts, setProposalDrafts] = useState({});
  const [proposalBusy, setProposalBusy] = useState(null);
  const [transcriptTopic, setTranscriptTopic] = useState('');
  const [analysisSummary, setAnalysisSummary] = useState('');
  const [keyKnowledge, setKeyKnowledge] = useState([]);
  const [extractionMetrics, setExtractionMetrics] = useState(null);
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [setupProgress, setSetupProgress] = useState({ msg: '', pct: 0 });
  const [updateAvailable, setUpdateAvailable] = useState(null); // {version}
  const [updateReady, setUpdateReady] = useState(null); // {version}
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
  const setAndSaveContextProject = (projectId) => {
    setContextProject(projectId);
    if (projectId) localStorage.setItem('contextProject', projectId);
    else localStorage.removeItem('contextProject');
  };

  // Количество спикеров для Community-1
  const [speakerMode, setSpeakerMode] = useState(() => {
    const saved = localStorage.getItem('speakerMode') || '2';
    return ['auto', '2', '3', '4+'].includes(saved) ? saved : '2';
  });
  const setAndSaveSpeakerMode = (mode) => {
    setSpeakerMode(mode);
    localStorage.setItem('speakerMode', mode);
  };

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

  useEffect(() => {
    if (window.electronAPI?.getBotUsername) {
      window.electronAPI.getBotUsername().then(u => { if (u) setBotUsername(u); });
      window.electronAPI.onBotUsername(u => setBotUsername(u));
    }
    if (window.electronAPI?.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable(info => setUpdateAvailable(info));
    }
    if (window.electronAPI?.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded(info => setUpdateReady(info));
    }
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BACKEND}/health`);
        setBackendReady(res.ok);
        if (res.ok) {
           const [aiRes, agentRes] = await Promise.all([
             fetch(`${BACKEND}/api/analyze/health`),
             fetch(`${BACKEND}/api/agent/health`),
           ]);
           const aiData = await aiRes.json();
           setOllamaReady(aiData.hasModel);
           setAiProvider(aiData.provider || 'none');
           setAiModel(aiData.model || null);
           setPiStatus(aiData.pi || null);
           if (agentRes.ok) {
             const agentData = await agentRes.json();
             setObsidianStatus(agentData);
             const savedProjectExists = agentData.projects?.some(
               project => project.id === contextProject
             );
             if (contextProject && !savedProjectExists) {
               setContextProject('');
               localStorage.removeItem('contextProject');
             }
           }
        }
      } catch {
        setBackendReady(false);
      } finally {
        setLoading(false);
      }
    };
    checkHealth();
  }, []);

  // Поллинг GigaAM до готовности
  useEffect(() => {
    if (!backendReady) return;
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/transcribe/health`);
        const data = await res.json();
        if (data.status === 'ok') {
          setAsrReady(true);
          setAsrDevice(data.asr?.device || null);
          setAsrModel(data.asr?.model || 'GigaAM-v3-RNNT');
          setDiarizationModel(data.asr?.diarization_model || null);
          setDiarizationReady(Boolean(data.asr?.diarization));
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
    setOverlaps([]);
    setDiarizationNotice('');
    setStatus('');
    setAiResults({ correct: null, tasks: null, keypoints: null });
    setAgentContext(null);
    setTranscriptArchive(null);
    setTranscriptArchiveError('');
    setTaskProposals([]);
    setProposalDrafts({});
    setTranscriptTopic('');
    setAnalysisSummary('');
    setKeyKnowledge([]);
    setExtractionMetrics(null);
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
    const action = dialogType === 'mentor' ? 'full_mentor' : dialogType === 'own' ? 'full' : 'full_client';
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
          apiKey: apiKey || undefined,
          apiEndpoint: apiEndpoint || undefined,
          apiModel: apiModel || undefined,
          userContext: userProfile || undefined,
          history: history.length ? history : undefined,
          preferredProject: contextProject || undefined,
          sourceFilename: audioFile?.name || undefined,
          speakersCount: segments.length > 0
            ? new Set(segments.map(segment => segment.speaker).filter(Boolean)).size
            : undefined,
        })
      });
      const data = await response.json();
      if (data.transcriptArchive) setTranscriptArchive(data.transcriptArchive);
      setTranscriptArchiveError(data.transcriptArchiveError || '');
      if (data.success) {
        setAiResults(prev => ({ ...prev, full: data.result }));
        if (data.provider) setAiProvider(data.provider);
        if (data.model) setAiModel(data.model);
        if (data.agentContext) setAgentContext(data.agentContext);
        setTranscriptTopic(data.topic || '');
        setAnalysisSummary(data.summary || '');
        setKeyKnowledge(Array.isArray(data.knowledge) ? data.knowledge : []);
        setExtractionMetrics(data.extractionMetrics || null);
        if (Array.isArray(data.proposals)) {
          setTaskProposals(data.proposals);
          setProposalDrafts(Object.fromEntries(data.proposals.map(proposal => [
            proposal.id,
            {
              task: proposal.task,
              projectId: proposal.projectId || '',
              due: proposal.due || '',
            },
          ])));
        }
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
    { value: 'own', label: 'Своё', desc: 'Задачи, ключевые выводы, зоны роста — без шаблона' },
  ];

  const SPEAKER_MODES = [
    { value: 'auto', label: 'Авто', desc: 'Community-1 определит число спикеров' },
    { value: '2', label: '2', desc: 'Ровно два спикера' },
    { value: '3', label: '3', desc: 'Ровно три спикера' },
    { value: '4+', label: '4+', desc: 'Четыре или больше спикеров' },
  ];

  const handleTranscribe = async () => {
    if (!audioFile) return;
    setTranscribing(true);
    setError('');
    setTranscript('');
    setSegments([]);
    setOverlaps([]);
    setDiarizationNotice('');
    setElapsed(0);
    setStatus('Загружаем файл...');
    setAiResults({ correct: null, tasks: null, keypoints: null, full: null });
    setAgentContext(null);
    setTranscriptArchive(null);
    setTranscriptArchiveError('');
    setTaskProposals([]);
    setProposalDrafts({});
    setTranscriptTopic('');
    setAnalysisSummary('');
    setKeyKnowledge([]);
    setExtractionMetrics(null);

    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('speakerMode', speakerMode);

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
          setOverlaps(data.overlaps || []);
          if (data.diarized) {
            setDiarizationNotice('');
          } else if (data.diarization_error) {
            setDiarizationNotice(`Диаризация не выполнена: ${data.diarization_error}`);
          } else if (data.diarization_skipped_reason) {
            setDiarizationNotice(`Диаризация пропущена: ${data.diarization_skipped_reason}`);
          } else {
            setDiarizationNotice('Диаризация не выполнена');
          }
          if (AI_ANALYSIS_ENABLED) {
            setStatus('Анализируем...');
            const analysisText = data.segments?.length > 0
              ? formatSegmentsForExport(data.segments)
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
    const history = action.startsWith('full') ? getHistory().slice(0, 3) : undefined;
    const analysisTranscript = segments.length > 0
      ? formatSegmentsForExport(segments)
      : transcript;
    try {
      const response = await fetch(`${BACKEND}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: analysisTranscript,
          action,
          apiKey: apiKey || undefined,
          apiEndpoint: apiEndpoint || undefined,
          apiModel: apiModel || undefined,
          userContext: userProfile || undefined,
          history: history?.length ? history : undefined,
          preferredProject: contextProject || undefined,
          sourceFilename: audioFile?.name || undefined,
          speakersCount: uniqueSpeakers.length || undefined,
        })
      });
      const data = await response.json();
      if (data.transcriptArchive) setTranscriptArchive(data.transcriptArchive);
      setTranscriptArchiveError(data.transcriptArchiveError || '');
      if (data.success) {
        setAiResults(prev => ({ ...prev, [action]: data.result }));
        if (data.provider) setAiProvider(data.provider);
        if (data.model) setAiModel(data.model);
        if (data.agentContext) setAgentContext(data.agentContext);
        if (data.topic) setTranscriptTopic(data.topic);
        if (data.summary) setAnalysisSummary(data.summary);
        if (Array.isArray(data.knowledge) && data.knowledge.length > 0) {
          setKeyKnowledge(data.knowledge);
        }
        if (data.extractionMetrics) setExtractionMetrics(data.extractionMetrics);
        if (Array.isArray(data.proposals) && ['tasks', 'full', 'full_client', 'full_mentor'].includes(action)) {
          setTaskProposals(data.proposals);
          setProposalDrafts(Object.fromEntries(data.proposals.map(proposal => [
            proposal.id,
            {
              task: proposal.task,
              projectId: proposal.projectId || '',
              due: proposal.due || '',
            },
          ])));
        }
        if (action.startsWith('full')) addToHistory(audioFile?.name, data.result);
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

  const updateProposalDraft = (id, field, value) => {
    setProposalDrafts(previous => ({
      ...previous,
      [id]: { ...previous[id], [field]: value },
    }));
  };

  const moderateProposal = async (proposal, decision) => {
    setProposalBusy(proposal.id);
    setAiError('');
    try {
      const draft = proposalDrafts[proposal.id] || {};
      const response = await fetch(
        `${BACKEND}/api/agent/proposals/${proposal.id}/${decision}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: decision === 'approve'
            ? JSON.stringify({
                task: draft.task,
                projectId: draft.projectId,
                due: draft.due || null,
              })
            : '{}',
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Не удалось обновить задачу');
      setTaskProposals(previous => previous.map(item =>
        item.id === proposal.id ? data.proposal : item
      ));
    } catch (error) {
      setAiError(`Obsidian: ${error.message}`);
    } finally {
      setProposalBusy(null);
    }
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
    { key: 'keypoints', label: 'Ключевые знания', icon: '💡', desc: 'Устойчивые знания с источниками и статусом' },
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

  const uniqueSpeakers = [...new Set(segments.map(segment => segment.speaker).filter(Boolean))];
  const meaningfulOverlapCount = segments.filter(segment => segment.has_overlap).length;
  const asrDisplayName = asrModel === 'GigaAM-v3-RNNT'
    ? 'GigaAM v3 RNNT'
    : (asrModel || 'GigaAM v3 RNNT');
  const aiDisplayName = aiProvider === 'pi'
    ? `Pi · ${aiModel || 'GPT-5.6 Sol'}`
    : aiProvider === 'groq'
      ? 'Groq'
      : aiProvider === 'custom-api'
        ? (aiModel || 'Custom API')
        : aiProvider === 'ollama'
          ? 'Ollama'
          : 'AI';

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
            {backendReady && asrDevice && (
              <span className="text-xs font-medium" style={{ color: asrDevice === 'cuda' ? '#6ee7a8' : 'rgba(255,255,255,0.6)' }}>
                ● {asrDevice === 'cuda' ? 'GPU (CUDA)' : 'CPU'} · {asrDisplayName}
              </span>
            )}
            {backendReady && asrReady && (
              <span
                className="text-xs font-medium"
                title={diarizationModel || 'pyannote/speaker-diarization-community-1'}
                style={{ color: diarizationReady ? '#6ee7a8' : '#fbbf24' }}
              >
                ● Диаризация · Community-1{diarizationReady ? '' : ' недоступна'}
              </span>
            )}
            {backendReady && (aiProvider !== 'none' || apiKey) && (
              <span className="text-xs font-medium" style={{ color: '#6ee7a8' }}>
                ● AI · {aiProvider === 'none' && apiKey ? 'Резервный API' : aiDisplayName}
              </span>
            )}
            {backendReady && obsidianStatus && (
              <span
                className="text-xs font-medium"
                title={obsidianStatus.vaultPath}
                style={{ color: obsidianStatus.connected ? '#6ee7a8' : '#fbbf24' }}
              >
                ● Obsidian · {obsidianStatus.connected
                  ? `${obsidianStatus.documentsCount} заметок`
                  : 'vault недоступен'}
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
        {updateReady && (
          <div className="flex items-center justify-between rounded-xl px-5 py-3 mb-4 text-sm font-medium" style={{ background: '#0c3b26', color: '#fff' }}>
            <span>Версия {updateReady.version} скачана и готова к установке</span>
            <button
              onClick={() => window.electronAPI?.installUpdate()}
              className="ml-4 px-4 py-1.5 rounded-lg font-semibold text-sm"
              style={{ background: '#6ee7a8', color: '#0c3b26' }}
            >
              Установить и перезапустить
            </button>
          </div>
        )}
        {updateAvailable && !updateReady && (
          <div className="rounded-xl px-5 py-3 mb-4 text-sm" style={{ background: '#eaf3ee', color: '#0c3b26', border: '1px solid #b6d5c4' }}>
            Доступна новая версия {updateAvailable.version} — скачивается в фоне...
          </div>
        )}
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium" style={{ background: '#0c3b26', color: '#fff', borderColor: '#0c3b26' }}>
              <svg width="20" height="14" viewBox="0 0 20 14" xmlns="http://www.w3.org/2000/svg" className="rounded-sm overflow-hidden flex-shrink-0">
                <rect width="20" height="14" fill="#fff"/>
                <rect y="4.67" width="20" height="4.67" fill="#0039A6"/>
                <rect y="9.33" width="20" height="4.67" fill="#D52B1E"/>
              </svg>
              Русский · GigaAM v3 RNNT
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

          {/* Количество спикеров */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Количество спикеров</label>
            <div className="flex gap-2 flex-wrap">
              {SPEAKER_MODES.map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setAndSaveSpeakerMode(value)}
                  title={desc}
                  className="px-4 py-2 rounded-lg border font-medium text-sm transition"
                  style={{
                    background: speakerMode === value ? '#0c3b26' : '#fff',
                    color: speakerMode === value ? '#fff' : '#374151',
                    borderColor: speakerMode === value ? '#0c3b26' : '#d1d5db',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Если число участников известно, точный выбор обычно уменьшает ошибки разделения.
            </p>
          </div>

          {/* Проект Obsidian */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Проект для контекста и архива
            </label>
            <select
              value={contextProject}
              onChange={(event) => setAndSaveContextProject(event.target.value)}
              disabled={!obsidianStatus?.connected}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-700 disabled:bg-gray-100"
            >
              <option value="">Определить автоматически</option>
              {(obsidianStatus?.projects || []).map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Транскрипция сохранится в папку «Транскрипции» выбранного проекта.
              При автоопределении неизвестные записи попадут в «Транскрипции/Неразобранное».
            </p>
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
            disabled={!audioFile || transcribing || !backendReady || !asrReady}
            className="w-full disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-lg transition"
            style={{ background: (!audioFile || transcribing || !backendReady || !asrReady) ? undefined : '#0c3b26' }}
          >
            {transcribing ? '⏳ Обрабатываем...' : !asrReady && backendReady ? '⏳ Запуск GigaAM...' : '📝 Транскрибировать'}
          </button>
          {!asrReady && backendReady && (
            <div style={{ marginTop: 8 }}>
              <div style={{ background: '#eaf3ee', borderRadius: 8, overflow: 'hidden', height: 8 }}>
                <div style={{
                  height: '100%', background: '#0c3b26', borderRadius: 8,
                  width: '40%', animation: 'pulse-bar 1.5s ease-in-out infinite'
                }} />
              </div>
              <p className="text-xs text-center mt-1" style={{ color: '#9ca3af' }}>
                При первом запуске загружаются GigaAM v3 RNNT и Community-1 — подождите несколько минут
              </p>
            </div>
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
            {asrDevice && <span> · {asrDevice === 'cuda' ? '🟢 GPU (CUDA)' : '🟡 CPU'}</span>}
          </div>
        )}
        {transcript && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              📄 Транскрипция
              {uniqueSpeakers.length > 0 && (
                <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: '#eaf3ee', color: '#0c3b26' }}>
                  👥 {uniqueSpeakers.length} спикеров
                </span>
              )}
              {meaningfulOverlapCount > 0 && (
                <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: '#9a3412' }}>
                  ⚠ Заметных наложений: {meaningfulOverlapCount}
                </span>
              )}
            </h2>

            {diarizationNotice && (
              <div
                className="mb-4 rounded-lg p-3 text-sm"
                style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' }}
              >
                {diarizationNotice}
              </div>
            )}

            {transcriptArchive && (
              <div
                className="mb-4 rounded-lg p-3 text-sm"
                style={{ background: '#ecfdf5', color: '#166534', border: '1px solid #86efac' }}
              >
                ✓ Сохранено в Obsidian: <span className="font-medium">{transcriptArchive.relativePath}</span>
                {transcriptArchive.duplicate ? ' · такая транскрипция уже была в архиве' : ''}
              </div>
            )}
            {transcriptArchiveError && (
              <div className="mb-4 rounded-lg p-3 text-sm bg-amber-50 text-amber-800 border border-amber-200">
                ⚠ Не удалось сохранить в Obsidian: {transcriptArchiveError}
              </div>
            )}

            {segments.length > 0 ? (
              <div className="space-y-3">
                {segments.map((seg, i) => {
                  const speakerIndex = Math.max(0, uniqueSpeakers.indexOf(seg.speaker));
                  const speakerStyle = SPEAKER_STYLES[speakerIndex % SPEAKER_STYLES.length];
                  const timeLabel = getSegmentTimeLabel(seg);
                  return (
                    <div
                      key={i}
                      className={`rounded-lg p-3 border ${speakerStyle.block} ${seg.has_overlap ? 'ring-1 ring-red-300' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className={`text-xs font-semibold ${speakerStyle.label}`}>
                          {seg.speaker || 'Речь'}
                          {seg.has_overlap && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                              ⚠ заметное наложение
                              {Number.isFinite(Number(seg.overlap_seconds))
                                ? ` ~${Number(seg.overlap_seconds).toFixed(1)} с`
                                : ''}
                            </span>
                          )}
                        </div>
                        {timeLabel && (
                          <span className="text-xs font-mono text-gray-500 whitespace-nowrap">{timeLabel}</span>
                        )}
                      </div>
                      <p className={`text-sm leading-relaxed ${speakerStyle.text}`}>
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
                    ? formatSegmentsForExport(segments)
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
                    ? formatSegmentsForExport(segments)
                    : transcript;
                  handleSave(`=== ТРАНСКРИПЦИЯ ===\n\n${text}${aiResults.full ? `\n\n=== AI АНАЛИЗ ===\n\n${aiResults.full}` : ''}`, getFilename('всё'));
                }}
                className="text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
                style={{ background: '#1a5c3a' }}
              >
                💾 Сохранить
              </button>
              <button
                onClick={() => { setTranscript(''); setSegments([]); setOverlaps([]); setDiarizationNotice(''); setAudioFile(null); setAiResults({ correct: null, tasks: null, keypoints: null, full: null }); setAgentContext(null); setTranscriptArchive(null); setTranscriptArchiveError(''); setTaskProposals([]); setProposalDrafts({}); setTranscriptTopic(''); setAnalysisSummary(''); setKeyKnowledge([]); setExtractionMetrics(null); setLastElapsed(null); const inp = document.getElementById('audioInput'); if (inp) inp.value = ''; }}
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
                {aiDisplayName}
              </span>
            </div>

            {agentContext && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900">
                <div className="font-semibold">
                  Контекст: {agentContext.detectedProject?.name || 'проект не определён'}
                </div>
                {agentContext.sources?.length > 0 && (
                  <div className="mt-1 text-green-700">
                    Использовано заметок: {agentContext.sources.length}
                  </div>
                )}
              </div>
            )}

            {(transcriptTopic || analysisSummary) && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                {transcriptTopic && (
                  <div className="font-semibold text-gray-900">Тема: {transcriptTopic}</div>
                )}
                {analysisSummary && (
                  <p className="text-sm text-gray-600 mt-1">{analysisSummary}</p>
                )}
              </div>
            )}

            {extractionMetrics && (
              <div className="mb-4 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Задач: {extractionMetrics.tasksTotal || 0}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Знаний: {extractionMetrics.knowledgeTotal || 0}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Числовых метрик: {extractionMetrics.metricsFound || 0}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  На проверку: {(extractionMetrics.needsConfirmation || 0) + (extractionMetrics.asrRisks || 0)}
                </span>
              </div>
            )}

            {/* Подсказка — нет ключа */}
            {aiProvider !== 'pi' && !apiKey && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="font-semibold text-blue-800 text-sm mb-2">
                  {piStatus?.installed ? 'Нужно войти в Pi' : 'Pi не найден — можно подключить резервный Groq'}
                </p>
                {piStatus?.installed ? (
                  <p className="text-xs text-blue-700 mb-3">
                    Откройте Pi в терминале и выполните <strong>/login → ChatGPT Plus/Pro (Codex)</strong>, затем перезапустите приложение.
                  </p>
                ) : (
                <ol className="text-xs text-blue-700 space-y-1 mb-3">
                  <li>1. Перейди на <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline font-medium">console.groq.com/keys</a></li>
                  <li>2. Зарегистрируйся (бесплатно, без карты)</li>
                  <li>3. Нажми <strong>Create API Key</strong> → скопируй</li>
                  <li>4. Вставь в <button onClick={() => setShowApiSettings(true)} className="underline font-medium">Настройки → AI Анализ</button></li>
                </ol>
                )}
                <button
                  onClick={() => setShowApiSettings(true)}
                  className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                  style={{ background: '#1a56db' }}
                >
                  Открыть настройки
                </button>
              </div>
            )}

            {/* Кнопка анализа */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => runAutoAnalysis(segments.length > 0 ? formatSegmentsForExport(segments) : transcript)}
                disabled={!!analyzing || (aiProvider === 'none' && !apiKey)}
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
              {AI_ACTIONS.filter(action => ['tasks', 'keypoints'].includes(action.key)).map(action => (
                <button
                  key={action.key}
                  onClick={() => handleAnalyze(action.key)}
                  disabled={!!analyzing || (aiProvider === 'none' && !apiKey)}
                  title={action.desc}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 border"
                  style={{ background: '#fff', color: '#0c3b26', borderColor: '#9dc6ae' }}
                >
                  {analyzing === action.key
                    ? `⏳ ${action.label}... ${analyzeElapsed > 0 ? `(${analyzeElapsed}с)` : ''}`
                    : `${action.icon} ${action.label}`}
                </button>
              ))}
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

            {AI_ACTIONS.filter(action => ['tasks', 'keypoints'].includes(action.key)).map(action => (
              aiResults[action.key] && (
                <div key={action.key} className="border border-gray-200 rounded-lg overflow-hidden mt-4">
                  <div className="px-4 py-2 flex justify-between items-center" style={{ background: '#eaf3ee' }}>
                    <span className="font-semibold text-sm" style={{ color: '#0c3b26' }}>
                      {action.icon} {action.label}
                    </span>
                    <button onClick={() => handleCopy(aiResults[action.key])} className="text-xs" style={{ color: '#1a5c3a' }}>
                      📋 Копировать
                    </button>
                  </div>
                  <div className="bg-gray-50 px-4 py-3">
                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{aiResults[action.key]}</p>
                  </div>
                </div>
              )
            ))}

            {keyKnowledge.length > 0 && (
              <div className="mt-5 border border-emerald-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-emerald-50">
                  <h3 className="font-semibold text-emerald-900">Ключевые знания</h3>
                  <p className="text-xs text-emerald-700 mt-1">
                    Производные выводы: источник и статус показаны для проверки.
                  </p>
                </div>
                <div className="p-4 space-y-3 bg-white">
                  {keyKnowledge.map((item, index) => (
                    <div key={`${item.timecode}-${index}`} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {KNOWLEDGE_KIND_LABELS[item.kind] || item.kind}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.status === 'direct'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {KNOWLEDGE_STATUS_LABELS[item.status] || item.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{item.statement}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {[item.speaker, item.timecode && `[${item.timecode}]`, item.evidence]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {taskProposals.length > 0 && (
              <div className="mt-5 border border-amber-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-amber-50">
                  <h3 className="font-semibold text-amber-900">Задачи для Obsidian</h3>
                  <p className="text-xs text-amber-700 mt-1">
                    Ничего не записывается без твоего подтверждения.
                  </p>
                </div>
                <div className="p-4 space-y-4 bg-white">
                  {taskProposals.map(proposal => {
                    const draft = proposalDrafts[proposal.id] || {
                      task: proposal.task,
                      projectId: proposal.projectId || '',
                      due: proposal.due || '',
                    };
                    const isPending = proposal.status === 'pending';
                    return (
                      <div key={proposal.id} className="rounded-lg border border-gray-200 p-3">
                        <input
                          value={draft.task}
                          onChange={(event) => updateProposalDraft(proposal.id, 'task', event.target.value)}
                          disabled={!isPending}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          <select
                            value={draft.projectId}
                            onChange={(event) => updateProposalDraft(proposal.id, 'projectId', event.target.value)}
                            disabled={!isPending}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-50"
                          >
                            <option value="">Выбрать проект</option>
                            {(obsidianStatus?.projects || []).map(project => (
                              <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={draft.due}
                            onChange={(event) => updateProposalDraft(proposal.id, 'due', event.target.value)}
                            disabled={!isPending}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
                          />
                        </div>
                        {(proposal.speaker || proposal.timecode || proposal.evidence) && (
                          <p className="text-xs text-gray-500 mt-2">
                            {[proposal.speaker, proposal.timecode && `[${proposal.timecode}]`, proposal.evidence]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                        {isPending ? (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => moderateProposal(proposal, 'approve')}
                              disabled={proposalBusy === proposal.id || !draft.projectId || !draft.task?.trim()}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                              style={{ background: '#0c3b26' }}
                            >
                              {proposalBusy === proposal.id ? 'Сохраняем...' : '✓ Записать задачу'}
                            </button>
                            <button
                              onClick={() => moderateProposal(proposal, 'reject')}
                              disabled={proposalBusy === proposal.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-600 disabled:opacity-50"
                            >
                              Отклонить
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 text-xs font-medium" style={{
                            color: proposal.status === 'approved' ? '#166534' : '#6b7280',
                          }}>
                            {proposal.status === 'approved' && `✓ Записано в ${proposal.taskFileRelative}`}
                            {proposal.status === 'duplicate' && 'Такая задача уже есть — дубль не создан'}
                            {proposal.status === 'rejected' && 'Отклонено'}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
              <h4 className="font-semibold text-gray-700 mb-3">👥 Разделение по спикерам · Community-1</h4>

              {/* Статус */}
              {diarizeStatus && (
                <div className="mb-4 space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{diarizeStatus.python ? '✅' : '❌'}</span>
                    <span className="text-gray-600">Python: {diarizeStatus.python ? diarizeStatus.python.split('\\').pop() : 'не найден'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{diarizeStatus.pyannote ? '✅' : '❌'}</span>
                    <span className="text-gray-600">Community-1 (pyannote.audio): {diarizeStatus.pyannote ? 'установлена' : 'не установлена'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{diarizeStatus.hfToken ? '✅' : '❌'}</span>
                    <span className="text-gray-600">HuggingFace токен: {diarizeStatus.hfToken ? 'сохранён' : 'не задан'}</span>
                  </div>
                  {diarizeStatus.ready && (
                    <div className="mt-2 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: '#eaf3ee', color: '#0c3b26' }}>
                      🎉 Диаризация Community-1 готова к работе
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
                    {diarizeInstalling ? '⏳ Устанавливаем...' : '⬇️ Установить Community-1'}
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

              {/* HuggingFace токен */}
              {diarizeStatus && !diarizeStatus.hfToken && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-1">
                    Нужен <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="underline text-blue-600">HuggingFace токен</a> (бесплатно) для загрузки модели диаризации
                  </p>
                  <input
                    type="password"
                    placeholder="hf_..."
                    value={hfTokenDraft}
                    onChange={e => setHfTokenDraft(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 mb-1"
                    style={{ borderColor: '#d1d5db' }}
                  />
                  <button
                    onClick={saveHfToken}
                    disabled={!hfTokenDraft.startsWith('hf_')}
                    className="px-4 py-1.5 text-sm text-white rounded-lg font-medium disabled:opacity-40"
                    style={{ background: '#0c3b26' }}
                  >
                    {hfTokenSaved ? '✅ Сохранён!' : 'Сохранить токен'}
                  </button>
                </div>
              )}
            </div>

            {/* Pi status + резервный API */}
            <div className="mb-6 border-t pt-5">
              <h4 className="font-semibold text-gray-700 mb-1">🤖 Pi Analysis Agent</h4>
              {piStatus && (
                <div className="text-xs mb-4 rounded-lg px-3 py-2" style={{ background: piStatus.available && piStatus.authConfigured ? '#eaf3ee' : '#fff7ed', color: '#374151' }}>
                  <div>{piStatus.available ? '✅' : '❌'} Pi Coding Agent {piStatus.version || ''}</div>
                  <div>{piStatus.authConfigured ? '✅ Авторизация ChatGPT найдена' : '⚠️ Требуется /login → ChatGPT Plus/Pro (Codex)'}</div>
                  <div>Модель: {piStatus.provider || 'openai-codex'}/{piStatus.model || 'gpt-5.6-sol'} · thinking {piStatus.thinking || 'high'}</div>
                </div>
              )}
              <h5 className="font-medium text-gray-600 mb-1">Резервный API (необязательно)</h5>
              <p className="text-xs text-gray-500 mb-3">
                Используется только если Pi не установлен. Ключ Groq: <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="underline text-blue-600">console.groq.com/keys</a>
              </p>
              <input
                type="password"
                placeholder="gsk_..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2"
                style={{ borderColor: '#d1d5db' }}
              />
              <button
                onClick={() => {
                  localStorage.setItem('apiKey', apiKey);
                  localStorage.setItem('apiEndpoint', 'https://api.groq.com/openai/v1');
                  localStorage.setItem('apiModel', 'llama-3.3-70b-versatile');
                  setApiEndpoint('https://api.groq.com/openai/v1');
                  setApiModel('llama-3.3-70b-versatile');
                  setShowApiSettings(false);
                }}
                className="mt-2 px-4 py-2 text-sm text-white rounded-lg font-medium"
                style={{ background: '#0c3b26' }}
              >
                Сохранить ключ
              </button>
              {apiKey && <p className="text-xs text-green-600 mt-1">✅ Ключ сохранён</p>}
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
