const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createObsidianIndex } = require('./src/services/obsidianIndex');
const { createTranscriptArchive } = require('./src/services/transcriptArchive');

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'transcript-archive-'));
const projectDir = path.join(fixture, 'Проект - аренда');
fs.mkdirSync(projectDir, { recursive: true });
fs.mkdirSync(path.join(projectDir, 'Транскрипции', 'Raw'), { recursive: true });
fs.writeFileSync(path.join(projectDir, '!Задачи.md'), '# Задачи\n', 'utf8');

const index = createObsidianIndex({ vaultPath: fixture });
index.refresh();
const archive = createTranscriptArchive({ index });
const first = archive.save({
  transcript: 'Собеседник 1 [00:00-00:04]\nОбсудили арендатора.',
  projectId: 'Проект - аренда',
  sourceFilename: 'Встреча 30.07.m4a',
  speakersCount: 2,
});
assert.equal(first.duplicate, false);
assert(first.relativePath.startsWith('Проект - аренда/Транскрипции/Raw/'));
assert(fs.existsSync(path.join(fixture, ...first.relativePath.split('/'))));
assert(!first.relativePath.includes('Встреча 30.07'));

const originalPath = path.join(fixture, ...first.relativePath.split('/'));
const originalContent = fs.readFileSync(originalPath, 'utf8');
const sourceBefore = originalContent.split('## Полная транскрипция')[1];
const createdAt = new Date(originalContent.match(/^created:\s*"([^"]+)"/mu)[1]);
const expectedDate = [
  createdAt.getFullYear(),
  String(createdAt.getMonth() + 1).padStart(2, '0'),
  String(createdAt.getDate()).padStart(2, '0'),
].join('-');
const enriched = archive.enrich({
  ...first,
  topic: 'Условия работы с арендатором',
  summary: 'Обсуждены условия дальнейшей работы.',
  knowledge: [{
    statement: 'Нужно позвонить арендатору.',
    kind: 'decision',
    status: 'direct',
    novelty: 'new',
    target: 'project_note',
    speaker: 'Собеседник 1',
    timecode: '00:00-00:04',
    evidence: 'Обсудили арендатора',
  }],
  extractionMetrics: {
    tasksTotal: 1,
    tasksGrounded: 1,
    knowledgeTotal: 1,
    knowledgeGrounded: 1,
  },
});
assert.equal(
  enriched.relativePath,
  `Проект - аренда/Транскрипции/Raw/${expectedDate} — Условия работы с арендатором.md`
);
const enrichedPath = path.join(fixture, ...enriched.relativePath.split('/'));
const enrichedContent = fs.readFileSync(enrichedPath, 'utf8');
assert(enrichedContent.includes('## AI-разбор'));
assert(enrichedContent.includes('**Решение · прямо сказано**'));
assert.equal(enrichedContent.split('## Полная транскрипция')[1], sourceBefore);

archive.enrich({
  ...enriched,
  topic: 'Условия работы с арендатором',
  summary: 'Обсуждены условия дальнейшей работы.',
  knowledge: [],
  extractionMetrics: {},
});
const twiceEnriched = fs.readFileSync(enrichedPath, 'utf8');
assert.equal((twiceEnriched.match(/<!-- AI_DERIVED_START -->/g) || []).length, 1);

const second = archive.save({
  transcript: 'Собеседник 1 [00:00-00:04]\nОбсудили арендатора.',
  projectId: 'Проект - аренда',
  sourceFilename: 'Встреча 30.07.m4a',
});
assert.equal(second.duplicate, true);
assert.equal(second.relativePath, enriched.relativePath);

const unsorted = archive.save({
  transcript: 'Текст без определённого проекта.',
  sourceFilename: 'Без проекта.wav',
});
assert(unsorted.relativePath.startsWith('Транскрипции/Неразобранное/'));

fs.rmSync(fixture, { recursive: true, force: true });
console.log('transcript archive tests: OK');
