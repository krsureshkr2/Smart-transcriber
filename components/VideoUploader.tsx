
import React, { useRef, useState, useEffect } from 'react';

interface VideoUploaderProps {
  onFilesSelect: (files: File[], projectName: string) => void;
  isLoading: boolean;
  progressMessage: string;
}

const AudioVisualizer: React.FC<{ stream: MediaStream | null; isPaused: boolean }> = ({ stream, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);

  useEffect(() => {
    if (!stream || isPaused) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const r = 59;
        const g = 130;
        const b = 246;

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${dataArray[i] / 255 + 0.2})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      audioContext.close();
    };
  }, [stream, isPaused]);

  return <canvas ref={canvasRef} width={300} height={60} className="w-full h-16 opacity-50" />;
};

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onFilesSelect, isLoading, progressMessage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'video' | 'audio'>('video');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [projectName, setProjectName] = useState("Default Project");
  const [chunks, setChunks] = useState<Blob[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelect(Array.from(files), projectName || "Untitled Project");
    }
  };

  const startRecording = async (mode: 'video' | 'audio', useSystemAudio = false) => {
    try {
      let mediaStream: MediaStream;
      
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 44100
      };

      if (useSystemAudio && navigator.mediaDevices.getDisplayMedia) {
        mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true,
          audio: audioConstraints 
        });
      } else {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: mode === 'video' ? { width: 1280, height: 720 } : false, 
          audio: audioConstraints 
        });
      }

      setStream(mediaStream);
      setRecordingMode(mode);
      if (videoPreviewRef.current && mode === 'video') {
        videoPreviewRef.current.srcObject = mediaStream;
      }
      
      // Select best supported mime type
      const mimeType = mode === 'video' 
        ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm')
        : (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/ogg');

      const recorder = new MediaRecorder(mediaStream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      const localChunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          localChunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalType = mode === 'video' ? 'video/mp4' : 'audio/mp3';
        const extension = mode === 'video' ? 'mp4' : 'mp3';
        const blob = new Blob(localChunks, { type: finalType });
        const file = new File([blob], `capture_${Date.now()}.${extension}`, { type: finalType });
        onFilesSelect([file], projectName || (mode === 'audio' ? "Phone Call Log" : "Live Recording"));
        
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

      recorder.start(1000); 
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Could not access media devices. Please ensure microphone/camera permissions are enabled.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const togglePause = () => {
    if (mediaRecorder) {
      if (isPaused) {
        mediaRecorder.resume();
        setIsPaused(false);
      } else {
        mediaRecorder.pause();
        setIsPaused(true);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-blue-500/30 rounded-2xl bg-gray-900/50">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-medium text-white mb-2">Syncing with AI Hub...</p>
        <p className="text-gray-400 animate-pulse text-sm">{progressMessage}</p>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-6 border-2 border-red-500/50 rounded-2xl bg-gray-900 shadow-2xl animate-in fade-in duration-300">
        {recordingMode === 'video' ? (
          <div className="relative w-full max-w-md aspect-video rounded-lg mb-6 overflow-hidden bg-black shadow-2xl">
            <video ref={videoPreviewRef} autoPlay muted className="w-full h-full object-cover scale-x-[-1]" />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-black/40 px-2 py-1 rounded backdrop-blur-sm">Live Cam</span>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md aspect-video rounded-lg mb-6 bg-gray-950 flex flex-col items-center justify-center border border-gray-800 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <AudioVisualizer stream={stream} isPaused={isPaused} />
            </div>
            <div className="z-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                 <div className={`w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 ${!isPaused ? 'animate-pulse' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                 </div>
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest bg-black/50 px-4 py-1 rounded-full backdrop-blur-sm">
                {isPaused ? "Call Recording Paused" : "Live Capture Optimized"}
              </p>
            </div>
          </div>
        )}
        
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isPaused ? 'bg-gray-600' : 'bg-red-500 animate-ping'}`}></span>
            <span className={`${isPaused ? 'text-gray-500' : 'text-red-500'} font-bold uppercase tracking-widest text-xs`}>
              {isPaused ? "Paused" : "Recording Audio"}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={togglePause}
              className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 border ${
                isPaused 
                ? 'bg-green-600/20 border-green-500/50 text-green-500 hover:bg-green-600 hover:text-white' 
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {isPaused ? (
                <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg> Resume</>
              ) : (
                <><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg> Pause</>
              )}
            </button>
            <button 
              onClick={stopRecording}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-all transform hover:scale-105 shadow-xl shadow-red-500/30"
            >
              Stop & Transcribe
            </button>
          </div>
          <p className="text-[10px] text-gray-600 font-mono">ENHANCED AUDIO ENGINE ACTIVE • NOISE SUPPRESSION ENABLED</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Active Session Title</label>
        <input 
          type="text" 
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g. Q4 Strategy Call"
          className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Batch Upload */}
        <div 
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50 hover:bg-gray-900 transition-all cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" accept="video/*,audio/*" multiple className="hidden" ref={fileInputRef} onChange={handleChange} />
          <div className="w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Batch Upload</h3>
          <p className="text-gray-500 text-[10px] mt-1 text-center">Sync existing media files</p>
        </div>

        {/* Record Video Clip */}
        <div 
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50 hover:bg-gray-900 transition-all cursor-pointer group"
          onClick={() => startRecording('video')}
        >
          <div className="w-14 h-14 bg-purple-600/10 text-purple-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-purple-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Record Meeting</h3>
          <p className="text-gray-500 text-[10px] mt-1 text-center">Video + High-Fi Audio</p>
        </div>

        {/* Record Audio Call */}
        <div 
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-red-500/20 rounded-2xl bg-red-950/5 hover:bg-red-950/10 transition-all cursor-pointer group"
          onClick={() => startRecording('audio')}
        >
          <div className="w-14 h-14 bg-red-600/10 text-red-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-red-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Record Call</h3>
          <p className="text-gray-500 text-[10px] mt-1 text-center">Fast Audio Capture</p>
        </div>
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={() => startRecording('audio', true)}
          className="text-[10px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1.5 px-6 py-3 bg-blue-500/5 rounded-full border border-blue-500/10 transition-all hover:bg-blue-500/10 shadow-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7h-3.771l-.125-.498a1 1 0 00-.973-.752H9.869a1 1 0 00-.973.752l-.125.498z" clipRule="evenodd" />
          </svg>
          Capture Digital Phone Call (System Audio)
        </button>
      </div>
    </div>
  );
};
