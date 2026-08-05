const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { getDefaultIndex } = require('./obsidianIndex');

function cleanText(value, maxLength = 500) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeTask(value) {
  return cleanText(value, 1000)
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/gu, '')
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function normalizeDue(value) {
  if (!value) return null;
  const due = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return null;
  const parsed = new Date(`${due}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : due;
}

class TaskProposalStore {
  constructor(options = {}) {
    this.index = options.index || getDefaultIndex();
    this.proposals = new Map();
  }

  register(rawTasks, metadata = {}) {
    const tasks = Array.isArray(rawTasks) ? rawTasks : [];
    const fallbackProject = this.index.getProject(metadata.detectedProject)
      ? metadata.detectedProject
      : null;

    return tasks.slice(0, 50).map(raw => {
      const task = cleanText(raw?.task, 500);
      if (!task) return null;
      const requestedProject = cleanText(raw?.project, 300);
      const projectId = this.index.getProject(requestedProject)
        ? requestedProject
        : fallbackProject;
      const proposal = {
        id: crypto.randomUUID(),
        status: 'pending',
        task,
        outcome: cleanText(raw?.outcome, 500) || null,
        whyKey: cleanText(raw?.why_key, 500) || null,
        isKey: raw?.is_key === true
          || String(raw?.is_key || '').toLocaleLowerCase('ru-RU') === 'true',
        importance: Number.isFinite(Number(raw?.importance))
          ? Math.max(0, Math.min(1, Number(raw.importance) > 1
            ? Number(raw.importance) / 100
            : Number(raw.importance)))
          : null,
        projectId,
        owner: cleanText(raw?.owner, 120) || null,
        due: normalizeDue(raw?.due),
        type: cleanText(raw?.type, 120) || null,
        speaker: cleanText(raw?.speaker, 120) || null,
        timecode: cleanText(raw?.timecode, 40) || null,
        evidence: cleanText(raw?.evidence, 500) || null,
        confidence: Number.isFinite(Number(raw?.confidence))
          ? Math.max(0, Math.min(1, Number(raw.confidence)))
          : null,
        sourceFilename: cleanText(metadata.sourceFilename, 250) || null,
        transcriptNoteRelative: cleanText(metadata.transcriptNoteRelative, 500) || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.proposals.set(proposal.id, proposal);
      return { ...proposal };
    }).filter(Boolean);
  }

  list(status) {
    return [...this.proposals.values()]
      .filter(proposal => !status || proposal.status === status)
      .map(proposal => ({ ...proposal }));
  }

  get(id) {
    const proposal = this.proposals.get(id);
    return proposal ? { ...proposal } : null;
  }

  reject(id) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw Object.assign(new Error('Предложение не найдено'), { status: 404 });
    if (proposal.status !== 'pending') return { ...proposal };
    proposal.status = 'rejected';
    proposal.updatedAt = new Date().toISOString();
    return { ...proposal };
  }

  approve(id, edits = {}) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw Object.assign(new Error('Предложение не найдено'), { status: 404 });
    if (proposal.status !== 'pending') return { ...proposal };

    const task = cleanText(edits.task || proposal.task, 500);
    const projectId = cleanText(edits.projectId || proposal.projectId, 300);
    const due = normalizeDue(edits.due !== undefined ? edits.due : proposal.due);
    if (!task) throw Object.assign(new Error('Задача не может быть пустой'), { status: 400 });

    const project = this.index.getProject(projectId);
    if (!project) {
      throw Object.assign(new Error('Выберите существующий проект Obsidian'), { status: 400 });
    }

    const vaultRoot = `${path.resolve(this.index.vaultPath)}${path.sep}`.toLocaleLowerCase('ru-RU');
    const resolvedTaskFile = path.resolve(project.taskFile);
    if (!resolvedTaskFile.toLocaleLowerCase('ru-RU').startsWith(vaultRoot)) {
      throw Object.assign(new Error('Недопустимый путь файла задач'), { status: 400 });
    }

    const currentContent = fs.readFileSync(resolvedTaskFile, 'utf8');
    const normalized = normalizeTask(task);
    const duplicate = currentContent
      .split(/\r?\n/)
      .map(line => line.match(/^\s*-\s*\[[ xX]\]\s+(.+?)\s*$/))
      .filter(Boolean)
      .some(match => normalizeTask(match[1]) === normalized);

    proposal.task = task;
    proposal.projectId = projectId;
    proposal.due = due;
    proposal.updatedAt = new Date().toISOString();

    if (duplicate) {
      proposal.status = 'duplicate';
      return { ...proposal };
    }

    const taskLine = `- [ ] ${task}${due ? ` 📅 ${due}` : ''}`;
    const sourceParts = [
      proposal.sourceFilename ? `транскрипция «${proposal.sourceFilename}»` : 'транскрипция',
      proposal.speaker,
      proposal.timecode ? `[${proposal.timecode.replace(/^\[|\]$/g, '')}]` : null,
    ].filter(Boolean);
    const sourceLine = `  - Источник: ${sourceParts.join(' · ')}`;
    const transcriptLink = proposal.transcriptNoteRelative
      ? `  - Транскрипция: [[${proposal.transcriptNoteRelative.replace(/\.md$/iu, '')}]]`
      : null;
    const prefix = currentContent.length > 0 && !currentContent.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(
      resolvedTaskFile,
      `${prefix}${taskLine}\n${sourceLine}\n${transcriptLink ? `${transcriptLink}\n` : ''}`,
      'utf8'
    );

    proposal.status = 'approved';
    proposal.taskFileRelative = project.taskFileRelative;
    this.index.refresh();
    return { ...proposal };
  }
}

let defaultStore = null;

function createTaskProposalStore(options) {
  return new TaskProposalStore(options);
}

function getDefaultProposalStore() {
  if (!defaultStore) defaultStore = createTaskProposalStore();
  return defaultStore;
}

module.exports = {
  TaskProposalStore,
  cleanText,
  createTaskProposalStore,
  getDefaultProposalStore,
  normalizeDue,
  normalizeTask,
};
