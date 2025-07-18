#!/bin/bash

echo "🎬 Testing complete video processing pipeline..."
echo ""

# 1. Upload video
echo "1️⃣ UPLOADING VIDEO..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/videos/upload \
  -F "video=@/Users/pjmbair25/Documents/Development/translation_july18/nyc-dubbing-qa/backend/uploads/testvid.mp4" \
  -F "title=Test Video" \
  -F "context=Test video for pipeline")

echo "Upload response: $UPLOAD_RESPONSE"
VIDEO_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"videoId":"[^"]*' | cut -d'"' -f4)

if [ -z "$VIDEO_ID" ]; then
  echo "❌ Failed to upload video"
  exit 1
fi

echo "✅ Video uploaded! ID: $VIDEO_ID"
echo ""

# 2. Transcribe video
echo "2️⃣ TRANSCRIBING VIDEO..."
TRANSCRIBE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/videos/$VIDEO_ID/transcribe \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test video content"}')

echo "Transcribe response (truncated): ${TRANSCRIBE_RESPONSE:0:300}..."

if ! echo "$TRANSCRIBE_RESPONSE" | grep -q '"success":true'; then
  echo "❌ Transcription failed"
  exit 1
fi

echo "✅ Transcription successful!"
echo ""

# Extract first segment for translation
SEGMENT_TEXT=$(echo "$TRANSCRIBE_RESPONSE" | grep -o '"text":"[^"]*' | head -1 | cut -d'"' -f4)

# 3. Translate to Spanish
echo "3️⃣ TRANSLATING TO SPANISH..."
TRANSLATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/translation/translate \
  -H "Content-Type: application/json" \
  -d "{
    \"videoId\": \"$VIDEO_ID\",
    \"targetLanguage\": \"es\",
    \"segments\": [
      {
        \"id\": \"1\",
        \"text\": \"$SEGMENT_TEXT\",
        \"startTime\": 0,
        \"endTime\": 4.02
      }
    ],
    \"context\": \"Test video\"
  }")

echo "Translate response (truncated): ${TRANSLATE_RESPONSE:0:300}..."

if ! echo "$TRANSLATE_RESPONSE" | grep -q '"success":true'; then
  echo "❌ Translation failed"
  exit 1
fi

echo "✅ Translation successful!"
echo ""

# Extract translated text
TRANSLATED_TEXT=$(echo "$TRANSLATE_RESPONSE" | grep -o '"translatedText":"[^"]*' | head -1 | cut -d'"' -f4)

# 4. Generate audio
echo "4️⃣ GENERATING AUDIO..."
AUDIO_RESPONSE=$(curl -s -X POST http://localhost:3000/api/dubbing/generate-audio \
  -H "Content-Type: application/json" \
  -d "{
    \"videoId\": \"$VIDEO_ID\",
    \"segments\": [
      {
        \"id\": \"1\",
        \"text\": \"$TRANSLATED_TEXT\",
        \"startTime\": 0,
        \"endTime\": 4.02
      }
    ],
    \"language\": \"es\",
    \"voice\": \"EXAVITQu4vr4xnSDxMaL\"
  }")

if echo "$AUDIO_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Audio generation successful!"
  echo ""
  echo "🎉 COMPLETE PIPELINE TEST PASSED!"
  echo ""
  echo "Summary:"
  echo "- Original text: $SEGMENT_TEXT"
  echo "- Translated text: $TRANSLATED_TEXT"
  echo "- Audio generated: Yes (base64 encoded)"
else
  echo "❌ Audio generation failed"
  echo "Response: $AUDIO_RESPONSE"
fi