const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createObsidianIndex } = require('./src/services/obsidianIndex');

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'obsidian-index-'));
const projectDir = path.join(fixture, 'Проект - аренда');
fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(path.join(fixture, '00 Главная.md'), '# Главная\nМой рабочий контекст', 'utf8');
fs.writeFileSync(path.join(projectDir, '!Задачи.md'), '# Задачи\n- [ ] Позвонить арендатору', 'utf8');
fs.writeFileSync(path.join(projectDir, 'Объект Ленина.md'), '# Объект\nДоходность аренды на Ленина', 'utf8');

const index = createObsidianIndex({ vaultPath: fixture, refreshAfterMs: 60_000 });
const health = index.refresh();
assert.equal(health.documentsCount, 3);
assert.equal(health.projectsCount, 1);
assert.equal(index.listProjects()[0].id, 'Проект - аренда');
assert.deepEqual(index.getOpenTasks('Проект - аренда'), ['Позвонить арендатору']);
assert.equal(
  index.search('обсудили доходность объекта на Ленина', { limit: 1 })[0].document.title,
  'Объект Ленина'
);

fs.rmSync(fixture, { recursive: true, force: true });
console.log('obsidian index tests: OK');
