
import React, { useRef, useState } from 'react';

interface VideoUploaderProps {
  onFilesSelect: (files: File[], projectName: string) => void;
  isLoading: boolean;
  progressMessage: string;
}

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
      
      if (useSystemAudio && navigator.mediaDevices.getDisplayMedia) {
        // Attempt to capture system audio (best for desktop calls)
        mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, // video is often required for getDisplayMedia even if we only want audio
          audio: true 
        });
        // If we only wanted audio, we can stop the video tracks if the user allows
      } else {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: mode === 'video', 
          audio: true 
        });
      }

      setStream(mediaStream);
      setRecordingMode(mode);
      if (videoPreviewRef.current && mode === 'video') {
        videoPreviewRef.current.srcObject = mediaStream;
      }
      
      const recorder = new MediaRecorder(mediaStream, {
        mimeType: mode === 'video' ? 'video/webm' : 'audio/webm'
      });
      const localChunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          localChunks.push(e.data);
          setChunks(prev => [...prev, e.data]);
        }
      };

      recorder.onstop = () => {
        const type = mode === 'video' ? 'video/mp4' : 'audio/mp3';
        const extension = mode === 'video' ? 'mp4' : 'mp3';
        const blob = new Blob(localChunks, { type });
        const file = new File([blob], `call_record_${Date.now()}.${extension}`, { type });
        onFilesSelect([file], projectName || (mode === 'audio' ? "Phone Call Log" : "Live Recording"));
        
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
        setChunks([]);
      };

      recorder.start(1000); // Capture in 1s slices to allow robust chunking
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Could not access media devices. Ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
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
        <p className="text-xl font-medium text-white mb-2">Processing Batch...</p>
        <p className="text-gray-400 animate-pulse text-sm">{progressMessage}</p>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-6 border-2 border-red-500/50 rounded-2xl bg-gray-900 shadow-2xl animate-in fade-in duration-300">
        {recordingMode === 'video' ? (
          <video ref={videoPreviewRef} autoPlay muted className="w-full max-w-md aspect-video rounded-lg mb-6 bg-black object-cover scale-x-[-1]" />
        ) : (
          <div className="w-full max-w-md aspect-video rounded-lg mb-6 bg-gray-950 flex flex-col items-center justify-center border border-gray-800">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
               <div className={`w-12 h-12 bg-red-600 rounded-full flex items-center justify-center ${!isPaused ? 'animate-pulse' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
               </div>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              {isPaused ? "Call Recording Paused" : "Live Call Capture Active"}
            </p>
          </div>
        )}
        
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isPaused ? 'bg-gray-600' : 'bg-red-500 animate-ping'}`}></span>
            <span className={`${isPaused ? 'text-gray-500' : 'text-red-500'} font-bold uppercase tracking-widest text-xs`}>
              {isPaused ? "Paused" : "Recording Live"}
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
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-all transform hover:scale-105 shadow-lg shadow-red-500/20"
            >
              Stop & Sync to Hub
            </button>
          </div>
          <p className="text-[10px] text-gray-600 italic">Recording will be automatically transcribed and saved to Knowledge Base.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Project Name</label>
        <input 
          type="text" 
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g. Sales Call 102"
          className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Batch Upload */}
        <div 
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50 hover:bg-gray-900 transition-all cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" accept="video/*,audio/*" multiple className="hidden" ref={fileInputRef} onChange={handleChange} />
          <div className="w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Batch Upload</h3>
          <p className="text-gray-500 text-[10px] mt-1 text-center">MP3, WAV, MP4, MOV</p>
        </div>

        {/* Record Video Clip */}
        <div 
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50 hover:bg-gray-900 transition-all cursor-pointer group"
          onClick={() => startRecording('video')}
        >
          <div className="w-14 h-14 bg-purple-600/10 text-purple-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Record Video</h3>
          <p className="text-gray-500 text-[10px] mt-1 text-center">Camera + Mic Capture</p>
        </div>

        {/* Record Audio Call */}
        <div 
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-red-500/20 rounded-2xl bg-red-950/5 hover:bg-red-950/10 transition-all cursor-pointer group"
          onClick={() => startRecording('audio')}
        >
          <div className="w-14 h-14 bg-red-600/10 text-red-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Record Call</h3>
          <p className="text-gray-500 text-[10px] mt-1 text-center">Audio-only Session</p>
        </div>
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={() => startRecording('audio', true)}
          className="text-[10px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1.5 px-4 py-2 bg-blue-500/5 rounded-lg border border-blue-500/10 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7h-3.771l-.125-.498a1 1 0 00-.973-.752H9.869a1 1 0 00-.973.752l-.125.498z" clipRule="evenodd" />
          </svg>
          Record Screen Call (includes System Audio)
        </button>
      </div>
    </div>
  );
};
