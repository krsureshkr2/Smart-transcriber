
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

  const exportToText = (content: string) => {
    const timestamp = new Date().toLocaleString();
    const attendeeStr = attendees.map(a => `${a.name} (${a.company || 'N/A'})`).join(', ');
    const professionalContent = `
=========================================
VIDEO SCRIBE ASSISTANT: BRIEFING NOTE
=========================================
Exported On: ${timestamp}
Project: ${projectName || "Active Session"}
Subject: ${subject}
Meeting Date: ${meetingDate}
Attendees: ${attendeeStr || "None listed"}
-----------------------------------------
ANALYSIS SUMMARY:
${content}
-----------------------------------------
Manual Remarks: ${remarks || "None"}
=========================================
    `.trim();

    const blob = new Blob([professionalContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scribe_Summary_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportFullTranscriptToWord = () => {
    if (!transcript || transcript.length === 0) return;
    const timestamp = new Date().toLocaleString();
    
    const rows = transcript.map(seg => `
      <tr>
        <td style="width: 10%; font-family: 'Courier New', monospace; font-size: 9pt; color: #4b5563; vertical-align: top; border-bottom: 1px solid #e5e7eb; padding: 10px 0;">[${seg.timestamp}]</td>
        <td style="width: 15%; font-weight: bold; color: #1e40af; vertical-align: top; border-bottom: 1px solid #e5e7eb; padding: 10px 0;">${seg.speaker || 'Unknown'}</td>
        <td style="width: 75%; color: #1f2937; vertical-align: top; border-bottom: 1px solid #e5e7eb; padding: 10px 0;">
          <div style="margin-bottom: 4px;">${seg.text}</div>
          ${seg.translatedText ? `<div style="font-size: 9pt; color: #6b7280; font-style: italic;">(EN: ${seg.translatedText})</div>` : ''}
        </td>
      </tr>
    `).join('');

    const attendeeList = attendees.map(a => `<li style="font-size: 10pt;">${a.name} - <span style="color: #64748b;">${a.company || 'N/A'}</span></li>`).join('');

    const htmlTemplate = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.6; }
          .title { color: #2563eb; font-size: 22pt; font-weight: bold; margin-bottom: 5px; }
          .subtitle { color: #64748b; font-size: 11pt; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; margin-bottom: 30px; }
          .meta-item { font-size: 10pt; margin-bottom: 4px; }
          .transcript-table { width: 100%; border-collapse: collapse; }
        </style>
      </head>
      <body>
        <p class="title">Verbatim Transcription</p>
        <p class="subtitle">Generated by VideoScribe Assistant</p>
        
        <div class="meta-box">
          <p class="meta-item"><strong>Exported:</strong> ${timestamp}</p>
          <p class="meta-item"><strong>Project:</strong> ${projectName || "General"}</p>
          <p class="meta-item"><strong>Subject:</strong> ${subject || "Untitled"}</p>
          <p class="meta-item"><strong>Meeting Date:</strong> ${meetingDate || "Not recorded"}</p>
          <p class="meta-item"><strong>Attendees:</strong></p>
          <ul style="margin: 5px 0;">${attendeeList || 'None listed'}</ul>
        </div>

        <table class="transcript-table">
          ${rows}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlTemplate], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Verbatim_Transcript_${new Date().getTime()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportChatToWord = (content: string) => {
    const timestamp = new Date().toLocaleString();
    
    // Convert double asterisk headers and lists to professional Word HTML
    const formattedContent = content.split('\n').map(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        return `<h2 style="color: #1e40af; font-size: 14pt; margin-top: 25px; border-bottom: 2px solid #3b82f6; padding-bottom: 3px; font-variant: small-caps;">${trimmedLine.replace(/\*\*/g, '')}</h2>`;
      }
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        return `<li style="margin-bottom: 6px; list-style-type: disc; color: #1f2937;">${trimmedLine.replace(/^[-*]\s*/, '')}</li>`;
      }
      if (trimmedLine.length > 0) {
        return `<p style="margin-bottom: 12px; text-align: justify; color: #1f2937;">${trimmedLine}</p>`;
      }
      return '';
    }).join('');

    const attendeeList = attendees.map(a => `
      <tr>
        <td style="padding: 4px 0; font-size: 10pt; border-bottom: 1px solid #f1f5f9;"><strong>${a.name}</strong></td>
        <td style="padding: 4px 0; font-size: 10pt; color: #64748b; border-bottom: 1px solid #f1f5f9; font-style: italic;">${a.company || 'N/A'}</td>
      </tr>
    `).join('');

    const htmlTemplate = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Briefing Note</title>
        <style>
          body { font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif; line-height: 1.6; color: #1e293b; padding: 40px; }
          .header { border-bottom: 4px solid #1d4ed8; padding-bottom: 20px; margin-bottom: 40px; }
          .title { color: #1d4ed8; font-size: 26pt; font-weight: bold; margin: 0; text-transform: uppercase; }
          .meta-grid { margin-top: 20px; width: 100%; }
          .meta-label { font-weight: bold; color: #475569; font-size: 9pt; text-transform: uppercase; width: 120px; }
          .meta-value { color: #1e293b; font-size: 10pt; }
          .section-title { color: #1e40af; font-size: 16pt; font-weight: bold; margin-top: 30px; border-left: 5px solid #3b82f6; padding-left: 10px; }
          .attendee-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .remarks-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; margin-top: 40px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="title">Meeting Briefing Note</p>
          <table class="meta-grid">
            <tr><td class="meta-label">Exported On</td><td class="meta-value">${timestamp}</td></tr>
            <tr><td class="meta-label">Project</td><td class="meta-value">${projectName || "General"}</td></tr>
            <tr><td class="meta-label">Subject</td><td class="meta-value">${subject}</td></tr>
            <tr><td class="meta-label">Date</td><td class="meta-value">${meetingDate}</td></tr>
          </table>
        </div>

        <div class="section-title">List of Attendees</div>
        <table class="attendee-table">
          <thead>
            <tr>
              <th style="text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 9pt; color: #64748b;">Attendee Name</th>
              <th style="text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 9pt; color: #64748b;">Company / Affiliation</th>
            </tr>
          </thead>
          <tbody>
            ${attendeeList || '<tr><td colspan="2" style="font-style: italic; color: #94a3b8; font-size: 10pt; padding: 10px 0;">No attendees recorded</td></tr>'}
          </tbody>
        </table>

        <div class="section-title">Discussion Summary & Actions</div>
        <div style="margin-top: 20px;">
          ${formattedContent.includes('<li') ? formattedContent.replace(/<li/g, '<ul style="padding-left: 20px;"><li').replace(/<\/li>/g, '</li></ul>') : formattedContent}
        </div>

        <div class="remarks-box">
          <p style="margin: 0;"><strong>Additional Remarks:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 10pt; color: #475569;">${remarks || "No manual remarks added."}</p>
        </div>

        <p style="text-align: center; color: #94a3b8; font-size: 8pt; margin-top: 60px;">
          © 2024 VideoScribe Assistant • Verbatim Analysis Report
        </p>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlTemplate], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Meeting_Minutes_${new Date().getTime()}.doc`;
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
      {/* Processing Status Header */}
      {(isProcessing || processingQueue.length > 0) && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="px-4 py-2 bg-gray-950 border-b border-gray-800 flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Batch Processing Pipeline</span>
            <span className="text-[10px] text-blue-400 font-mono">
              {processingQueue.filter(q => q.status === 'done').length} / {processingQueue.length} Completed
            </span>
          </div>
          <div className="p-3 flex items-center gap-4 overflow-x-auto whitespace-nowrap custom-scrollbar">
            {processingQueue.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-950/50 rounded-lg border border-gray-800 shrink-0">
                <div className={`w-2 h-2 rounded-full ${
                  item.status === 'done' ? 'bg-green-500' : 
                  item.status === 'processing' ? 'bg-blue-500 animate-pulse' : 
                  item.status === 'error' ? 'bg-red-500' : 'bg-gray-700'
                }`}></div>
                <span className="text-[10px] text-gray-300 max-w-[120px] truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main UI Header */}
      <div className="flex items-center justify-between bg-gray-900/50 border border-gray-800 p-4 rounded-xl backdrop-blur-sm shadow-sm relative z-20">
        <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={reset} 
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 font-bold text-sm whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Session
          </button>
          
          <div className="w-[1px] h-8 bg-gray-800 hidden md:block"></div>
          
          <div className="flex-1 flex items-center gap-4 overflow-hidden">
            {isEditingMetadata ? (
              <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-left-2">
                <input 
                  type="text" 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-blue-400 w-1/4 outline-none focus:border-blue-500"
                />
                <input 
                  type="text" 
                  value={projectName} 
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project"
                  className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 w-1/4 outline-none focus:border-blue-500"
                />
                <input 
                  type="text" 
                  value={remarks} 
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add manual remarks..."
                  className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-xs text-gray-500 flex-1 outline-none focus:border-blue-500"
                />
                <button onClick={handleUpdateMetadata} className="text-green-500 hover:text-green-400 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                <button onClick={() => setIsEditingMetadata(false)} className="text-red-500 hover:text-red-400 p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            ) : (
              <div className="flex items-center gap-4 overflow-hidden group cursor-pointer" onClick={() => setIsEditingMetadata(true)}>
                <div className="hidden sm:block">
                  <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Subject</h3>
                  <p className="text-sm font-semibold text-blue-400 truncate max-w-xs">{subject || (isProcessing ? "Processing..." : "Media Scribe")}</p>
                </div>
                <div className="hidden md:block">
                  <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Meeting Date</h3>
                  <p className="text-xs text-gray-300">{meetingDate || "Pending"}</p>
                </div>
                <div className="hidden lg:block max-w-xs">
                  <h3 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Remarks</h3>
                  <p className="text-[10px] italic text-gray-500 truncate">{remarks || "Click to add manual remarks..."}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 ml-4">
           {isProcessing && (
             <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
               <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
               <span className="text-[10px] font-mono text-blue-400 animate-pulse">Syncing...</span>
             </div>
           )}
           <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 text-[10px] font-bold whitespace-nowrap shadow-inner">
             <span className="text-gray-500 uppercase mr-1">Project:</span>
             {projectName || "Active Session"}
           </div>
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <div className="bg-black rounded-xl border border-gray-800 overflow-hidden shadow-2xl aspect-video lg:aspect-auto lg:flex-1 relative group">
            {mediaUrl ? (
              isAudioFile() ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gray-950">
                   <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 border border-blue-500/30 group-hover:scale-105 transition-transform duration-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                   </div>
                   <audio src={mediaUrl} controls className="w-full" />
                   <p className="mt-4 text-[10px] text-gray-500 font-mono text-center truncate w-full">{activeRecording?.name}</p>
                </div>
              ) : (
                <video src={mediaUrl} controls className="w-full h-full object-contain" />
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-gray-600 bg-gray-950">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-xs animate-pulse">Processing media metadata...</p>
                  </div>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <p className="text-xs">Select a recording from Knowledge Base or upload new files.</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Attendees Panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden flex flex-col shadow-lg h-1/3">
             <div className="px-4 py-2 bg-gray-950 border-b border-gray-800 flex justify-between items-center">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Meeting Attendees</h4>
             </div>
             <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {attendees.map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-gray-950/50 rounded-lg border border-gray-800 text-xs">
                    <div className="flex-1 truncate">
                      <p className="font-bold text-gray-200 truncate">{a.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{a.company || 'Private'}</p>
                    </div>
                    <button onClick={() => handleRemoveAttendee(idx)} className="text-gray-600 hover:text-red-500 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                {attendees.length === 0 && <p className="text-[10px] text-gray-600 italic text-center py-4">No attendees listed.</p>}
             </div>
             <div className="p-3 bg-gray-900 border-t border-gray-800 space-y-2">
                <input 
                  type="text" 
                  value={newAttendee.name}
                  onChange={(e) => setNewAttendee({...newAttendee, name: e.target.value})}
                  placeholder="Attendee Name"
                  className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newAttendee.company}
                    onChange={(e) => setNewAttendee({...newAttendee, company: e.target.value})}
                    placeholder="Company"
                    className="flex-1 bg-gray-950 border border-gray-800 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-blue-500"
                  />
                  <button 
                    onClick={handleAddAttendee}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[10px] font-bold"
                  >
                    Add
                  </button>
                </div>
             </div>
          </div>
        </div>

        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          {/* Transcript Panel */}
          <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden min-h-0 shadow-lg">
            <div className="px-4 py-3 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Transcript</h3>
              <div className="flex items-center gap-2">
                {transcript.length > 0 && (
                  <button 
                    onClick={exportFullTranscriptToWord}
                    className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded transition-all font-bold border border-blue-500/20"
                    title="Export Verbatim to Word"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Word Export
                  </button>
                )}
                <p className="text-[9px] text-gray-500 uppercase tracking-tighter">Click name to rename</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {transcript.length > 0 ? (
                transcript.map((seg) => (
                  <div key={seg.id} className="group relative bg-gray-950/30 p-3 rounded-lg border border-gray-800/50 hover:border-blue-500/30 transition-all">
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">{seg.timestamp}</span>
                        {seg.language && (
                          <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter bg-gray-800 px-1 rounded">{seg.language}</span>
                        )}
                      </div>
                      <button onClick={() => saveTranscriptSegment(seg)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-green-500 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      {editingSpeakerId === seg.id ? (
                        <div className="flex items-center gap-2 animate-in fade-in duration-200">
                          <input 
                            autoFocus
                            type="text"
                            defaultValue={seg.speaker}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSpeaker(seg.id, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setEditingSpeakerId(null);
                            }}
                            onBlur={(e) => handleRenameSpeaker(seg.id, e.target.value)}
                            className="text-[10px] font-bold bg-blue-900/30 border border-blue-500/50 rounded px-1.5 py-0.5 text-blue-200 outline-none w-32"
                          />
                          <span className="text-[8px] text-gray-500 italic">Press Enter to sync global name</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setEditingSpeakerId(seg.id)}
                          className="text-[10px] font-bold text-gray-500 uppercase hover:text-blue-400 text-left w-fit transition-colors flex items-center gap-1 group/speaker"
                        >
                          {seg.speaker || "Unknown Speaker"}
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 opacity-0 group-hover/speaker:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      )}
                      <p className="text-sm text-gray-300 leading-relaxed">{seg.text}</p>
                      {seg.translatedText && (
                        <div className="mt-1 flex items-start gap-2 animate-in slide-in-from-left-2">
                          <div className="w-[2px] self-stretch bg-blue-500/30 rounded-full"></div>
                          <p className="text-xs italic text-gray-500">
                            <span className="text-[9px] font-bold text-blue-500/50 uppercase tracking-widest mr-1">EN:</span>
                            {seg.translatedText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 italic text-xs">
                  {isProcessing ? "Transcript generating..." : "No transcript available."}
                </div>
              )}
            </div>
          </div>

          {/* Clarification Box */}
          <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden min-h-0 shadow-lg">
            <div className="px-4 py-3 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Clarification Box</h3>
              {chatHistory.length > 0 && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => exportToText(chatHistory.filter(m => m.role === 'model').map(m => m.content).join('\n\n'))}
                    className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded transition-all font-bold border border-gray-700"
                    title="Export as Text"
                  >
                    TXT
                  </button>
                  <button 
                    onClick={() => exportChatToWord(chatHistory.filter(m => m.role === 'model').map(m => m.content).join('\n\n'))}
                    className="text-[10px] flex items-center gap-1.5 px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded transition-all font-bold border border-blue-500/20"
                    title="Export Meeting Minutes to Word"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Minutes Export
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950/20 custom-scrollbar">
              {chatHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3 text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <p className="text-xs text-gray-500 italic">Ask specific questions about people, dates, or decisions mentioned in the transcript.</p>
                  <button 
                    onClick={(e) => {
                      setUserInput("Summarize the meeting with: Discussion Points, Action Items, Summary of key discussions, and Important dates mentioned.");
                      handleChat(e as any);
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 rounded-lg text-[10px] font-bold uppercase transition-all"
                  >
                    Quick Minute Summary
                  </button>
                </div>
              )}
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md' 
                      : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none shadow-sm prose prose-invert prose-sm'
                  }`}>
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i} className={line.trim().startsWith('-') || line.trim().startsWith('*') ? 'ml-2 -indent-2' : ''}>
                        {line}
                      </p>
                    ))}
                    {msg.role === 'model' && (
                      <div className="mt-4 pt-3 border-t border-gray-700/50 flex justify-end gap-2">
                         <button 
                          onClick={() => exportToText(msg.content)}
                          className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 font-bold uppercase tracking-wider transition-colors"
                        >
                          TXT
                        </button>
                        <button 
                          onClick={() => exportChatToWord(msg.content)}
                          className="text-[10px] text-gray-500 hover:text-blue-400 flex items-center gap-1 font-bold uppercase tracking-wider transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Minutes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isChatting && <div className="flex justify-start"><div className="bg-gray-800 p-3 rounded-2xl rounded-bl-none border border-gray-700 shadow-sm"><div className="flex gap-1"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce delay-100"></div><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce delay-200"></div></div></div></div>}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleChat} className="p-3 bg-gray-900 border-t border-gray-800">
              <div className="flex gap-2 p-1 bg-gray-950 border border-gray-800 rounded-xl shadow-inner focus-within:border-blue-500/50 transition-colors">
                <input 
                  type="text" 
                  value={userInput} 
                  onChange={(e) => setUserInput(e.target.value)} 
                  placeholder="Ask for Discussion Points, Action Items or Dates..." 
                  className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none text-white placeholder:text-gray-600" 
                  disabled={isChatting || !isTranscribed} 
                />
                <button 
                  type="submit" 
                  disabled={isChatting || !isTranscribed || !userInput.trim()} 
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-lg active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
