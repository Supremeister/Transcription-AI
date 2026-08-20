const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-integration-'));
const projectId = 'Проект - аренда';
const projectDir = path.join(fixture, projectId);
const taskFile = path.join(projectDir, '!Задачи.md');
fs.mkdirSync(projectDir, { recursive: true });
fs.mkdirSync(path.join(projectDir, 'Транскрипции', 'Raw'), { recursive: true });
fs.writeFileSync(taskFile, '# Задачи\n', 'utf8');
fs.writeFileSync(
  path.join(projectDir, 'Контекст.md'),
  'Клиент Иван. Готовим договор аренды.',
  'utf8'
);

const port = 3011;
const serverPath = process.env.AGENT_SERVER_PATH
  || path.join(__dirname, 'src', 'server.js');
const server = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    PORT: String(port),
    OBSIDIAN_VAULT_PATH: fixture,
    AI_PROVIDER_MODE: 'pi',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString('utf8'); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString('utf8'); });

async function waitForHealth() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Backend не запустился:\n${serverOutput}`);
}

(async () => {
  try {
    await waitForHealth();
    const agentHealth = await fetch(`http://127.0.0.1:${port}/api/agent/health`).then(r => r.json());
    assert.equal(agentHealth.connected, true);
    assert.equal(agentHealth.projects[0].id, projectId);

    const analysisResponse = await fetch(`http://127.0.0.1:${port}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'full',
        preferredProject: projectId,
        sourceFilename: 'Тестовая встреча.m4a',
        speakersCount: 2,
        transcript: [
          '[00:00–00:05] Михаил:',
          'Иван, подготовь договор аренды к 1 августа 2026 года.',
          '',
          '[00:05–00:09] Иван:',
          'Да, подготовлю договор к первому августа.',
        ].join('\n'),
      }),
    });
    const analysis = await analysisResponse.json();
    assert.equal(analysis.success, true, JSON.stringify(analysis));
    assert.equal(analysis.agentContext.detectedProject.id, projectId);
    assert(analysis.topic, 'Pi не вернул короткую тему');
    assert(analysis.knowledge.length > 0, 'Pi не вернул ключевые знания');
    assert(analysis.transcriptArchive.relativePath.startsWith(`${projectId}/Транскрипции/Raw/`));
    assert(!analysis.transcriptArchive.relativePath.includes('Тестовая встреча'));
    assert(analysis.proposals.length > 0, 'Pi не вернул предложение задачи');
    const transcriptNote = fs.readFileSync(
      path.join(fixture, ...analysis.transcriptArchive.relativePath.split('/')),
      'utf8'
    );
    assert(transcriptNote.includes('## AI-разбор'));
    assert(transcriptNote.includes('## Полная транскрипция'));

    const proposal = analysis.proposals[0];
    const approveResponse = await fetch(
      `http://127.0.0.1:${port}/api/agent/proposals/${proposal.id}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: proposal.task,
          projectId,
          due: proposal.due,
        }),
      }
    );
    const approved = await approveResponse.json();
    assert.equal(approved.success, true, JSON.stringify(approved));
    assert(['approved', 'duplicate'].includes(approved.proposal.status));
    const taskContent = fs.readFileSync(taskFile, 'utf8');
    assert(taskContent.includes('Транскрипция: [['));
    console.log('agent integration test: OK');
  } finally {
    server.kill();
    await new Promise(resolve => setTimeout(resolve, 300));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
