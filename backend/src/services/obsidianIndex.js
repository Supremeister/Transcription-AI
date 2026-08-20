const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_VAULT_PATH = path.join(
  os.homedir(),
  'Yandex.Disk',
  'Base'
);

const DEFAULT_GLOBAL_FILES = [
  '00 Главная.md',
  'Задачи - единый центр.md',
  '_codex/profile.md',
  '_codex/context.md',
];

const IGNORED_DIR_NAMES = new Set([
  '.git',
  '.obsidian',
  '.trash',
  'node_modules',
  'backups',
  'backup',
  'archive',
  'archives',
  'sessions',
]);

const STOP_WORDS = new Set([
  'это', 'как', 'для', 'что', 'все', 'всё', 'его', 'она', 'они', 'мы', 'вы',
  'мне', 'меня', 'тебе', 'тебя', 'мой', 'моя', 'мои', 'наш', 'наша', 'ваш',
  'уже', 'еще', 'ещё', 'тут', 'там', 'так', 'вот', 'или', 'при', 'над', 'под',
  'без', 'про', 'из', 'на', 'по', 'до', 'от', 'за', 'во', 'со', 'же', 'бы',
  'то', 'не', 'да', 'нет', 'ну', 'если', 'когда', 'который', 'которая',
  'которые', 'можно', 'нужно', 'будет', 'есть', 'был', 'была', 'были',
  'сейчас', 'потом', 'просто', 'очень', 'тоже', 'также', 'чтобы',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'you', 'your',
]);

function normalizeRelative(relativePath) {
  return String(relativePath || '').split(path.sep).join('/');
}

function tokenize(value, maxUnique = 180) {
  const matches = String(value || '')
    .toLocaleLowerCase('ru-RU')
    .match(/[a-zа-яё0-9][a-zа-яё0-9_-]{2,}/giu) || [];
  const frequencies = new Map();
  for (const token of matches) {
    if (STOP_WORDS.has(token)) continue;
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }
  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxUnique)
    .map(([token]) => token);
}

function countOccurrences(haystack, needle, cap = 6) {
  let count = 0;
  let offset = 0;
  while (count < cap) {
    const index = haystack.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

function isIgnoredDirectory(name, relativePath) {
  const lowered = String(name || '').toLocaleLowerCase('ru-RU');
  if (IGNORED_DIR_NAMES.has(lowered)) return true;
  const normalized = normalizeRelative(relativePath).toLocaleLowerCase('ru-RU');
  return normalized.startsWith('_codex/backups/')
    || normalized.startsWith('_codex/archive/')
    || normalized.startsWith('_codex/sessions/');
}

class ObsidianIndex {
  constructor(options = {}) {
    this.vaultPath = path.resolve(
      options.vaultPath
      || process.env.OBSIDIAN_VAULT_PATH
      || DEFAULT_VAULT_PATH
    );
    this.refreshAfterMs = Number(options.refreshAfterMs) || 60_000;
    this.documents = [];
    this.documentsByPath = new Map();
    this.projects = [];
    this.projectsById = new Map();
    this.lastIndexedAt = null;
  }

  scanMarkdownFiles() {
    const files = [];
    const walk = (directory, relativeDirectory = '') => {
      let entries = [];
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const relativePath = relativeDirectory
          ? path.join(relativeDirectory, entry.name)
          : entry.name;
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!isIgnoredDirectory(entry.name, relativePath)) {
            walk(absolutePath, relativePath);
          }
          continue;
        }
        if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
          files.push({ absolutePath, relativePath: normalizeRelative(relativePath) });
        }
      }
    };

    if (fs.existsSync(this.vaultPath)) walk(this.vaultPath);
    return files;
  }

  refresh() {
    const files = this.scanMarkdownFiles();
    const taskFiles = files.filter(file =>
      path.basename(file.absolutePath).toLocaleLowerCase('ru-RU') === '!задачи.md'
    );

    this.projects = taskFiles.map(file => {
      const directory = normalizeRelative(path.posix.dirname(file.relativePath));
      const id = directory === '.' ? '__root__' : directory;
      return {
        id,
        name: id === '__root__' ? 'Общие задачи' : directory,
        taskFile: file.absolutePath,
        taskFileRelative: file.relativePath,
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    this.projectsById = new Map(this.projects.map(project => [project.id, project]));

    this.documents = [];
    this.documentsByPath = new Map();
    for (const file of files) {
      try {
        const stat = fs.statSync(file.absolutePath);
        if (stat.size > 1_500_000) continue;
        const content = fs.readFileSync(file.absolutePath, 'utf8');
        const pathLower = file.relativePath.toLocaleLowerCase('ru-RU');
        const matchingProjects = this.projects
          .filter(project => project.id !== '__root__'
            && (file.relativePath === project.taskFileRelative
              || pathLower.startsWith(`${project.id.toLocaleLowerCase('ru-RU')}/`)))
          .sort((a, b) => b.id.length - a.id.length);
        const projectId = matchingProjects[0]?.id || null;
        const title = path.basename(file.relativePath, path.extname(file.relativePath));
        const document = {
          absolutePath: file.absolutePath,
          relativePath: file.relativePath,
          title,
          projectId,
          mtimeMs: stat.mtimeMs,
          content,
          titleLower: title.toLocaleLowerCase('ru-RU'),
          pathLower,
          contentLower: content.toLocaleLowerCase('ru-RU'),
        };
        this.documents.push(document);
        this.documentsByPath.set(file.relativePath, document);
      } catch {
        // Один временно заблокированный файл не должен ломать весь индекс.
      }
    }

    this.lastIndexedAt = new Date();
    return this.health();
  }

  ensureFresh() {
    if (!this.lastIndexedAt
      || Date.now() - this.lastIndexedAt.getTime() > this.refreshAfterMs) {
      this.refresh();
    }
    return this;
  }

  health() {
    return {
      connected: fs.existsSync(this.vaultPath),
      vaultPath: this.vaultPath,
      documentsCount: this.documents.length,
      projectsCount: this.projects.length,
      lastIndexedAt: this.lastIndexedAt?.toISOString() || null,
    };
  }

  listProjects() {
    this.ensureFresh();
    return this.projects.map(({ id, name, taskFileRelative }) => ({
      id,
      name,
      taskFileRelative,
    }));
  }

  getProject(projectId) {
    this.ensureFresh();
    return this.projectsById.get(projectId) || null;
  }

  getDocument(relativePath) {
    this.ensureFresh();
    return this.documentsByPath.get(normalizeRelative(relativePath)) || null;
  }

  getGlobalDocuments() {
    this.ensureFresh();
    return DEFAULT_GLOBAL_FILES
      .map(relativePath => this.getDocument(relativePath))
      .filter(Boolean);
  }

  getOpenTasks(projectId) {
    const project = this.getProject(projectId);
    if (!project) return [];
    const document = this.getDocument(project.taskFileRelative);
    if (!document) return [];
    return document.content
      .split(/\r?\n/)
      .map(line => line.match(/^\s*-\s*\[\s\]\s+(.+?)\s*$/))
      .filter(Boolean)
      .map(match => match[1]);
  }

  search(query, options = {}) {
    this.ensureFresh();
    const terms = tokenize(query);
    if (terms.length === 0) return [];
    const projectId = options.projectId || null;
    const limit = Math.max(1, Math.min(Number(options.limit) || 10, 50));

    return this.documents
      .filter(document => !projectId || document.projectId === projectId)
      .map(document => {
        let score = 0;
        const matchedTerms = [];
        for (const term of terms) {
          let termScore = 0;
          if (document.titleLower.includes(term)) termScore += 12;
          if (document.pathLower.includes(term)) termScore += 7;
          termScore += countOccurrences(document.contentLower, term) * 1.5;
          if (termScore > 0) {
            score += termScore;
            matchedTerms.push(term);
          }
        }
        if (document.relativePath.endsWith('/!Задачи.md')) score += 1;
        return { document, score, matchedTerms };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || b.document.mtimeMs - a.document.mtimeMs)
      .slice(0, limit);
  }
}

let defaultIndex = null;

function createObsidianIndex(options) {
  return new ObsidianIndex(options);
}

function getDefaultIndex() {
  if (!defaultIndex) defaultIndex = createObsidianIndex();
  return defaultIndex;
}

module.exports = {
  DEFAULT_GLOBAL_FILES,
  ObsidianIndex,
  createObsidianIndex,
  getDefaultIndex,
  normalizeRelative,
  tokenize,
};
