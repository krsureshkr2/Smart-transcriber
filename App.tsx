
import React, { useState, useEffect, useCallback } from 'react';
import { AppTab, SavedPoint, Recording } from './types';
import { Dashboard } from './components/Dashboard';
import { KnowledgeBase } from './components/KnowledgeBase';
import { processMedia } from './services/geminiService';

interface QueueItem {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress?: string;
  projectName: string;
  file: File;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DASHBOARD);
  const [savedPoints, setSavedPoints] = useState<SavedPoint[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  
  // Global Processing State
  const [processingQueue, setProcessingQueue] = useState<QueueItem[]>([]);
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);

  // Load from local storage
  useEffect(() => {
    const storedPoints = localStorage.getItem('videoscribe_points');
    const storedRecordings = localStorage.getItem('videoscribe_recordings');
    if (storedPoints) setSavedPoints(JSON.parse(storedPoints));
    if (storedRecordings) setRecordings(JSON.parse(storedRecordings));
  }, []);

  // Persist
  useEffect(() => {
    localStorage.setItem('videoscribe_points', JSON.stringify(savedPoints));
  }, [savedPoints]);

  useEffect(() => {
    localStorage.setItem('videoscribe_recordings', JSON.stringify(recordings));
  }, [recordings]);

  const addRecording = useCallback((rec: Omit<Recording, 'id' | 'dateCreated'>) => {
    const newRec: Recording = {
      ...rec,
      id: crypto.randomUUID(),
      dateCreated: new Date().toLocaleString()
    };
    setRecordings(prev => [newRec, ...prev]);
    return newRec;
  }, []);

  const updateRecording = (updatedRec: Recording) => {
    setRecordings(prev => prev.map(r => r.id === updatedRec.id ? updatedRec : r));
    if (selectedRecording?.id === updatedRec.id) {
      setSelectedRecording(updatedRec);
    }
  };

  const processQueueItem = async (item: QueueItem) => {
    setProcessingQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));
    
    try {
      const reader = new FileReader();
      const resultBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(item.file);
      });

      // Handle the 500 error by wrapping the service call with a retry or better error logging
      const result = await processMedia(resultBase64, item.file.type);
      
      const newRec = addRecording({
        name: item.file.name,
        projectName: item.projectName,
        subject: result.subject,
        transcript: result.transcript,
        fullText: result.fullText,
        meetingDate: new Date().toLocaleDateString(),
        mediaUrl: URL.createObjectURL(item.file)
      });

      setProcessingQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q));
      
      // If it was the only one or we want to focus it
      if (processingQueue.length === 1) {
        setSelectedRecording(newRec);
      }
    } catch (err) {
      console.error(`Error processing ${item.name}:`, err);
      setProcessingQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error' } : q));
    }
  };

  useEffect(() => {
    const nextItem = processingQueue.find(q => q.status === 'pending');
    if (nextItem && !processingQueue.some(q => q.status === 'processing')) {
      setIsProcessingGlobal(true);
      processQueueItem(nextItem);
    } else if (!nextItem && !processingQueue.some(q => q.status === 'processing')) {
      setIsProcessingGlobal(false);
      // Optional: Clear done items after some time
      const hasDone = processingQueue.some(q => q.status === 'done' || q.status === 'error');
      if (hasDone && !isProcessingGlobal) {
        const timer = setTimeout(() => {
          setProcessingQueue([]);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [processingQueue, isProcessingGlobal, addRecording]);

  const handleStartUpload = (files: File[], projectName: string) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      status: 'pending',
      projectName,
      file
    }));
    setProcessingQueue(prev => [...prev, ...newItems]);
    setActiveTab(AppTab.DASHBOARD);
  };

  const addSavedPoint = (point: Omit<SavedPoint, 'id' | 'dateSaved'>) => {
    const newPoint: SavedPoint = {
      ...point,
      id: crypto.randomUUID(),
      dateSaved: new Date().toLocaleString()
    };
    setSavedPoints(prev => [newPoint, ...prev]);
  };

  const updateSavedPoint = (updatedPoint: SavedPoint) => {
    setSavedPoints(prev => prev.map(p => p.id === updatedPoint.id ? updatedPoint : p));
  };

  const deleteSavedPoint = (id: string) => {
    setSavedPoints(prev => prev.filter(p => p.id !== id));
  };

  const deleteRecording = (id: string) => {
    setRecordings(prev => prev.filter(r => r.id !== id));
    if (selectedRecording?.id === id) setSelectedRecording(null);
  };

  const handleOpenRecording = (rec: Recording) => {
    setSelectedRecording(rec);
    setActiveTab(AppTab.DASHBOARD);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 sticky top-0 z-50 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">VideoScribe Assistant</h1>
              <p className="text-[10px] text-blue-400 font-semibold tracking-widest uppercase">Intelligent Media Analysis</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isProcessingGlobal && (
              <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full animate-in fade-in zoom-in duration-300">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                  Processing Media...
                </span>
              </div>
            )}
            <nav className="flex bg-gray-950 p-1 rounded-xl border border-gray-800 shadow-inner">
              <button 
                onClick={() => setActiveTab(AppTab.DASHBOARD)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === AppTab.DASHBOARD ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-900'
                }`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab(AppTab.KNOWLEDGE_BASE)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === AppTab.KNOWLEDGE_BASE ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-900'
                }`}
              >
                Knowledge Base
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 relative">
        {activeTab === AppTab.DASHBOARD ? (
          <Dashboard 
            onSavePoint={addSavedPoint} 
            onSaveRecording={addRecording}
            onUpdateRecording={updateRecording}
            initialRecording={selectedRecording}
            onClearInitial={() => setSelectedRecording(null)}
            processingQueue={processingQueue}
            onStartUpload={handleStartUpload}
          />
        ) : (
          <KnowledgeBase 
            points={savedPoints} 
            recordings={recordings}
            onDeletePoint={deleteSavedPoint} 
            onDeleteRecording={deleteRecording}
            onUpdateRecording={updateRecording}
            onUpdateSavedPoint={updateSavedPoint}
            onOpenRecording={handleOpenRecording}
            onAddRecording={addRecording}
          />
        )}

        {/* Global Progress Toast for background processing */}
        {processingQueue.length > 0 && activeTab !== AppTab.DASHBOARD && (
          <div className="fixed bottom-6 right-6 z-50 w-72 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Upload Status</span>
              <span className="text-[10px] text-gray-500">{processingQueue.filter(q => q.status === 'done').length}/{processingQueue.length}</span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {processingQueue.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-gray-400 truncate flex-1">{item.name}</span>
                  <div className={`w-2 h-2 rounded-full ${
                    item.status === 'done' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                    item.status === 'processing' ? 'bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                    item.status === 'error' ? 'bg-red-500' : 'bg-gray-700'
                  }`}></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 px-6 border-t border-gray-900 text-center text-gray-600 text-[10px] uppercase tracking-[0.2em]">
        <p>© 2024 VideoScribe Assistant • Powered by Gemini AI • English / Hindi / Marathi</p>
      </footer>
    </div>
  );
};

export default App;
