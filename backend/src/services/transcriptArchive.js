const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { getDefaultIndex, normalizeRelative } = require('./obsidianIndex');

function safeFilename(value) {
  const withoutExtension = path.basename(String(value || 'Транскрипция'))
    .replace(/\.[^.]+$/u, '');
  const cleaned = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/u, '')
    .trim();
  return (cleaned || 'Транскрипция').slice(0, 100);
}

function safeTopic(value) {
  const cleaned = String(value || '')
    .replace(/(?:транскрипц(?:ия|ии)|аудиозапись|запись|встреча)\s*/giu, '')
    .replace(/\b(?:новая|номер|№)\s*\d*\b/giu, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, ' ')
    .replace(/[—–_-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/u, '')
    .trim();
  const words = cleaned.split(' ').filter(Boolean).slice(0, 7);
  return (words.join(' ') || 'Содержание разговора').slice(0, 100);
}

function cleanDerivedText(value, maxLength = 900) {
  return String(value || '')
    .replace(/<!--|-->/gu, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function yamlString(value) {
  return JSON.stringify(String(value || ''));
}

function transcriptHash(transcript) {
  return crypto
    .createHash('sha256')
    .update(String(transcript || '').replace(/\r\n/g, '\n').trim(), 'utf8')
    .digest('hex')
    .slice(0, 12);
}

function localDateParts(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}-${pad(date.getMinutes())}`,
  };
}

function findTranscriptByHash(directory, hash) {
  if (!fs.existsSync(directory)) return null;
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        try {
          const head = fs.readFileSync(absolutePath, 'utf8').slice(0, 2500);
          if (head.includes(`content_hash: "${hash}"`)
            || head.includes(`content_hash: ${hash}`)) {
            return absolutePath;
          }
        } catch {}
      }
    }
  }
  return null;
}

function createTranscriptArchive(options = {}) {
  const index = options.index || getDefaultIndex();

  function getArchiveDirectory(project) {
    if (!project) return 'Транскрипции/Неразобранное';
    const base = normalizeRelative(path.posix.join(project.id, 'Транскрипции'));
    const rawAbsolute = path.resolve(index.vaultPath, ...`${base}/Raw`.split('/'));
    return fs.existsSync(rawAbsolute) ? `${base}/Raw` : base;
  }

  function assertInsideVault(absolutePath) {
    const vaultRoot = `${path.resolve(index.vaultPath)}${path.sep}`.toLocaleLowerCase('ru-RU');
    const resolved = path.resolve(absolutePath);
    if (!resolved.toLocaleLowerCase('ru-RU').startsWith(vaultRoot)) {
      throw Object.assign(new Error('Недопустимый путь архива транскрипций'), { status: 400 });
    }
    return resolved;
  }

  function save({ transcript, projectId, sourceFilename, model, speakersCount }) {
    const text = String(transcript || '').trim();
    if (!text) throw Object.assign(new Error('Пустую транскрипцию нельзя сохранить'), { status: 400 });
    index.ensureFresh();

    const project = projectId ? index.getProject(projectId) : null;
    const relativeDirectory = getArchiveDirectory(project);
    const absoluteDirectory = assertInsideVault(
      path.resolve(index.vaultPath, ...relativeDirectory.split('/'))
    );

    fs.mkdirSync(absoluteDirectory, { recursive: true });
    const hash = transcriptHash(text);
    const transcriptRoot = project
      ? path.resolve(index.vaultPath, ...`${project.id}/Транскрипции`.split('/'))
      : absoluteDirectory;
    const existingPath = findTranscriptByHash(transcriptRoot, hash);
    if (existingPath) {
      return {
        saved: true,
        duplicate: true,
        projectId: project?.id || null,
        relativePath: normalizeRelative(path.relative(index.vaultPath, existingPath)),
        hash,
      };
    }

    const now = new Date();
    const { date, time } = localDateParts(now);
    const fileName = `${date} ${time} — Обработка транскрипции — ${hash}.md`;
    const absolutePath = path.join(absoluteDirectory, fileName);
    const relativePath = normalizeRelative(path.join(relativeDirectory, fileName));
    const metadata = [
      '---',
      'type: transcript',
      'knowledge_status: canonical-source',
      `project: ${yamlString(project?.name || 'Неразобранное')}`,
      `source_file: ${yamlString(sourceFilename || '')}`,
      `created: ${yamlString(now.toISOString())}`,
      `transcription_model: ${yamlString(model || 'GigaAM v3 RNNT')}`,
      `speakers_count: ${Number.isFinite(Number(speakersCount)) ? Number(speakersCount) : 'null'}`,
      `content_hash: ${yamlString(hash)}`,
      'analysis_status: pending',
      '---',
      '',
      '# Транскрипция — ожидает AI-название',
      '',
      `> Канонический текст разговора. Проект: ${project?.name || 'не определён'}.`,
      '',
      '## Полная транскрипция',
      '',
      text,
      '',
    ].join('\n');

    fs.writeFileSync(absolutePath, metadata, { encoding: 'utf8', flag: 'wx' });
    return {
      saved: true,
      duplicate: false,
      projectId: project?.id || null,
      relativePath,
      hash,
    };
  }

  function enrich({
    relativePath,
    hash,
    projectId,
    topic,
    summary,
    knowledge,
    extractionMetrics,
  }) {
    index.ensureFresh();
    const project = projectId ? index.getProject(projectId) : null;
    let absolutePath = relativePath
      ? assertInsideVault(path.resolve(index.vaultPath, ...normalizeRelative(relativePath).split('/')))
      : null;
    const transcriptRoot = project
      ? path.resolve(index.vaultPath, ...`${project.id}/Транскрипции`.split('/'))
      : path.resolve(index.vaultPath, 'Транскрипции');
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      absolutePath = findTranscriptByHash(transcriptRoot, hash);
    }
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      throw Object.assign(new Error('Сохранённая транскрипция не найдена'), { status: 404 });
    }

    const cleanTopic = safeTopic(topic);
    const items = Array.isArray(knowledge) ? knowledge : [];
    let content = fs.readFileSync(absolutePath, 'utf8');
    const sourceMarker = '## Полная транскрипция';
    const sourceIndex = content.indexOf(sourceMarker);
    if (sourceIndex < 0) throw new Error('В заметке отсутствует полный транскрипт');
    const immutableTranscript = content.slice(sourceIndex);

    content = content
      .replace(/<!-- AI_DERIVED_START -->[\s\S]*?<!-- AI_DERIVED_END -->\s*/gu, '')
      .replace(/^topic:.*$/mu, '')
      .replace(/^analysis_status:.*$/mu, '')
      .replace(/^knowledge_count:.*$/mu, '')
      .replace(/^# Транскрипция — .*$/mu, `# Транскрипция — ${cleanTopic}`);
    content = content.replace(
      /^content_hash:.*$/mu,
      match => `${match}\ntopic: ${yamlString(cleanTopic)}\nanalysis_status: extracted\nknowledge_count: ${items.length}`
    );

    const kindLabels = {
      fact: 'Факт',
      metric: 'Метрика',
      decision: 'Решение',
      principle: 'Принцип',
      process: 'Процесс',
      script: 'Скрипт',
      risk: 'Риск',
      open_question: 'Открытый вопрос',
    };
    const statusLabels = {
      direct: 'прямо сказано',
      inferred: 'следует из контекста',
      needs_confirmation: 'требует подтверждения',
      asr_risk: 'ASR-риск',
    };
    const knowledgeLines = items.length > 0
      ? items.map(item => [
          `- **${kindLabels[item.kind] || 'Знание'} · ${statusLabels[item.status] || 'требует подтверждения'}** — ${cleanDerivedText(item.statement)}`,
          `  - Источник: ${cleanDerivedText(item.speaker || 'Речь', 120)} [${cleanDerivedText(item.timecode, 50)}] — «${cleanDerivedText(item.evidence, 500)}»`,
          `  - Новизна: ${cleanDerivedText(item.novelty || 'unknown', 60)} · маршрут: ${cleanDerivedText(item.target || 'transcript', 80)}`,
        ].join('\n')).join('\n')
      : '- Существенные знания не извлечены.';
    const metrics = extractionMetrics || {};
    const derivedBlock = [
      '<!-- AI_DERIVED_START -->',
      '## AI-разбор',
      '',
      '> Производный слой: проверять по тайм-кодам. Полный транскрипт ниже не изменяется.',
      '',
      '### Краткое содержание',
      '',
      cleanDerivedText(summary || 'Краткое содержание не сформировано.', 1500),
      '',
      '### Ключевые знания',
      '',
      knowledgeLines,
      '',
      '### Контроль извлечения',
      '',
      `- Задач: ${Number(metrics.tasksTotal) || 0}; с источником: ${Number(metrics.tasksGrounded) || 0}.`,
      `- Знаний: ${Number(metrics.knowledgeTotal) || items.length}; с источником: ${Number(metrics.knowledgeGrounded) || items.length}.`,
      `- Требуют подтверждения: ${Number(metrics.needsConfirmation) || 0}; ASR-рисков: ${Number(metrics.asrRisks) || 0}; конфликтов: ${Number(metrics.conflicts) || 0}.`,
      '<!-- AI_DERIVED_END -->',
      '',
    ].join('\n');
    const beforeSource = content.slice(0, content.indexOf(sourceMarker)).trimEnd();
    const updatedContent = `${beforeSource}\n\n${derivedBlock}\n${immutableTranscript}`;
    fs.writeFileSync(absolutePath, updatedContent, 'utf8');

    const createdMatch = updatedContent.match(/^created:\s*"([^"]+)"/mu);
    const createdAt = createdMatch ? new Date(createdMatch[1]) : new Date();
    const { date } = localDateParts(Number.isNaN(createdAt.getTime()) ? new Date() : createdAt);
    const targetRelativeDirectory = getArchiveDirectory(project);
    const targetDirectory = assertInsideVault(
      path.resolve(index.vaultPath, ...targetRelativeDirectory.split('/'))
    );
    fs.mkdirSync(targetDirectory, { recursive: true });
    let targetName = `${date} — ${cleanTopic}.md`;
    let targetPath = path.join(targetDirectory, targetName);
    let suffix = 2;
    while (fs.existsSync(targetPath) && path.resolve(targetPath) !== path.resolve(absolutePath)) {
      const existing = fs.readFileSync(targetPath, 'utf8').slice(0, 2500);
      if (hash && existing.includes(`content_hash: "${hash}"`)) break;
      targetName = `${date} — ${cleanTopic} — ${suffix}.md`;
      targetPath = path.join(targetDirectory, targetName);
      suffix += 1;
    }
    if (path.resolve(targetPath) !== path.resolve(absolutePath)) {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(absolutePath);
      } else {
        fs.renameSync(absolutePath, targetPath);
      }
    }
    index.refresh();
    return {
      saved: true,
      duplicate: false,
      enriched: true,
      projectId: project?.id || null,
      relativePath: normalizeRelative(path.relative(index.vaultPath, targetPath)),
      hash,
      topic: cleanTopic,
    };
  }

  return { enrich, save };
}

let defaultArchive = null;

function getDefaultTranscriptArchive() {
  if (!defaultArchive) defaultArchive = createTranscriptArchive();
  return defaultArchive;
}

module.exports = {
  createTranscriptArchive,
  getDefaultTranscriptArchive,
  localDateParts,
  safeTopic,
  safeFilename,
  transcriptHash,
};
