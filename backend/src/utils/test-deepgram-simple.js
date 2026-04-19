require('dotenv').config({ path: '../.env' });
const axios = require('axios');

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  console.error('❌ DEEPGRAM_API_KEY not set in .env');
  console.error('Add this to backend/.env:');
  console.error('DEEPGRAM_API_KEY=your_key_here');
  process.exit(1);
}

console.log('Testing Deepgram API...\n');
console.log('API Key found:', DEEPGRAM_API_KEY.substring(0, 10) + '...');

async function test() {
  try {
    // Test with public sample audio
    const audioUrl = 'https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav';
    
    console.log('\nSending test audio to Deepgram...');
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen?model=nova-2&language=en',
      { url: audioUrl },
      {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000
      }
    );

    const transcript = response.data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    
    if (transcript) {
      console.log('\n✅ SUCCESS! Deepgram is working!\n');
      console.log('Transcript:', transcript);
      console.log('\n' + '='.repeat(50));
      console.log('Ready for Phase 2: Audio upload + transcription');
      console.log('='.repeat(50));
      process.exit(0);
    } else {
      console.error('❌ No transcript in response');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', error.response.data);
    }
    process.exit(1);
  }
}

test();
