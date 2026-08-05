const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createObsidianIndex } = require('./src/services/obsidianIndex');
const { createTaskProposalStore } = require('./src/services/taskProposalStore');

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'task-proposals-'));
const projectDir = path.join(fixture, 'Проект - аренда');
const taskFile = path.join(projectDir, '!Задачи.md');
fs.mkdirSync(projectDir, { recursive: true });
fs.writeFileSync(taskFile, '# Задачи\n', 'utf8');

const index = createObsidianIndex({ vaultPath: fixture });
index.refresh();
const store = createTaskProposalStore({ index });
const [proposal] = store.register([{
  task: 'Позвонить арендатору',
  outcome: 'Время презентации подтверждено',
  why_key: 'Это следующий этап сделки',
  is_key: true,
  importance: 0.86,
  project: 'Проект - аренда',
  due: '2026-08-01',
  speaker: 'Собеседник 1',
  timecode: '00:10-00:20',
}], { sourceFilename: 'встреча.m4a' });

assert.equal(proposal.outcome, 'Время презентации подтверждено');
assert.equal(proposal.whyKey, 'Это следующий этап сделки');
assert.equal(proposal.isKey, true);
assert.equal(proposal.importance, 0.86);
const approved = store.approve(proposal.id);
assert.equal(approved.status, 'approved');
const written = fs.readFileSync(taskFile, 'utf8');
assert(written.includes('- [ ] Позвонить арендатору 📅 2026-08-01'));
assert(written.includes('транскрипция «встреча.m4a»'));

const [duplicate] = store.register([{ task: 'Позвонить арендатору' }], {
  detectedProject: 'Проект - аренда',
});
assert.equal(store.approve(duplicate.id).status, 'duplicate');

const beforeReject = fs.readFileSync(taskFile, 'utf8');
const [rejected] = store.register([{ task: 'Удалить всё' }], {
  detectedProject: 'Проект - аренда',
});
assert.equal(store.reject(rejected.id).status, 'rejected');
assert.equal(fs.readFileSync(taskFile, 'utf8'), beforeReject);

fs.rmSync(fixture, { recursive: true, force: true });
console.log('task proposal tests: OK');
