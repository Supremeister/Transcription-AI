const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let gigaamProcess = null;
let backendProcess = null;
let botProcess = null;
let botUsername = null;
const USER_CONFIG_VERSION = 2;
const PI_THINKING_LEVELS = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);

const IS_PROD = app.isPackaged;
const APP_PATH = app.getAppPath();
const RESOURCES = process.resourcesPath;

// Логирование в файл для отладки
const logFile = path.join(app.getPath('userData'), 'app.log');
function log(msg) {
  const safeMsg = String(msg).replace(
    /bot\d+:[A-Za-z0-9_-]+/gi,
    'bot[REDACTED]'
  );
  const line = `[${new Date().toISOString()}] ${safeMsg}\n`;
  console.log(safeMsg);
  try { fs.appendFileSync(logFile, line); } catch(e) {}
}

log(`Запуск. IS_PROD=${IS_PROD}`);
log(`APP_PATH=${APP_PATH}`);
log(`RESOURCES=${RESOURCES}`);

function loadEnvVar(key) {
  try {
    const envPath = IS_PROD
      ? path.join(RESOURCES, 'backend', '.env')
      : path.join(APP_PATH, '..', 'backend', '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const m = line.match(new RegExp(`^${key}\\s*=\\s*(.+)$`));
        if (m) return m[1].trim();
      }
    }
  } catch(e) {}
  return null;
}

function getUserConfigPath() {
  return path.join(app.getPath('userData'), 'secure-config.json');
}

function readUserConfig() {
  const defaults = {
    version: USER_CONFIG_VERSION,
    onboardingComplete: false,
    aiMode: 'none',
    piModel: 'gpt-5.6-sol',
    piThinking: 'high',
    apiEndpoint: 'https://api.openai.com/v1',
    apiModel: 'gpt-4o-mini',
    apiKeyEncrypted: null,
    hfTokenEncrypted: null,
  };
  try {
    const parsed = JSON.parse(fs.readFileSync(getUserConfigPath(), 'utf8'));
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function decryptSecret(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return '';
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return '';
  }
}

function encryptSecret(value) {
  if (!value) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows не предоставил защищённое хранилище DPAPI');
  }
  return safeStorage.encryptString(String(value)).toString('base64');
}

function writeUserConfig(next) {
  const configPath = getUserConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

function loadHfToken() {
  return decryptSecret(readUserConfig().hfTokenEncrypted) || loadEnvVar('HF_TOKEN');
}

function findBundledPiCli() {
  const base = IS_PROD
    ? path.join(RESOURCES, 'pi-agent', 'node_modules')
    : path.join(APP_PATH, 'pi-runtime', 'node_modules');
  const candidate = path.join(
    base,
    '@earendil-works',
    'pi-coding-agent',
    'dist',
    'cli.js'
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function publicUserConfig() {
  const config = readUserConfig();
  return {
    onboardingComplete: Boolean(config.onboardingComplete),
    aiMode: config.aiMode,
    piModel: config.piModel,
    piThinking: config.piThinking,
    apiEndpoint: config.apiEndpoint,
    apiModel: config.apiModel,
    apiKeyConfigured: Boolean(decryptSecret(config.apiKeyEncrypted)),
    hfTokenConfigured: Boolean(loadHfToken()),
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    piBundled: Boolean(findBundledPiCli()),
  };
}

function loadGigaAmPort() {
  return loadEnvVar('GIGAAM_SERVICE_PORT')
    || process.env.GIGAAM_SERVICE_PORT
    || '17801';
}

function stripUnsupportedProxyEnv(env) {
  const cleaned = { ...env };
  for (const key of [
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY',
    'http_proxy', 'https_proxy', 'all_proxy',
  ]) {
    if (/^socks4:\/\//i.test(cleaned[key] || '')) {
      delete cleaned[key];
    }
  }
  cleaned.NO_PROXY = cleaned.NO_PROXY || '127.0.0.1,localhost';
  cleaned.no_proxy = cleaned.no_proxy || cleaned.NO_PROXY;
  return cleaned;
}

function startTelegramBot() {
  const token = loadEnvVar('TELEGRAM_BOT_TOKEN');
  if (!token) { log('ℹ️ TELEGRAM_BOT_TOKEN не задан — бот не запущен'); return; }

  const botScript = IS_PROD
    ? path.join(RESOURCES, 'telegram_bot.py')
    : path.join(APP_PATH, '..', 'telegram_bot.py');

  if (!fs.existsSync(botScript)) { log(`⚠️ telegram_bot.py не найден: ${botScript}`); return; }

  log(`Запускаем Telegram бот: ${botScript}`);
  botProcess = spawn('python', [botScript], {
    stdio: 'pipe',
    env: { ...process.env, TELEGRAM_BOT_TOKEN: token, TRANSCRIBER_BACKEND: 'http://localhost:3000' }
  });
  botProcess.stdout.on('data', d => {
    const text = d.toString().trim();
    for (const line of text.split('\n')) {
      if (line.startsWith('BOT_USERNAME:')) {
        botUsername = line.replace('BOT_USERNAME:', '').trim();
        log(`[Bot] username: ${botUsername}`);
        if (mainWindow) mainWindow.webContents.send('bot-username', botUsername);
      } else {
        log(`[Bot] ${line}`);
      }
    }
  });
  botProcess.stderr.on('data', d => log(`[Bot ERR] ${d.toString().trim()}`));
  botProcess.on('close', code => {
    log(`[Bot] завершён, код: ${code}`);
    if (code !== 0 && !app.isQuitting) {
      log('[Bot] перезапускаем через 5 секунд...');
      setTimeout(() => startTelegramBot(), 5000);
    }
  });
}

function findGigaAmPython() {
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(localAppData, 'Programs', 'Python', 'Python312', 'python.exe'),
    'C:\\Program Files\\Python312\\python.exe',
    'C:\\Python312\\python.exe',
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || 'python';
}

function startGigaAmService() {
  const exe = IS_PROD
    ? path.join(RESOURCES, 'gigaam_service', 'gigaam_service.exe')
    : null;
  const py = IS_PROD
    ? null
    : path.join(APP_PATH, '..', 'backend', 'gigaam_service.py');
  const hfToken = loadHfToken();
  const gigaamEnv = stripUnsupportedProxyEnv(process.env);
  gigaamEnv.GIGAAM_SERVICE_PORT = loadGigaAmPort();
  if (hfToken) {
    gigaamEnv.HF_TOKEN = hfToken;
    log('ℹ️ HF_TOKEN загружен для Community-1');
  }

  if (exe && fs.existsSync(exe)) {
    log(`Запускаем GigaAM EXE: ${exe}`);
    gigaamProcess = spawn(exe, [], {
      stdio: 'pipe',
      env: gigaamEnv,
      windowsHide: true,
    });
  } else if (py && fs.existsSync(py)) {
    const python = findGigaAmPython();
    log(`Запускаем GigaAM через Python 3.12: ${python} ${py}`);
    gigaamProcess = spawn(python, [py], {
      stdio: 'pipe',
      env: gigaamEnv,
      windowsHide: true,
    });
  } else {
    log('❌ GigaAM-сервис не найден');
    return;
  }

  gigaamProcess.stdout.on('data', d => {
    const text = d.toString().trim();
    for (const line of text.split('\n')) {
      if (line) log(`[GigaAM] ${line}`);
    }
  });
  gigaamProcess.stderr.on('data', d => log(`[GigaAM ERR] ${d.toString().trim()}`));
  gigaamProcess.on('close', code => log(`[GigaAM] завершён, код: ${code}`));
}

function startBackend() {
  const backendDir = IS_PROD
    ? path.join(RESOURCES, 'backend')
    : path.join(APP_PATH, '..', 'backend');

  const serverJs = IS_PROD
    ? path.join(backendDir, 'server.js')
    : path.join(backendDir, 'src', 'server.js');

  const nodeExe = path.join(RESOURCES, 'node.exe');

  log(`Запускаем backend: node ${serverJs}`);

  if (!fs.existsSync(serverJs)) {
    log(`❌ server.js не найден: ${serverJs}`);
    return;
  }

  const nodeBin = IS_PROD ? nodeExe : 'node';

  if (IS_PROD && !fs.existsSync(nodeExe)) {
    log('❌ node.exe не найден: ' + nodeExe);
    return;
  }

  const userConfig = readUserConfig();
  const customApiKey = decryptSecret(userConfig.apiKeyEncrypted);
  const hfToken = loadHfToken();
  const backendEnv = stripUnsupportedProxyEnv(process.env);
  backendEnv.GIGAAM_SERVICE_PORT = loadGigaAmPort();
  backendEnv.APP_USER_DATA = app.getPath('userData');
  backendEnv.AI_PROVIDER_MODE = userConfig.aiMode || 'none';
  backendEnv.PI_ANALYSIS_PROVIDER = 'openai-codex';
  backendEnv.PI_ANALYSIS_MODEL = userConfig.piModel || 'gpt-5.6-sol';
  backendEnv.PI_ANALYSIS_THINKING = userConfig.piThinking || 'high';
  backendEnv.CUSTOM_API_ENDPOINT = userConfig.apiEndpoint || 'https://api.openai.com/v1';
  backendEnv.CUSTOM_API_MODEL = userConfig.apiModel || 'gpt-4o-mini';
  backendEnv.CUSTOM_API_KEY = customApiKey;
  backendEnv.PI_CLI_JS = findBundledPiCli() || backendEnv.PI_CLI_JS || '';
  backendProcess = spawn(nodeBin, [serverJs], {
    cwd: backendDir,
    env: { ...backendEnv, PORT: '3000', NODE_ENV: 'production', HF_TOKEN: hfToken || '' },
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', d => log(`[Backend] ${d.toString().trim()}`));
  backendProcess.stderr.on('data', d => log(`[Backend ERR] ${d.toString().trim()}`));
  backendProcess.on('close', code => log(`[Backend] завершён, код: ${code}`));
}

function createWindow() {
  const iconPng = path.join(__dirname, 'resources', 'icon.png');
  const iconIco = path.join(__dirname, 'resources', 'icon.ico');
  const iconPath = fs.existsSync(iconIco) ? iconIco : fs.existsSync(iconPng) ? iconPng : undefined;
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    title: 'Транскрибатор',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true,
    show: true,
    backgroundColor: '#0c3b26'
  });

  // В prod frontend лежит в resources/frontend/ (вне asar)
  const indexHtml = IS_PROD
    ? path.join(RESOURCES, 'frontend', 'index.html')
    : path.join(APP_PATH, '..', 'frontend', 'dist', 'index.html');
  log(`Загружаем: ${indexHtml}`);

  mainWindow.loadFile(indexHtml).catch(err => {
    log(`❌ Ошибка загрузки UI: ${err.message}`);
    mainWindow.loadURL(`data:text/html,<h2>Ошибка: ${err.message}</h2><p>Лог: ${logFile}</p>`);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  log('app ready');
  startGigaAmService();
  startBackend();
  startTelegramBot();
  createWindow();

  // Автообновление включается явно: устаревшие релизы не должны
  // автоматически заменять локальную GigaAM-сборку.
  if (IS_PROD && loadEnvVar('ENABLE_AUTO_UPDATE') === 'true') {
    autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      log(`[Updater] Доступна версия ${info.version}`);
      if (mainWindow) mainWindow.webContents.send('update-available', { version: info.version });
    });

    autoUpdater.on('update-downloaded', (info) => {
      log(`[Updater] Версия ${info.version} скачана`);
      if (mainWindow) mainWindow.webContents.send('update-downloaded', { version: info.version });
    });

    autoUpdater.on('error', (e) => log(`[Updater] Ошибка: ${e.message}`));

    // Проверяем через 5 секунд после старта, потом каждые 4 часа
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
  } else if (IS_PROD) {
    log('ℹ️ Автообновление отключено для локальной GigaAM-сборки');
  }
}).catch(err => log(`❌ app.whenReady error: ${err.message}`));

function killProcess(proc) {
  if (!proc) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/f', '/t', '/pid', proc.pid.toString()], { stdio: 'ignore' });
    } else {
      proc.kill('SIGKILL');
    }
  } catch (e) {
    log(`Ошибка при завершении процесса: ${e.message}`);
  }
}

function killGigaAmByName() {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/f', '/im', 'gigaam_service.exe'], { stdio: 'ignore' });
  }
}

app.on('window-all-closed', () => {
  killProcess(gigaamProcess); gigaamProcess = null;
  killProcess(backendProcess); backendProcess = null;
  killProcess(botProcess); botProcess = null;
  killGigaAmByName();
  app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  killProcess(gigaamProcess); gigaamProcess = null;
  killProcess(backendProcess); backendProcess = null;
  killProcess(botProcess); botProcess = null;
  killGigaAmByName();
});

process.on('uncaughtException', err => log(`❌ uncaughtException: ${err.message}\n${err.stack}`));

ipcMain.handle('get-bot-username', () => botUsername);
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());

ipcMain.handle('get-app-config', () => publicUserConfig());

ipcMain.handle('save-app-config', async (_event, input = {}) => {
  const previous = readUserConfig();
  const next = { ...previous, version: USER_CONFIG_VERSION };
  if (input.aiMode !== undefined) {
    if (!['none', 'pi', 'custom-api'].includes(input.aiMode)) {
      throw new Error('Неизвестный режим AI');
    }
    next.aiMode = input.aiMode;
  }
  if (input.piModel !== undefined) {
    const model = String(input.piModel).trim();
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(model)) {
      throw new Error('Некорректное название модели Pi');
    }
    next.piModel = model;
  }
  if (input.piThinking !== undefined) {
    const thinking = String(input.piThinking).trim();
    if (!PI_THINKING_LEVELS.has(thinking)) {
      throw new Error('Некорректный уровень thinking Pi');
    }
    next.piThinking = thinking;
  }
  if (input.apiEndpoint !== undefined) {
    const endpoint = String(input.apiEndpoint).trim().replace(/\/$/, '');
    const parsed = new URL(endpoint);
    const localHttp = parsed.protocol === 'http:'
      && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !localHttp) {
      throw new Error('API endpoint должен использовать HTTPS (HTTP разрешён только для localhost)');
    }
    next.apiEndpoint = endpoint;
  }
  if (input.apiModel !== undefined) {
    const model = String(input.apiModel).trim();
    if (!model) throw new Error('Укажите модель API');
    next.apiModel = model;
  }
  if (input.apiKey !== undefined) {
    next.apiKeyEncrypted = encryptSecret(String(input.apiKey).trim());
  }
  if (input.hfToken !== undefined) {
    const token = String(input.hfToken).trim();
    if (token && !token.startsWith('hf_')) {
      throw new Error('Hugging Face токен должен начинаться с hf_');
    }
    next.hfTokenEncrypted = encryptSecret(token);
  }
  if (input.onboardingComplete !== undefined) {
    next.onboardingComplete = Boolean(input.onboardingComplete);
  }
  if (next.aiMode === 'custom-api' && !decryptSecret(next.apiKeyEncrypted)) {
    throw new Error('Для стороннего API нужен ключ');
  }
  writeUserConfig(next);

  const hfChanged = previous.hfTokenEncrypted !== next.hfTokenEncrypted;
  killProcess(backendProcess); backendProcess = null;
  if (hfChanged) {
    killProcess(gigaamProcess); gigaamProcess = null;
    startGigaAmService();
  }
  startBackend();
  return publicUserConfig();
});

ipcMain.handle('open-pi-login', () => {
  const cliPath = findBundledPiCli();
  if (!cliPath) throw new Error('Pi не найден в составе приложения');
  const developmentNode = path.join(APP_PATH, 'resources', 'node.exe');
  const nodeBin = IS_PROD
    ? path.join(RESOURCES, 'node.exe')
    : (fs.existsSync(developmentNode) ? developmentNode : 'node');
  const config = readUserConfig();
  const command = `title Pi Login && "${nodeBin}" "${cliPath}" --provider openai-codex --model "${config.piModel}" --thinking "${config.piThinking}"`;
  const loginProcess = spawn('cmd.exe', ['/k', command], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  loginProcess.unref();
  return { success: true };
});

// Установка Ollama + модели
ipcMain.handle('setup-ai', async (event) => {
  const https = require('https');
  const os = require('os');

  const send = (step, msg, pct = 0) => {
    log(`[Setup] ${msg}`);
    event.sender.send('setup-progress', { step, msg, pct });
  };

  // Скачивание через curl.exe (встроен в Windows 10/11) — быстрее Node https
  const downloadFile = (url, dest) => new Promise((resolve, reject) => {
    // curl -L следует редиректам, --progress-bar даёт прогресс в stderr
    const curl = spawn('curl.exe', ['-L', '-o', dest, '--progress-bar', url], {
      stdio: ['ignore', 'ignore', 'pipe']
    });

    curl.stderr.on('data', (chunk) => {
      const str = chunk.toString();
      // curl прогресс: "###  36.0% ..."
      const match = str.match(/([\d.]+)%/);
      if (match) {
        const pct = Math.round(parseFloat(match[1]));
        send('download', `Скачиваем Ollama... ${pct}%`, pct);
      }
    });

    curl.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl завершился с кодом ${code}`));
    });
    curl.on('error', reject);
  });

  // Найти ollama.exe в стандартных путях Windows
  const findOllama = () => {
    const candidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
      'C:\\Program Files\\Ollama\\ollama.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return 'ollama'; // fallback с shell: true
  };

  // Проверяем доступность Ollama API
  const isOllamaRunning = () => new Promise(resolve => {
    const req = require('http').get('http://localhost:11434/api/tags', { timeout: 2000 }, res => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });

  // Проверяем наличие модели
  const hasModel = () => new Promise(resolve => {
    const req = require('http').get('http://localhost:11434/api/tags', { timeout: 3000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const models = JSON.parse(data)?.models?.map(m => m.name) || [];
          resolve(models.some(m => m.startsWith('qwen2.5:3b')));
        } catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
  });

  try {
    const ollamaExe = findOllama();
    const ollamaFound = ollamaExe !== 'ollama' || (() => {
      try { require('child_process').execSync('where ollama', { stdio: 'ignore' }); return true; } catch { return false; }
    })();

    // 1. Скачиваем/устанавливаем только если не установлена
    if (!ollamaFound) {
      send('download', 'Скачиваем Ollama...', 0);
      const installerPath = path.join(os.tmpdir(), 'OllamaSetup.exe');
      try { fs.unlinkSync(installerPath); } catch {}
      await downloadFile('https://ollama.com/download/OllamaSetup.exe', installerPath);

      send('install', 'Устанавливаем Ollama...', 0);
      await new Promise((resolve, reject) => {
        const proc = spawn(installerPath, ['/S'], { stdio: 'ignore', shell: false });
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(`Код ${code}`)));
        proc.on('error', reject);
      });
      await new Promise(r => setTimeout(r, 4000));
    } else {
      send('wait', 'Ollama найдена, запускаем...', 10);
    }

    // 2. Запускаем сервис если не работает
    if (!(await isOllamaRunning())) {
      send('wait', 'Запускаем Ollama...', 20);
      spawn(ollamaExe === 'ollama' ? 'ollama' : ollamaExe, ['serve'], {
        stdio: 'ignore', detached: true, shell: ollamaExe === 'ollama'
      }).unref();
      // Ждём до 15 секунд пока поднимется
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        if (await isOllamaRunning()) break;
      }
    }

    // 3. Скачиваем модель только если не установлена
    if (!(await hasModel())) {
      send('pull', 'Скачиваем модель qwen2.5:3b (~2 ГБ)...', 30);
    } else {
      send('done', 'AI уже настроен!', 100);
      return { success: true };
    }

    // 4. Pull модели через HTTP API (стримит JSON-прогресс)
    log(`[Setup] Pull модели через Ollama API`);
    await new Promise((resolve, reject) => {
      const body = JSON.stringify({ name: 'qwen2.5:3b', stream: true });
      const req = require('http').request({
        hostname: '127.0.0.1', port: 11434,
        path: '/api/pull', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, res => {
        let buf = '';
        res.on('data', chunk => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const d = JSON.parse(line);
              if (d.error) { reject(new Error(d.error)); return; }
              if (d.total > 0 && d.completed !== undefined) {
                const pct = Math.max(31, Math.round(d.completed / d.total * 100));
                send('pull', `Скачиваем модель... ${pct}%`, pct);
              } else if (d.status === 'success') {
                resolve();
              }
            } catch {}
          }
        });
        res.on('end', resolve);
        res.on('error', reject);
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    send('done', 'AI настроен!', 100);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
