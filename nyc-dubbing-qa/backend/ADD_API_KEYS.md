# How to Add Your API Keys Safely

## IMPORTANT SECURITY NOTICE
Never share your API keys publicly. If you've accidentally shared an API key, revoke it immediately and generate a new one.

## Steps to Add Your API Keys:

1. **Open the .env file** in your text editor:
   ```bash
   cd /Users/pjmbair25/Documents/Development/translation_july18/nyc-dubbing-qa/backend
   open .env  # or use your preferred editor
   ```

2. **Replace the placeholder values** with your actual API keys:

   - For OpenAI: Replace `paste_your_openai_api_key_here` with your new OpenAI API key
   - For Google Gemini: Replace `paste_your_gemini_api_key_here` with your Gemini API key
   - For ElevenLabs: Replace `paste_your_elevenlabs_api_key_here` with your ElevenLabs API key

3. **Save the file**

## Getting API Keys:

### OpenAI API Key
1. Go to: https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (it will only be shown once)

### Google Gemini API Key
1. Go to: https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy the generated key

### ElevenLabs API Key
1. Go to: https://elevenlabs.io/
2. Sign up/Login
3. Go to Profile Settings → API Keys
4. Generate and copy your API key

## Security Best Practices:

1. **Never commit .env files to Git** (already in .gitignore)
2. **Use environment-specific keys** (dev vs production)
3. **Rotate keys regularly**
4. **Set key permissions** in production environments
5. **Use secret management services** for production (AWS Secrets Manager, etc.)

## Verify Your Setup:

After adding your keys, you can verify they're loaded correctly by running:

```bash
npm run dev
```

Check the console output - it should connect to the services without errors.