const assert = require('assert');
const analyzeRouter = require('./src/routes/analyze');

const {
  KEY_TASK_RULES,
  PI_ANALYSIS_RULES,
  PROMPTS,
  buildPiPrompt,
  buildFallbackPrompt,
  parseTranscriptMeta,
  parseTaskProposals,
  selectKeyTasks,
} = analyzeRouter._test;

const actions = ['correct', 'tasks', 'keypoints', 'full', 'full_client', 'full_mentor'];
const longTranscript = `[00:00–00:05] Собеседник 1:\nНужно позвонить клиенту завтра.\n${'длинный текст '.repeat(2500)}\n[45:00–45:05] Собеседник 2:\nЯ подготовлю договор к пятнице.`;

for (const action of actions) {
  assert.equal(typeof PROMPTS[action], 'function', `Нет prompt для ${action}`);
  const prompt = buildPiPrompt(action, longTranscript, 'Контекст', []);
  assert(prompt.includes(PI_ANALYSIS_RULES));
  assert(prompt.includes('[00:00–00:05]'));
  assert(prompt.includes('[45:00–45:05]'), `Pi prompt обрезал конец для ${action}`);
  assert(prompt.includes('тайм-код'));
}

const taskPrompt = buildPiPrompt('tasks', longTranscript);
assert(taskPrompt.includes('Ответственный'));
assert(taskPrompt.includes('явная договорённость'));
assert(taskPrompt.includes('рекомендация аналитика'));
assert(taskPrompt.includes('<TRANSCRIPT_META_JSON>'));
assert(taskPrompt.includes('"knowledge"'));
assert(taskPrompt.includes('Название не должно содержать'));
assert(taskPrompt.includes(KEY_TASK_RULES));
assert(taskPrompt.includes('обычно 1–3, максимум 5'));
assert(taskPrompt.includes('"is_key":true'));
assert(taskPrompt.includes('"outcome"'));
assert(!PROMPTS.full(longTranscript).includes('Задача = любое действие'));
assert(PROMPTS.full_client(longTranscript).includes('Связанные действия объедини'));
assert(PROMPTS.full_mentor(longTranscript).includes('Связанные действия объедини'));

const contextPrompt = buildPiPrompt(
  'tasks',
  longTranscript,
  null,
  null,
  {
    text: 'КОНТЕКСТ ИЗ OBSIDIAN\nSOURCE: Проект - аренда/Ленина.md',
    detectedProject: { id: 'Проект - аренда', name: 'Проект - аренда' },
  },
  [{ id: 'Проект - аренда' }]
);
assert(contextPrompt.includes('Проект - аренда/Ленина.md'));
assert(contextPrompt.includes('Доступные ID проектов'));

const parsedMeta = parseTranscriptMeta(`Отчёт
<TRANSCRIPT_META_JSON>
{"title":"Условия договора аренды","summary":"Обсуждены условия.","tasks":[{"task":"Согласовать матрицу комиссии","outcome":"Матрица зафиксирована","is_key":true,"importance":0.92,"project":"Проект - аренда","due":null}],"knowledge":[{"statement":"Комиссия — три ставки","kind":"metric","status":"direct","timecode":"00:10–00:15","evidence":"три ставки"}]}
</TRANSCRIPT_META_JSON>`);
assert.equal(parsedMeta.report, 'Отчёт');
assert.equal(parsedMeta.meta.title, 'Условия договора аренды');
assert.equal(parsedMeta.meta.tasks[0].task, 'Согласовать матрицу комиссии');
assert.equal(parsedMeta.meta.knowledge[0].kind, 'metric');

const parsed = parseTaskProposals(`Отчёт
<TASK_PROPOSALS_JSON>
{"tasks":[{"task":"Позвонить клиенту","project":"Проект - аренда","due":null}]}
</TASK_PROPOSALS_JSON>`);
assert.equal(parsed.tasks[0].task, 'Позвонить клиенту');

const selected = selectKeyTasks([
  { task: 'Весь день заниматься этим', is_key: false, importance: 0.2, confidence: 0.9 },
  { task: 'Позвонить и провести презентацию', is_key: false, importance: 0.4, confidence: 0.9 },
  { task: 'Проверить гипотезу по городам не-миллионникам', is_key: true, importance: 0.82, confidence: 0.91 },
  { task: 'Самим подумать и раскатать тему ставок', is_key: false, importance: 0.5, confidence: 0.9 },
  { task: 'Дать обратную связь по подборкам', is_key: false, importance: 0.3, confidence: 0.9 },
  { task: 'Переработать и проверить скрипт презентации аренды', is_key: true, importance: 0.94, confidence: 0.95 },
  { task: 'Согласовать матрицу комиссии по аренде', is_key: true, importance: 0.9, confidence: 0.93 },
  { task: 'Сомнительная задача', is_key: true, importance: 0.9, confidence: 0.3 },
]);
assert.deepEqual(selected.map(item => item.task), [
  'Переработать и проверить скрипт презентации аренды',
  'Согласовать матрицу комиссии по аренде',
  'Проверить гипотезу по городам не-миллионникам',
]);

const fallbackPrompt = buildFallbackPrompt('tasks', longTranscript);
assert(fallbackPrompt.includes('[...транскрипт обрезан для резервного API]'));
assert(!fallbackPrompt.includes('[45:00–45:05]'));

console.log('✓ Pi получает полный транскрипт без лимита 20 000 символов');
console.log('✓ Все действия требуют источники, спикеров и тайм-коды');
console.log('✓ В предложения проходят только 1–5 ключевых задач с проверяемым результатом');
console.log('✓ Резервный API сохраняет безопасный лимит');
