import React, { useState, useEffect } from 'react';
import { Upload, Play, Check, AlertCircle, Globe, Mic, FileText, Download, RefreshCw, ChevronRight, CheckCircle2 } from 'lucide-react';
import { videoAPI, translationAPI, audioAPI, qaAPI } from './services/api';
import toast, { Toaster } from 'react-hot-toast';

const App = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<any[]>([]);
  const [translations, setTranslations] = useState<any[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('es');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [videoContext, setVideoContext] = useState('');
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Fetch available voices on mount
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await audioAPI.getVoices();
        if (response.success && response.data?.voices && response.data.voices.length > 0) {
          setVoices(response.data.voices);
          setSelectedVoice(response.data.voices[0].voice_id);
        } else {
          setVoices([]);
          setSelectedVoice('');
          toast.error('Could not fetch voices. Please try again later.');
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
        setVoices([]);
        setSelectedVoice('');
        toast.error('Could not fetch voices. Please try again later.');
      }
    };
    
    fetchVoices();
  }, []);
  
  // NYC Local Law 30 Languages
  const languages = [
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'bn', name: 'Bengali', flag: '🇧🇩' },
    { code: 'ht', name: 'Haitian Creole', flag: '🇭🇹' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' }
  ];


  const steps = [
    { id: 1, name: 'Upload Video', icon: Upload },
    { id: 2, name: 'Transcription', icon: FileText },
    { id: 3, name: 'Translation & QA', icon: Globe },
    { id: 4, name: 'Generate Audio', icon: Mic }
  ];

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setIsProcessing(true);
      setProcessingMessage('Uploading video...');
      
      try {
        // Upload the video
        const uploadResponse = await videoAPI.upload(file, {
          title: file.name,
          context: videoContext
        });
        
        const uploadedVideoId = uploadResponse.data.videoId;
        setVideoId(uploadedVideoId);
        
        // Start transcription
        setProcessingMessage('Extracting audio and transcribing with Whisper AI...');
        await videoAPI.transcribe(uploadedVideoId, {
          prompt: videoContext
        });
        
        // Get transcription results
        const transcriptionData = await videoAPI.getTranscription(uploadedVideoId);
        setTranscription(transcriptionData.data.segments || []);
        
        setIsProcessing(false);
        setCurrentStep(2);
        toast.success('Video uploaded and transcribed successfully!');
      } catch (error: any) {
        console.error('Upload error:', error);
        setIsProcessing(false);
        toast.error(error.response?.data?.error || 'Failed to process video');
      }
    }
  };

  const handleProceedToTranslation = async () => {
    if (!videoId) return;
    
    setIsProcessing(true);
    setProcessingMessage('Translating with AI...');
    
    try {
      const response = await translationAPI.translate({
        videoId,
        targetLanguage: selectedLanguage,
        segments: transcription.map((seg: any) => ({
          id: seg.id,
          text: seg.text,
          startTime: seg.startTime,
          endTime: seg.endTime
        })),
        context: videoContext
      });
      
      // Map the API response to the expected format
      const mappedTranslations = response.data.translations.map((trans: any) => ({
        id: trans.id,
        text: trans.originalText,
        translation: trans.translatedText,
        confidence: trans.confidence,
        qaStatus: trans.qaStatus,
        startTime: transcription.find((t: any) => t.id === trans.id)?.startTime || 0,
        endTime: transcription.find((t: any) => t.id === trans.id)?.endTime || 0,
        originalText: trans.originalText
      }));
      
      setTranslations(mappedTranslations);
      setIsProcessing(false);
      setCurrentStep(3);
      toast.success('Translation completed!');
    } catch (error: any) {
      console.error('Translation error:', error);
      setIsProcessing(false);
      toast.error(error.response?.data?.error || 'Failed to translate');
    }
  };

  const handleTranslationEdit = async (segmentId: string, newTranslation: string) => {
    setTranslations((prev: any[]) => prev.map((seg: any) => 
      seg.id === segmentId ? { ...seg, translation: newTranslation, qaStatus: 'edited' } : seg
    ));
  };

  const handleApproveSegment = async (segmentId: string) => {
    if (!videoId) return;
    
    try {
      await qaAPI.approveSegment(videoId, segmentId);
      setTranslations((prev: any[]) => prev.map((seg: any) => 
        seg.id === segmentId ? { ...seg, qaStatus: 'approved' } : seg
      ));
      toast.success('Segment approved');
    } catch (error) {
      toast.error('Failed to approve segment');
    }
  };

  const handleGenerateAudio = async () => {
    if (!videoId) return;
    
    setIsProcessing(true);
    setProcessingMessage('Generating audio with ElevenLabs...');
    
    try {
      const response = await audioAPI.generateAudio({
        videoId,
        segments: translations.map((seg: any) => ({
          id: seg.id,
          text: seg.translation,
          startTime: seg.startTime,
          endTime: seg.endTime
        })),
        voice: selectedVoice,
        language: selectedLanguage
      });
      
      setAudioUrl(response.data.audioUrl);
      setIsProcessing(false);
      setCurrentStep(4);
      toast.success('Audio generation completed!');
    } catch (error: any) {
      console.error('Audio generation error:', error);
      setIsProcessing(false);
      toast.error(error.response?.data?.error || 'Failed to generate audio');
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-4">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`flex items-center ${currentStep >= step.id ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
              currentStep >= step.id ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white'
            }`}>
              <step.icon className="w-5 h-5" />
            </div>
            <span className="ml-2 text-sm font-medium">{step.name}</span>
          </div>
          {index < steps.length - 1 && (
            <ChevronRight className="w-5 h-5 mx-4 text-gray-300" />
          )}
        </div>
      ))}
    </div>
  );

  const VideoUploadSection = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Video Context</h3>
          <span className="text-sm text-gray-500">Helps improve transcription accuracy</span>
        </div>
        <textarea
          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="e.g., Mayor's address on public safety initiatives, formal government communication..."
          value={videoContext}
          onChange={(e) => setVideoContext(e.target.value)}
        />
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Upload Government Video</h3>
          <p className="text-gray-600 mb-6">Upload the video you want to translate for NYC residents</p>
          
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="hidden"
            id="video-upload"
            disabled={isProcessing}
          />
          <label
            htmlFor="video-upload"
            className={`inline-flex items-center px-6 py-3 rounded-lg cursor-pointer transition-colors ${
              isProcessing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Upload className="w-5 h-5 mr-2" />
            {isProcessing ? 'Processing...' : 'Choose Video File'}
          </label>
          
          {videoFile && (
            <div className="mt-4 text-sm text-gray-600">
              Selected: {videoFile.name}
            </div>
          )}
          
          <div className="mt-6 text-sm text-gray-500">
            Supported formats: MP4, MOV, AVI • Max size: 2GB
          </div>
        </div>
      </div>
    </div>
  );

  const TranscriptionView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Transcription Results</h3>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {transcription.length === 0 ? (
            <p className="text-gray-500">No transcription data available</p>
          ) : (
            transcription.map((segment, index) => (
              <div key={segment.id || index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">
                    {new Date(segment.startTime * 1000).toISOString().substr(14, 5)} - 
                    {new Date(segment.endTime * 1000).toISOString().substr(14, 5)}
                  </span>
                  {segment.confidence && (
                    <span className="text-sm text-gray-600">
                      Confidence: {(segment.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-sm">{segment.text}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Select Target Language</h3>
          <span className="text-sm text-gray-500">NYC Local Law 30 Languages</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setSelectedLanguage(lang.code)}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedLanguage === lang.code
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{lang.flag}</div>
              <div className="text-sm font-medium">{lang.name}</div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleProceedToTranslation}
        disabled={isProcessing || transcription.length === 0}
        className={`w-full py-3 rounded-lg transition-colors flex items-center justify-center ${
          isProcessing || transcription.length === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isProcessing ? 'Processing...' : 'Proceed to Translation & QA'}
        <ChevronRight className="w-5 h-5 ml-2" />
      </button>
    </div>
  );

  const TranslationQAView = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Translation & QA Review</h3>
            <p className="text-sm text-gray-600 mt-1">Review and edit translations before audio generation</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">AI Models:</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">GPT-4</span>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">Gemini Pro</span>
          </div>
        </div>

        {translations.map((segment) => (
          <div key={segment.id} className="border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-500">
                  {new Date(segment.startTime * 1000).toISOString().substr(14, 5)} - 
                  {new Date(segment.endTime * 1000).toISOString().substr(14, 5)}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Confidence:</span>
                  <div className="flex items-center">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          segment.confidence > 0.9 ? 'bg-green-500' : 
                          segment.confidence > 0.8 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${segment.confidence * 100}%` }}
                      />
                    </div>
                    <span className="ml-2 text-sm font-medium">{(segment.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {segment.qaStatus === 'approved' && (
                  <span className="flex items-center text-green-600 text-sm">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approved
                  </span>
                )}
                {segment.qaStatus === 'needs-review' && (
                  <span className="flex items-center text-yellow-600 text-sm">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Needs Review
                  </span>
                )}
                {segment.qaStatus === 'edited' && (
                  <span className="flex items-center text-blue-600 text-sm">
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Edited
                  </span>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">English (Original)</label>
                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  {segment.originalText || segment.text}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {languages.find(l => l.code === selectedLanguage)?.name} (Translation)
                </label>
                {editingSegment === segment.id ? (
                  <textarea
                    className="w-full p-3 border border-blue-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    defaultValue={segment.translation}
                    onBlur={(e) => {
                      handleTranslationEdit(segment.id, e.target.value);
                      setEditingSegment(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <div
                    className="p-3 bg-blue-50 rounded-lg text-sm cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => setEditingSegment(segment.id)}
                  >
                    {segment.translation}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <button
                onClick={() => handleApproveSegment(segment.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  segment.qaStatus === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Check className="w-4 h-4 inline mr-1" />
                Approve Translation
              </button>
              <button className="text-sm text-gray-500 hover:text-gray-700">
                Request AI Re-translation
              </button>
            </div>
          </div>
        ))}

        <div className="mt-6">
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Voice Selection</label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {voices.length > 0 ? (
                voices.map((voice: any) => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name} - {voice.labels?.accent || 'Unknown accent'} ({voice.labels?.gender || 'Unknown'})
                  </option>
                ))
              ) : (
                <option value={selectedVoice}>Default Voice</option>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">Select the voice for audio generation</p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {translations.filter(s => s.qaStatus === 'approved').length} of {translations.length} segments approved
            </div>
            <button
              onClick={handleGenerateAudio}
              disabled={translations.some(s => s.qaStatus !== 'approved')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center ${
                translations.every(s => s.qaStatus === 'approved')
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Generate Audio
              <Mic className="w-5 h-5 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const AudioGenerationView = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Audio Generation Complete</h3>
        <p className="text-gray-600 mb-6">
          Your translated audio for {languages.find(l => l.code === selectedLanguage)?.name} is ready
        </p>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium">Voice Model</span>
            <span className="text-sm text-gray-600">{voices.find(v => v.voice_id === selectedVoice)?.name || 'Default Voice'}</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium">Duration</span>
            <span className="text-sm text-gray-600">{
              (translations.reduce((acc, seg) => acc + (seg.endTime - seg.startTime), 0)).toFixed(1)
            }s</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Quality Check</span>
            <span className="text-sm text-green-600">Passed</span>
          </div>
        </div>

        <div className="flex space-x-3 justify-center">
          <button 
            onClick={() => {
              if (audioUrl) {
                const audio = new Audio(audioUrl);
                audio.play();
              }
            }}
            disabled={!audioUrl}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:bg-gray-400">
            <Play className="w-5 h-5 mr-2" />
            Preview Audio
          </button>
          <a
            href={audioUrl || '#'}
            download={`translated_audio_${videoId}.mp3`}
            className={`px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center ${!audioUrl ? 'pointer-events-none opacity-50' : ''}`}
          >
            <Download className="w-5 h-5 mr-2" />
            Download Audio
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                  NYC
                </div>
                <div className="ml-3">
                  <h1 className="text-xl font-semibold">NYC Translation QA</h1>
                  <p className="text-sm text-gray-500">AI-Powered Video Dubbing Quality Assurance</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">NYC Government</span>
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StepIndicator />
        
        {isProcessing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-700">{processingMessage}</span>
          </div>
        )}

        {currentStep === 1 && <VideoUploadSection />}
        {currentStep === 2 && <TranscriptionView />}
        {currentStep === 3 && <TranslationQAView />}
        {currentStep === 4 && <AudioGenerationView />}
      </main>
      <Toaster position="top-right" />
    </div>
  );
};

export default App;