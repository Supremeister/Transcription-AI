# API Credentials Setup

This document explains how to obtain and configure API keys for Deepgram and Claude.

## Deepgram API Key

### Steps to Get Your Key:

1. **Visit Deepgram Console:** https://console.deepgram.com/signup
2. **Sign up for a free account:**
   - Email address
   - Password
   - Verify your email
3. **Navigate to API Keys:**
   - Log in to https://console.deepgram.com
   - Go to **Credentials** → **API Keys** (left sidebar)
4. **Create a new API key:**
   - Click **Create New API Key**
   - Give it a name (e.g., "Transcription Service Development")
   - Copy the key (you'll only see it once)
5. **Add to `.env`:**
   ```bash
   DEEPGRAM_API_KEY=your_actual_key_here
   ```

### Free Tier:
- 25 hours of transcription per month
- Perfect for MVP testing

## Claude API Key (Anthropic)

### Steps to Get Your Key:

1. **Visit Anthropic Console:** https://console.anthropic.com/
2. **Sign up for an account:**
   - Email address
   - Password
   - Verify your email
3. **Navigate to API Keys:**
   - Log in to https://console.anthropic.com
   - Go to **API Keys** in the dashboard (top right or sidebar)
4. **Create a new API key:**
   - Click **Create Key**
   - Give it a name (e.g., "Transcription Service Development")
   - Copy the key
5. **Add to `.env`:**
   ```bash
   ANTHROPIC_API_KEY=your_actual_key_here
   ```

### Pricing:
- Claude Sonnet: $3 per 1M input tokens, $15 per 1M output tokens
- Free tier: Some credits included for new accounts

## Configure Your `.env` File

After obtaining both keys, create or edit `.env` in your project root:

```bash
cp .env.example .env
nano .env  # or your preferred editor
```

Add your keys:
```
DEEPGRAM_API_KEY=sk-xxx...
ANTHROPIC_API_KEY=sk-ant-xxx...
```

## Verify Configuration

To test that your keys are working:

```bash
cd backend
npm run test:api
```

You should see:
```
✓ Deepgram API working
✓ Claude API working
All API tests passed! Ready for Phase 2.
```

## Important Notes

- **Never commit `.env`** — It's in `.gitignore` for security
- **Keep keys safe** — Don't share them or post them online
- **Rotate keys periodically** — Best practice for security
- **Monitor usage** — Check your provider dashboards for rate limits
- **Free tiers are limited** — Plan accordingly for testing

## Troubleshooting

### "DEEPGRAM_API_KEY not set"
- Make sure `.env` file exists in project root
- Verify key is spelled correctly: `DEEPGRAM_API_KEY`
- No spaces around the `=` sign

### "Deepgram API error: 401 Unauthorized"
- Key may be expired or invalid
- Generate a new key from Deepgram console
- Double-check for copying errors (whitespace, etc.)

### "ANTHROPIC_API_KEY not set"
- Same as above, check `.env` file
- Verify key is spelled correctly: `ANTHROPIC_API_KEY`

### "Claude API error: 401 Unauthorized"
- API key may not have proper permissions
- Create a new key with default permissions
- Verify account has billing set up (if past free credits)

## Next Steps

Once both APIs are configured and tests pass, you're ready for Phase 2:
- File upload endpoint
- Transcription integration
- Analysis pipeline
