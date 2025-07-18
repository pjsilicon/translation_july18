#!/bin/bash

echo "🎬 Testing full video processing pipeline..."
echo ""

# 1. Test Whisper transcription
echo "1️⃣ TESTING TRANSCRIPTION..."
TRANSCRIBE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/videos/5720c88f-5a49-4684-8c14-7a0f6d1ceef5/transcribe \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test video content"}')

echo "Response: $TRANSCRIBE_RESPONSE"
echo ""

# Check if transcription was successful
if echo "$TRANSCRIBE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Transcription successful!"
  
  # 2. Test translation
  echo ""
  echo "2️⃣ TESTING TRANSLATION..."
  TRANSLATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/translation/translate \
    -H "Content-Type: application/json" \
    -d '{
      "videoId": "5720c88f-5a49-4684-8c14-7a0f6d1ceef5",
      "targetLanguage": "es",
      "segments": [
        {
          "id": "1",
          "text": "We built FluentReach because dubbing is just the first step.",
          "startTime": 0,
          "endTime": 4.02
        }
      ],
      "context": "Test video"
    }')
  
  echo "Response (truncated): ${TRANSLATE_RESPONSE:0:200}..."
  
  if echo "$TRANSLATE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Translation successful!"
    
    # 3. Test audio generation
    echo ""
    echo "3️⃣ TESTING AUDIO GENERATION..."
    AUDIO_RESPONSE=$(curl -s -X POST http://localhost:3000/api/dubbing/generate-audio \
      -H "Content-Type: application/json" \
      -d '{
        "videoId": "5720c88f-5a49-4684-8c14-7a0f6d1ceef5",
        "segments": [
          {
            "id": "1",
            "text": "Construimos FluentReach porque el doblaje es solo el primer paso.",
            "startTime": 0,
            "endTime": 4.02
          }
        ],
        "language": "es",
        "voice": "EXAVITQu4vr4xnSDxMaL"
      }')
    
    if echo "$AUDIO_RESPONSE" | grep -q '"success":true'; then
      echo "✅ Audio generation successful!"
      echo ""
      echo "🎉 ALL PIPELINE TESTS PASSED!"
    else
      echo "❌ Audio generation failed"
    fi
  else
    echo "❌ Translation failed"
  fi
else
  echo "❌ Transcription failed"
fi