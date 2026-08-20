const assert = require('assert');
const fs = require('fs');
const { createObsidianIndex } = require('./src/services/obsidianIndex');
const { buildContextPack } = require('./src/services/obsidianContext');
const analyzeRouter = require('./src/routes/analyze');
const { runPiAnalysis } = require('./src/services/piAgent');

async function main() {
  const file = process.env.TRANSCRIPT_TEST_FILE;
  const projectId = process.env.PROJECT_TEST_ID;
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!file || !projectId || !vaultPath) {
    throw new Error('Нужны TRANSCRIPT_TEST_FILE, PROJECT_TEST_ID и OBSIDIAN_VAULT_PATH');
  }
  const source = fs.readFileSync(file, 'utf8');
  const transcript = source.split('## Полная транскрипция')[1]?.trim() || source;
  const index = createObsidianIndex({ vaultPath });
  index.refresh();
  const context = buildContextPack(transcript, {
    index,
    preferredProject: projectId,
  });
  const prompt = analyzeRouter._test.buildPiPrompt(
    'full_client',
    transcript,
    null,
    null,
    context,
    index.listProjects()
  );
  const result = await runPiAnalysis(prompt, {
    thinking: 'high',
    timeoutMs: 8 * 60 * 1000,
  });
  const parsed = analyzeRouter._test.parseTranscriptMeta(result.text);
  assert(parsed.report.length > 100, 'Нет текстового отчёта');
  assert(parsed.meta.title, 'Нет короткой темы');
  assert(parsed.meta.knowledge.length > 0, 'Нет ключевых знаний');
  console.log(JSON.stringify({
    promptChars: prompt.length,
    reportChars: parsed.report.length,
    title: parsed.meta.title,
    tasks: parsed.meta.tasks.length,
    taskItems: parsed.meta.tasks.map(task => ({
      task: task.task,
      outcome: task.outcome,
      isKey: task.is_key,
      importance: task.importance,
    })),
    knowledge: parsed.meta.knowledge.length,
    sources: context.sources,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  if (error.details) console.error(error.details);
  process.exit(1);
});
