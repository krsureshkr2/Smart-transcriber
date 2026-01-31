
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
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [projectName, setProjectName] = useState("Default Project");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelect(Array.from(files), projectName || "Untitled Project");
    }
  };

  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = mediaStream;
      }
      
      const recorder = new MediaRecorder(mediaStream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const file = new File([blob], `recording_${Date.now()}.mp4`, { type: 'video/mp4' });
        onFilesSelect([file], projectName || "Live Recording");
        
        mediaStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Could not access camera/microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
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
      <div className="w-full flex flex-col items-center justify-center p-6 border-2 border-red-500/50 rounded-2xl bg-gray-900 shadow-2xl">
        <video ref={videoPreviewRef} autoPlay muted className="w-full max-w-md aspect-video rounded-lg mb-6 bg-black object-cover scale-x-[-1]" />
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
            <span className="text-red-500 font-bold uppercase tracking-widest text-xs">Recording Live</span>
          </div>
          <button 
            onClick={stopRecording}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-all transform hover:scale-105 shadow-lg"
          >
            Stop & Save to Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-xl">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Project Name</label>
        <input 
          type="text" 
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g. Q1 Marketing Review"
          className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50 hover:bg-gray-900 transition-all cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" accept="video/*,audio/*" multiple className="hidden" ref={fileInputRef} onChange={handleChange} />
          <div className="w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">Batch Upload</h3>
          <p className="text-gray-500 text-xs mt-1 text-center">Select any MP3, MP4, or Media files</p>
        </div>

        <div 
          className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50 hover:bg-gray-900 transition-all cursor-pointer group"
          onClick={startRecording}
        >
          <div className="w-14 h-14 bg-red-600/10 text-red-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">Record Clip</h3>
          <p className="text-gray-500 text-xs mt-1 text-center">Add a live recording to the project</p>
        </div>
      </div>
    </div>
  );
};
