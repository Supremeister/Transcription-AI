require('dotenv').config({ path: '../../.env' });
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

async function testClaudeAPI() {
  console.log(`\n${colors.blue}=== Testing Claude API ===${colors.reset}`);

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229';

  if (!ANTHROPIC_API_KEY) {
    console.error(`${colors.red}✗ ANTHROPIC_API_KEY not set${colors.reset}`);
    return false;
  }

  try {
    console.log(`Sending analysis request to Claude (${MODEL})...`);

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: MODEL,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: 'Extract goals from this text: "We need to launch the API by Friday. Maria will handle authentication. Testing starts Monday."'
          }
        ]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      }
    );

    if (response.data?.content?.[0]?.text) {
      const text = response.data.content[0].text;
      console.log(`${colors.green}✓ Claude API working${colors.reset}`);
      console.log(`  Response (first 100 chars): "${text.substring(0, 100)}..."`);
      return true;
    } else {
      console.error(`${colors.red}✗ Unexpected response format${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}✗ Claude API error: ${error.message}${colors.reset}`);
    if (error.response?.data) {
      console.error(`  Details:`, error.response.data);
    }
    return false;
  }
}

async function runTests() {
  console.log(`${colors.yellow}Starting API credential tests...${colors.reset}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  const deepgramOk = await testDeepgramAPI();
  const claudeOk = await testClaudeAPI();

  console.log(`\n${colors.blue}=== Summary ===${colors.reset}`);
  console.log(`Deepgram: ${deepgramOk ? `${colors.green}✓ OK${colors.reset}` : `${colors.red}✗ FAILED${colors.reset}`}`);
  console.log(`Claude:   ${claudeOk ? `${colors.green}✓ OK${colors.reset}` : `${colors.red}✗ FAILED${colors.reset}`}`);

  if (deepgramOk && claudeOk) {
    console.log(`\n${colors.green}All API tests passed! Ready for Phase 2.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}Some tests failed. Check credentials and try again.${colors.reset}`);
    process.exit(1);
  }
}

runTests();
