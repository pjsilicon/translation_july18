#!/bin/bash

VIDEO_FILE_PATH="../test_data/testvid.mp4"

echo "🎬 Testing full video processing pipeline..."
echo ""

# 1. Test video upload
echo "1️⃣ TESTING VIDEO UPLOAD..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/videos/upload \
  -F "video=@${VIDEO_FILE_PATH}" \
  -F "title=Test Video" \
  -F "context=A test video for the pipeline")

echo "Response: $UPLOAD_RESPONSE"
echo ""

VIDEO_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"videoId":"[^"]*' | cut -d'"' -f4)

if [ -z "$VIDEO_ID" ]; then
  echo "❌ Video upload failed or could not parse videoId."
  exit 1
fi

echo "✅ Video uploaded successfully! Video ID: $VIDEO_ID"

# 2. Test Whisper transcription
echo ""
echo "2️⃣ TESTING TRANSCRIPTION..."
TRANSCRIBE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/videos/${VIDEO_ID}/transcribe \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test video content"}')

echo "Response: $TRANSCRIBE_RESPONSE"
echo ""

# Check if transcription was successful
if echo "$TRANSCRIBE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Transcription successful!"
  
  # 3. Test translation
  echo ""
  echo "3️⃣ TESTING TRANSLATION..."
  
  TRANSLATION_SEGMENTS=$(echo "$TRANSCRIBE_RESPONSE" | jq '.data.segments')
  
  TRANSLATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/translation/translate \
    -H "Content-Type: application/json" \
    -d "{
      \"videoId\": \"$VIDEO_ID\",
      \"targetLanguage\": \"es\",
      \"segments\": $TRANSLATION_SEGMENTS,
      \"context\": \"Test video\"
    }")
  
  echo "Response (truncated): ${TRANSLATE_RESPONSE:0:200}..."
  echo "Full Translation Response: $TRANSLATE_RESPONSE"
  
  if echo "$TRANSLATE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Translation successful!"
    
    # 4. Test audio generation
    echo ""
    echo "4️⃣ TESTING AUDIO GENERATION..."

    # Transform the translation output to match the structure expected by the audio generation endpoint
    AUDIO_SEGMENTS=$(echo "$TRANSLATE_RESPONSE" | jq '.data.translations | map({id: .id, text: .translatedText, startTime: .startTime, endTime: .endTime})')

    AUDIO_RESPONSE=$(curl -s -X POST http://localhost:3000/api/dubbing/generate-audio \
      -H "Content-Type: application/json" \
      -d "{
        \"videoId\": \"$VIDEO_ID\",
        \"segments\": $AUDIO_SEGMENTS,
        \"language\": \"es\",
        \"voice\": \"EXAVITQu4vr4xnSDxMaL\"
      }")
    
    if echo "$AUDIO_RESPONSE" | grep -q '"success":true'; then
      echo "✅ Audio generation successful!"
      echo ""
      echo "🎉 ALL PIPELINE TESTS PASSED!"
    else
      echo "❌ Audio generation failed"
      echo "Response: $AUDIO_RESPONSE"
    fi
  else
    echo "❌ Translation failed"
    echo "Response: $TRANSLATE_RESPONSE"
  fi
else
  echo "❌ Transcription failed"
fi