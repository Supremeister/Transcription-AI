const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const axios = require('axios');

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

console.log('🔍 Deepgram API Test\n');
console.log('API Key:', DEEPGRAM_API_KEY ? '✅ Found' : '❌ Not found');
console.log('Key preview:', DEEPGRAM_API_KEY ? DEEPGRAM_API_KEY.substring(0, 15) + '...' : 'N/A');

if (!DEEPGRAM_API_KEY || DEEPGRAM_API_KEY.includes('your_')) {
  console.error('\n❌ Invalid Deepgram API key!');
  process.exit(1);
}

async function test() {
  try {
    console.log('\n📤 Sending test audio to Deepgram...');
    const audioUrl = 'https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav';
    
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
      console.log('📝 Transcript:');
      console.log(transcript);
      console.log('\n' + '='.repeat(60));
      console.log('Ready for Phase 2: Audio upload + transcription');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.error('❌ No transcript in response');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', error.response.data);
    }
    process.exit(1);
  }
}

test();
