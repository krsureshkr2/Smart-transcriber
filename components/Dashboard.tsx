
import React, { useState, useEffect, useRef } from 'react';
import { VideoUploader } from './VideoUploader';
import { chatWithTranscript } from '../services/geminiService';
import { TranscriptSegment, ChatMessage, SavedPoint, Recording, Attendee } from '../types';

interface DashboardProps {
  onSavePoint: (point: Omit<SavedPoint, 'id' | 'dateSaved'>) => void;
  onSaveRecording: (rec: Omit<Recording, 'id' | 'dateCreated'>) => Recording;
  onUpdateRecording: (rec: Recording) => void;
  initialRecording: Recording | null;
  onClearInitial: () => void;
  processingQueue: { id: string; name: string; status: 'pending' | 'processing' | 'done' | 'error'; projectName: string }[];
  onStartUpload: (files: File[], projectName: string) => void;
}

interface CloudCredentials {
  service: 'google' | 'onedrive' | null;
  username: string;
  password?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  onSavePoint, 
  onSaveRecording,
  onUpdateRecording,
  initialRecording, 
  onClearInitial,
  processingQueue,
  onStartUpload
}) => {
  const [activeRecording, setActiveRecording] = useState<Recording | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isTranscribed, setIsTranscribed] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [fullText, setFullText] = useState("");
  const [subject, setSubject] = useState("");
  const [projectName, setProjectName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);

  // Cloud Sync State
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudCreds, setCloudCreds] = useState<CloudCredentials>({ service: null, username: '' });
  const [syncTarget, setSyncTarget] = useState<'transcript' | 'minutes' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const [newAttendee, setNewAttendee] = useState({ name: '', company: '' });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialRecording) {
      setActiveRecording(initialRecording);
      setTranscript(initialRecording.transcript);
      setFullText(initialRecording.fullText);
      setSubject(initialRecording.subject);
      setProjectName(initialRecording.projectName);
      setMeetingDate(initialRecording.meetingDate || "");
      setRemarks(initialRecording.remarks || "");
      setAttendees(initialRecording.attendees || []);
      setMediaUrl(initialRecording.mediaUrl || null);
      setIsTranscribed(true);
      setChatHistory([]);
    }
  }, [initialRecording]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleAddAttendee = () => {
    if (!newAttendee.name.trim()) return;
    const updated = [...attendees, newAttendee];
    setAttendees(updated);
    setNewAttendee({ name: '', company: '' });
    if (activeRecording) {
      onUpdateRecording({ ...activeRecording, attendees: updated });
    }
  };

  const handleRemoveAttendee = (index: number) => {
    const updated = attendees.filter((_, i) => i !== index);
    setAttendees(updated);
    if (activeRecording) {
      onUpdateRecording({ ...activeRecording, attendees: updated });
    }
  };

  const handleRenameSpeaker = (segmentId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingSpeakerId(null);
      return;
    }
    
    const updatedTranscript = transcript.map(seg => {
      const oldName = transcript.find(s => s.id === segmentId)?.speaker;
      if (seg.speaker === oldName) {
        return { ...seg, speaker: newName };
      }
      return seg;
    });

    setTranscript(updatedTranscript);
    const newFullText = updatedTranscript.map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n');
    setFullText(newFullText);

    if (activeRecording) {
      onUpdateRecording({
        ...activeRecording,
        transcript: updatedTranscript,
        fullText: newFullText
      });
    }
    setEditingSpeakerId(null);
  };

  const handleUpdateMetadata = () => {
    if (activeRecording) {
      onUpdateRecording({
        ...activeRecording,
        subject,
        projectName,
        meetingDate,
        remarks,
        attendees
      });
      setIsEditingMetadata(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isChatting) return;

    const userMsg = userInput.trim();
    setUserInput("");
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatting(true);

    try {
      const response = await chatWithTranscript(userMsg, fullText, chatHistory);
      setChatHistory(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      console.error(error);
      setChatHistory(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error while processing your request." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const startCloudSyncProcess = (type: 'transcript' | 'minutes') => {
    setSyncTarget(type);
    setCloudCreds({ service: null, username: '' });
    setShowCloudModal(true);
  };

  const handleFinalSync = () => {
    if (!cloudCreds.service || !cloudCreds.username || !cloudCreds.password) return;

    setShowCloudModal(false);
    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncProgress(0);

    // Simulated cloud storage upload
    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setSyncStatus('success');
          setIsSyncing(false);
          // Clear credentials for next time
          setCloudCreds({ service: null, username: '' });
          setTimeout(() => setSyncStatus('idle'), 4000);
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  const exportFullTranscriptToWord = () => {
    if (!transcript || transcript.length === 0) return;
    const timestamp = new Date().toLocaleString();
    
    const attendeeRows = attendees.map(a => `
      <tr>
        <td style="padding: 5px; border: 1px solid #e2e8f0;"><strong>${a.name}</strong></td>
        <td style="padding: 5px; border: 1px solid #e2e8f0; color: #64748b;">${a.company || 'N/A'}</td>
      </tr>
    `).join('');

    const transcriptRows = transcript.map(seg => `
      <tr>
        <td style="width: 80pt; font-family: 'Courier New', monospace; font-size: 9pt; color: #64748b; vertical-align: top; border-bottom: 1px solid #f1f5f9; padding: 10px 5px;">[${seg.timestamp}]</td>
        <td style="width: 120pt; font-weight: bold; color: #1e3a8a; vertical-align: top; border-bottom: 1px solid #f1f5f9; padding: 10px 5px;">${seg.speaker || 'Unknown'}</td>
        <td style="vertical-align: top; border-bottom: 1px solid #f1f5f9; padding: 10px 5px;">
          <div style="font-size: 11pt; color: #334155;">${seg.text}</div>
          ${seg.translatedText ? `<div style="font-size: 9pt; color: #94a3b8; font-style: italic; margin-top: 4px;">EN: ${seg.translatedText}</div>` : ''}
        </td>
      </tr>
    `).join('');

    const htmlTemplate = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          body { font-family: 'Times New Roman', Times, serif; line-height: 1.5; color: #1e293b; padding: 1in; }
          .header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 30px; }
          .doc-type { font-size: 10pt; text-transform: uppercase; letter-spacing: 2px; color: #64748b; }
          .doc-title { font-size: 24pt; font-weight: bold; color: #1e3a8a; margin: 5px 0; }
          .section-header { font-size: 14pt; font-weight: bold; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; margin-top: 30px; margin-bottom: 10px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }
          .transcript-table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="doc-type">Meeting Transcript</p>
          <p class="doc-title">${subject || "Discussion Session"}</p>
          <p style="font-size: 9pt; color: #94a3b8;">Generated by VideoScribe Assistant • ${timestamp}</p>
        </div>
        <div class="section-header">Project Summary</div>
        <table class="meta-table">
          <tr><td><strong>Project Name:</strong></td><td>${projectName || "General"}</td></tr>
          <tr><td><strong>Subject:</strong></td><td>${subject || "Uncategorized"}</td></tr>
        </table>
        <div class="section-header">Transcript</div>
        <table class="transcript-table">${transcriptRows}</table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlTemplate], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Meeting Transcript _ ${projectName || "General"}_${new Date().getTime()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportChatToWord = (content: string) => {
    const timestamp = new Date().toLocaleString();
    const htmlTemplate = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><style>body { font-family: sans-serif; padding: 40px; } h2 { color: #1e40af; border-bottom: 1px solid #ccc; }</style></head>
      <body>
        <div style="text-align: center; border-bottom: 4px solid #1d4ed8; padding-bottom: 20px;">
          <h1 style="color: #1d4ed8;">Meeting Minutes</h1>
          <p>Project: ${projectName || "General"}</p>
          <p>Date: ${meetingDate || timestamp}</p>
        </div>
        <div>${content.replace(/\n/g, '<br>')}</div>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlTemplate], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Minutes_${new Date().getTime()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToText = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scribe_Export_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveTranscriptSegment = (seg: TranscriptSegment) => {
    onSavePoint({
      sourceVideo: activeRecording?.name || "Unknown Recording",
      timestamp: seg.timestamp,
      content: `[${seg.speaker || 'Speaker'}] ${seg.text}${seg.translatedText ? ` (EN: ${seg.translatedText})` : ''}`
    });
  };

  const reset = () => {
    setMediaUrl(null);
    setTranscript([]);
    setFullText("");
    setSubject("");
    setProjectName("");
    setMeetingDate("");
    setRemarks("");
    setAttendees([]);
    setChatHistory([]);
    setIsTranscribed(false);
    setActiveRecording(null);
    onClearInitial();
  };

  const isAudioFile = () => {
    if (!activeRecording) return false;
    const name = activeRecording.name.toLowerCase();
    return name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.m4a');
  };

  const isProcessing = processingQueue.some(q => q.status === 'processing' || q.status === 'pending');

  if (!mediaUrl && !isProcessing && !isTranscribed) {
    return (
      <div className="max-w-4xl mx-auto py-12 animate-in fade-in duration-500">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">Workspace</h2>
          <p className="text-gray-400">Add media files to a project for transcription and analysis</p>
        </div>
        <VideoUploader onFilesSelect={onStartUpload} isLoading={false} progressMessage="" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Cloud Integration Modal */}
      {showCloudModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-white">Cloud Authentication</h3>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Storage Provisioning Required</p>
                </div>
                <button onClick={() => setShowCloudModal(false)} className="text-gray-500 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {!cloudCreds.service ? (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400 text-center mb-4">Choose a cloud storage service to activate for this upload.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setCloudCreds({ ...cloudCreds, service: 'google' })}
                      className="flex flex-col items-center gap-3 p-6 bg-gray-950 border border-gray-800 rounded-xl hover:border-blue-500 transition-all group"
                    >
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg viewBox="0 0 24 24" className="w-8 h-8"><path d="M12.502 5.503l.352 1.352 1.352.352-1.352.352-.352 1.352-.352-1.352-1.352-.352 1.352-.352.352-1.352zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-3l-2.5-2.5-2.5 2.5v3h5zm6-6l-2.5-2.5-2.5 2.5v3h5v-3z" fill="#4285F4"/></svg>
                      </div>
                      <span className="text-sm font-bold text-gray-300">Google Drive</span>
                    </button>
                    <button 
                      onClick={() => setCloudCreds({ ...cloudCreds, service: 'onedrive' })}
                      className="flex flex-col items-center gap-3 p-6 bg-gray-950 border border-gray-800 rounded-xl hover:border-blue-500 transition-all group"
                    >
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor"><path d="M11 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zm6-5c0-1.38-1.12-2.5-2.5-2.5S12 5.12 12 6.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5zM12.5 14c-2.48 0-4.5-2.02-4.5-4.5S10.02 5 12.5 5 17 7.02 17 9.5s-2.02 4.5-4.5 4.5zM11 20H4v-1.1c0-2.33 4.67-3.5 7-3.5.58 0 1.33.07 2.11.21.37.07.67.35.79.7.13.35.03.74-.24 1l-1.44 1.44c-.4.4-.64.92-.7 1.48-.05.47-.28.77-.52.77z"/></svg>
                      </div>
                      <span className="text-sm font-bold text-gray-300">OneDrive</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <button onClick={() => setCloudCreds({ ...cloudCreds, service: null })} className="hover:text-blue-300 flex items-center gap-1 text-xs font-bold uppercase">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      Change Service
                    </button>
                  </div>
                  
                  <div className="bg-gray-950 p-4 border border-gray-800 rounded-xl mb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cloudCreds.service === 'google' ? 'bg-white' : 'bg-blue-600'}`}>
                        {cloudCreds.service === 'google' ? (
                          <svg viewBox="0 0 24 24" className="w-5 h-5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor"><path d="M11 11.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5zm6-5c0-1.38-1.12-2.5-2.5-2.5S12 5.12 12 6.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5z"/></svg>
                        )}
                      </div>
                      <span className="text-sm font-bold text-white uppercase tracking-wider">{cloudCreds.service === 'google' ? 'Google Drive' : 'Microsoft OneDrive'}</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">Login ID / Email</label>
                        <input 
                          type="text" 
                          autoFocus
                          value={cloudCreds.username}
                          onChange={(e) => setCloudCreds({ ...cloudCreds, username: e.target.value })}
                          placeholder="your@account.com"
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">Cloud Password</label>
                        <input 
                          type="password" 
                          value={cloudCreds.password || ''}
                          onChange={(e) => setCloudCreds({ ...cloudCreds, password: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleFinalSync}
                    disabled={!cloudCreds.username || !cloudCreds.password}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Activate & Upload
                  </button>
                  <p className="text-[8px] text-gray-600 text-center uppercase tracking-[0.2em] mt-4 italic">Security Note: Credentials are required for each manual sync session.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main UI Header */}
      <div className="flex items-center justify-between bg-gray-900/50 border border-gray-800 p-4 rounded-xl backdrop-blur-sm shadow-sm relative z-20">
        <div className="flex items-center gap-4 flex-1">
          <button onClick={reset} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg font-bold text-sm whitespace-nowrap">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            New Session
          </button>
          <div className="w-[1px] h-8 bg-gray-800 hidden md:block"></div>
          <div className="flex-1 flex items-center gap-4 overflow-hidden">
            {isEditingMetadata ? (
              <div className="flex items-center gap-2 w-full">
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-blue-400 w-1/4 outline-none" />
                <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project" className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 w-1/4 outline-none" />
                <button onClick={handleUpdateMetadata} className="text-green-500 hover:text-green-400 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
              </div>
            ) : (
              <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setIsEditingMetadata(true)}>
                <div className="hidden sm:block">
                  <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Subject</h3>
                  <p className="text-sm font-semibold text-blue-400 truncate max-w-xs">{subject || "Media Scribe"}</p>
                </div>
                <div className="hidden md:block">
                  <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Project</h3>
                  <p className="text-xs text-gray-300">{projectName || "Active Session"}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 ml-4">
           {syncStatus === 'success' && (
             <div className="bg-green-500/20 text-green-500 px-3 py-1 rounded-full text-[10px] font-bold border border-green-500/30 animate-in fade-in duration-300">
               Cloud Sync Success
             </div>
           )}
           <button 
             onClick={() => startCloudSyncProcess('minutes')}
             disabled={!isTranscribed}
             className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg border border-gray-700 text-[10px] font-bold uppercase transition-all shadow-sm disabled:opacity-30"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
             Sync Hub
           </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <div className="bg-black rounded-xl border border-gray-800 overflow-hidden shadow-2xl lg:flex-1 relative group">
            {mediaUrl ? (
              isAudioFile() ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gray-950">
                   <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 border border-blue-500/30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                   </div>
                   <audio src={mediaUrl} controls className="w-full" />
                </div>
              ) : (
                <video src={mediaUrl} controls className="w-full h-full object-contain" />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-700 bg-gray-950">No Media Active</div>
            )}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col shadow-lg h-1/3">
             <div className="px-4 py-2 bg-gray-950 border-b border-gray-800 flex justify-between items-center">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Meeting Attendees</h4>
             </div>
             <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {attendees.map((a, idx) => (
                  <div key={idx} className="p-2 bg-gray-950 rounded text-xs flex justify-between border border-gray-800">
                    <span className="font-bold text-gray-200">{a.name} <span className="font-normal text-gray-500">({a.company})</span></span>
                    <button onClick={() => handleRemoveAttendee(idx)} className="text-red-500 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <input type="text" value={newAttendee.name} onChange={(e) => setNewAttendee({...newAttendee, name: e.target.value})} placeholder="Name" className="bg-gray-950 border border-gray-800 rounded px-2 py-1 text-[10px] text-white outline-none w-1/2" />
                  <input type="text" value={newAttendee.company} onChange={(e) => setNewAttendee({...newAttendee, company: e.target.value})} placeholder="Company" className="bg-gray-950 border border-gray-800 rounded px-2 py-1 text-[10px] text-white outline-none w-1/2" />
                  <button onClick={handleAddAttendee} className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold">Add</button>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg relative">
            {isSyncing && (
              <div className="absolute top-0 left-0 right-0 z-50 bg-blue-600/20 backdrop-blur-sm p-4 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Provisioning Cloud Storage...</span>
                  <span className="text-[10px] font-bold text-white">{syncProgress}%</span>
                </div>
                <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full transition-all duration-150" style={{ width: `${syncProgress}%` }}></div>
                </div>
              </div>
            )}
            <div className="px-4 py-3 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Transcript</h3>
              {transcript.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => startCloudSyncProcess('transcript')} className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded border border-gray-700 transition-all" title="Sync to Cloud">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </button>
                  <button onClick={exportFullTranscriptToWord} className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded transition-all font-bold border border-blue-500/20">
                    Export
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {transcript.map((seg) => (
                <div key={seg.id} className="bg-gray-950/30 p-3 rounded-lg border border-gray-800/50">
                  <div className="flex justify-between mb-1">
                    <span className="text-[9px] font-mono text-blue-400">{seg.timestamp}</span>
                    <button onClick={() => saveTranscriptSegment(seg)} className="text-gray-500 hover:text-green-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg></button>
                  </div>
                  <button onClick={() => setEditingSpeakerId(seg.id)} className="text-[10px] font-bold text-gray-500 uppercase hover:text-blue-400">{seg.speaker || "Unknown Speaker"}</button>
                  <p className="text-sm text-gray-300">{seg.text}</p>
                  {seg.translatedText && <p className="text-xs italic text-gray-500 mt-1"><span className="font-bold text-blue-500/50 mr-1">EN:</span>{seg.translatedText}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Clarification Box</h3>
              {chatHistory.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => startCloudSyncProcess('minutes')} className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded border border-gray-700 transition-all" title="Sync Minutes to Cloud">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                  </button>
                  <button onClick={() => exportChatToWord(chatHistory.filter(m => m.role === 'model').map(m => m.content).join('\n\n'))} className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded font-bold border border-blue-500/20">Minutes</button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950/20 custom-scrollbar">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[90%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none'}`}>
                    {msg.content.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                  </div>
                </div>
              ))}
              {isChatting && <div className="text-xs text-blue-500 animate-pulse">Assistant is thinking...</div>}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleChat} className="p-3 bg-gray-900 border-t border-gray-800 flex gap-2">
              <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Ask about this session..." className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500" disabled={isChatting || !isTranscribed} />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white w-10 h-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-20" disabled={isChatting || !isTranscribed || !userInput.trim()}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
