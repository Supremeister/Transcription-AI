const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createObsidianIndex } = require('./src/services/obsidianIndex');
const { buildContextPack } = require('./src/services/obsidianContext');

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'obsidian-context-'));
for (const project of ['Проект - аренда', 'Проект - крипта']) {
  fs.mkdirSync(path.join(fixture, project), { recursive: true });
  fs.writeFileSync(path.join(fixture, project, '!Задачи.md'), '# Задачи\n', 'utf8');
}
fs.mkdirSync(path.join(fixture, '_codex'), { recursive: true });
fs.writeFileSync(path.join(fixture, '_codex', 'profile.md'), 'Миша ведёт проекты', 'utf8');
fs.writeFileSync(
  path.join(fixture, 'Проект - аренда', 'Ленина.md'),
  'Объект на Ленина, арендатор и доходность',
  'utf8'
);
fs.mkdirSync(path.join(fixture, 'Проект - аренда', 'Транскрипции'), { recursive: true });
fs.mkdirSync(path.join(fixture, 'Проект - аренда', 'Скрипты'), { recursive: true });
fs.writeFileSync(
  path.join(fixture, 'Проект - аренда', 'Транскрипции', '00 Протокол обработки транскрипций.md'),
  'Протокол анализа. [[Проект - аренда/Метрики]] [[Проект - аренда/Скрипты/Стандарт]]',
  'utf8'
);
fs.writeFileSync(
  path.join(fixture, 'Проект - аренда', 'Метрики.md'),
  'Норматив: пять касаний.',
  'utf8'
);
fs.writeFileSync(
  path.join(fixture, 'Проект - аренда', 'Скрипты', 'Стандарт.md'),
  'Стандарт разговора с арендатором.',
  'utf8'
);
fs.writeFileSync(
  path.join(fixture, 'Проект - крипта', 'BTC.md'),
  'Биткоин и криптовалютный портфель',
  'utf8'
);

const index = createObsidianIndex({ vaultPath: fixture });
index.refresh();
const pack = buildContextPack(
  'Обсудили арендатора и доходность объекта на Ленина',
  { index }
);
assert.equal(pack.detectedProject.id, 'Проект - аренда');
assert(pack.sources.includes('Проект - аренда/!Задачи.md'));
assert(pack.sources.includes('Проект - аренда/Ленина.md'));
assert(pack.sources.includes('Проект - аренда/Транскрипции/00 Протокол обработки транскрипций.md'));
assert(pack.sources.includes('Проект - аренда/Метрики.md'));
assert(pack.sources.includes('Проект - аренда/Скрипты/Стандарт.md'));
assert(!pack.sources.includes('Проект - крипта/BTC.md'));

fs.rmSync(fixture, { recursive: true, force: true });
console.log('obsidian context tests: OK');
