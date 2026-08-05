const assert = require('assert');
const {
  PI_MODEL,
  PI_PROVIDER,
  inspectPiHealth,
  runPiAnalysis,
} = require('./src/services/piAgent');

async function main() {
  const health = inspectPiHealth({ refresh: true });
  assert.equal(health.available, true, `Pi недоступен: ${health.error || 'не найден'}`);
  assert.equal(health.authConfigured, true, 'Pi auth.json не настроен');
  assert.equal(health.provider, PI_PROVIDER);
  assert.equal(health.model, PI_MODEL);

  const result = await runPiAnalysis('Верни ровно текст PI_RPC_OK без пояснений.', {
    timeoutMs: 120000,
  });
  assert.equal(result.text, 'PI_RPC_OK');
  assert.equal(result.provider, 'openai-codex');
  assert.equal(result.model, 'gpt-5.6-sol');
  assert.equal(result.thinking, 'high');

  console.log(`✓ Pi ${health.version}: ${result.provider}/${result.model}`);
  console.log('✓ RPC изоляция и ответ работают');
}

main().catch(error => {
  console.error(error);
  if (error.details) console.error(error.details);
  process.exit(1);
});
