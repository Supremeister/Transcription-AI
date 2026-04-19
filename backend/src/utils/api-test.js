require('dotenv').config({ path: '../.env' });
const axios = require('axios');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function testDeepgramAPI() {
  console.log(`\n${colors.blue}=== Testing Deepgram API ===${colors.reset}`);

  const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
  if (!DEEPGRAM_API_KEY) {
    console.error(`${colors.red}✗ DEEPGRAM_API_KEY not set${colors.reset}`);
    return false;
  }

  try {
    // Use a public sample audio file
    const sampleAudioUrl = 'https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav';

    console.log(`Sending transcription request to Deepgram...`);
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen?model=nova-2&language=en',
      { url: sampleAudioUrl },
      {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      const transcript = response.data.results.channels[0].alternatives[0].transcript;
      console.log(`${colors.green}✓ Deepgram API working${colors.reset}`);
      console.log(`  Transcript (first 100 chars): "${transcript.substring(0, 100)}..."`);
      return true;
    } else {
      console.error(`${colors.red}✗ Unexpected response format${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}✗ Deepgram API error: ${error.message}${colors.reset}`);
    if (error.response?.data) {
      console.error(`  Details:`, error.response.data);
    }
    return false;
  }
}

async function testOllamaAPI() {
  console.log(`\n${colors.blue}=== Testing Ollama (Qwen2.5B) ===${colors.reset}`);

  const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen:2.5b';

  try {
    console.log(`Testing connection to Ollama at ${OLLAMA_API_URL}...`);
    console.log(`Model: ${OLLAMA_MODEL}`);

    // Test 1: Check if Ollama is running
    const tagsResponse = await axios.get(`${OLLAMA_API_URL}/api/tags`, {
      timeout: 5000
    });

    if (!tagsResponse.data?.models) {
      console.error(`${colors.red}✗ No models found in Ollama${colors.reset}`);
      return false;
    }

    const hasQwen = tagsResponse.data.models.some(m => m.name.includes('qwen'));
    if (!hasQwen) {
      console.log(`${colors.yellow}⚠ Qwen model not found. Available models:${colors.reset}`);
      tagsResponse.data.models.forEach(m => console.log(`  - ${m.name}`));
    }

    // Test 2: Generate text with Ollama
    console.log(`Sending analysis request to Ollama...`);
    const response = await axios.post(
      `${OLLAMA_API_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt: 'Extract goals from: "We need to launch API by Friday. Maria handles auth. Testing Monday." Output JSON only.',
        stream: false,
        temperature: 0.1
      },
      {
        timeout: 30000
      }
    );

    if (response.data?.response) {
      const text = response.data.response;
      console.log(`${colors.green}✓ Ollama API working${colors.reset}`);
      console.log(`  Response (first 100 chars): "${text.substring(0, 100)}..."`);
      console.log(`  Generated ${response.data.eval_count || '?'} tokens`);
      return true;
    } else {
      console.error(`${colors.red}✗ Unexpected response format${colors.reset}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error(`${colors.red}✗ Ollama not running. Start with: ollama serve${colors.reset}`);
    } else {
      console.error(`${colors.red}✗ Ollama API error: ${error.message}${colors.reset}`);
      if (error.response?.data) {
        console.error(`  Details:`, error.response.data);
      }
    }
    return false;
  }
}

async function runTests() {
  console.log(`${colors.yellow}Starting API tests (Deepgram + Ollama)...${colors.reset}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}\n`);

  const deepgramOk = await testDeepgramAPI();
  const ollamaOk = await testOllamaAPI();

  console.log(`\n${colors.blue}=== Summary ===${colors.reset}`);
  console.log(`Deepgram: ${deepgramOk ? `${colors.green}✓ OK${colors.reset}` : `${colors.red}✗ FAILED${colors.reset}`}`);
  console.log(`Ollama:   ${ollamaOk ? `${colors.green}✓ OK${colors.reset}` : `${colors.red}✗ FAILED${colors.reset}`}`);

  if (deepgramOk && ollamaOk) {
    console.log(`\n${colors.green}✓ All API tests passed! Ready for Phase 2.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.yellow}⚠ Some tests need attention. See details above.${colors.reset}`);
    process.exit(deepgramOk && ollamaOk ? 0 : 1);
  }
}

runTests();
