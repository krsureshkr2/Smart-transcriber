
import React, { useState, useMemo } from 'react';
import { SavedPoint, Recording, Attendee } from '../types';

interface KnowledgeBaseProps {
  points: SavedPoint[];
  recordings: Recording[];
  onDeletePoint: (id: string) => void;
  onDeleteRecording: (id: string) => void;
  onUpdateRecording: (rec: Recording) => void;
  onUpdateSavedPoint: (point: SavedPoint) => void;
  onOpenRecording: (rec: Recording) => void;
  onAddRecording?: (rec: Omit<Recording, 'id' | 'dateCreated'>) => void;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ 
  points, 
  recordings, 
  onDeletePoint, 
  onDeleteRecording, 
  onUpdateRecording,
  onUpdateSavedPoint,
  onOpenRecording,
  onAddRecording
}) => {
  const [activeTab, setActiveTab] = useState<'recordings' | 'points'>('recordings');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [editingPoint, setEditingPoint] = useState<SavedPoint | null>(null);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [newManual, setNewManual] = useState({
    name: "Manual Log",
    projectName: "",
    subject: "",
    meetingDate: new Date().toLocaleDateString(),
    remarks: "",
    fullText: "",
    transcript: [],
    attendees: [] as Attendee[]
  });

  const filteredRecordings = useMemo(() => {
    if (!searchQuery.trim()) return recordings;
    const q = searchQuery.toLowerCase();
    return recordings.filter(rec => 
      rec.projectName.toLowerCase().includes(q) || 
      rec.subject.toLowerCase().includes(q) ||
      rec.name.toLowerCase().includes(q)
    );
  }, [recordings, searchQuery]);

  const handleEditRecordingSave = () => {
    if (editingRecording) {
      onUpdateRecording(editingRecording);
      setEditingRecording(null);
    }
  };

  const handleEditPointSave = () => {
    if (editingPoint) {
      onUpdateSavedPoint(editingPoint);
      setEditingPoint(null);
    }
  };

  const handleManualAdd = () => {
    if (onAddRecording) {
      onAddRecording({
        ...newManual,
        transcript: []
      });
      setIsAddingManual(false);
      setNewManual({
        name: "Manual Log",
        projectName: "",
        subject: "",
        meetingDate: new Date().toLocaleDateString(),
        remarks: "",
        fullText: "",
        transcript: [],
        attendees: []
      });
    }
  };

  const toggleBookmark = (rec: Recording) => {
    onUpdateRecording({
      ...rec,
      isBookmarked: !rec.isBookmarked
    });
  };

  const shareMessage = (p: SavedPoint) => 
    `*VideoScribe Snippet*\n\n*Source:* ${p.sourceVideo}\n*Timestamp:* ${p.timestamp}\n\n*Content:* ${p.content}`;

  const handleShareWhatsApp = (p: SavedPoint) => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage(p))}`;
    window.open(url, '_blank');
  };

  const handleShareSMS = (p: SavedPoint) => {
    const url = `sms:?body=${encodeURIComponent(shareMessage(p))}`;
    window.location.href = url;
  };

  const bookmarkedMeetings = filteredRecordings.filter(r => r.isBookmarked);

  return (
    <div className="space-y-6">
      {/* Search Bar Section */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Project Name, Topic (Subject), or Recording Title..."
            className="block w-full pl-10 pr-3 py-3 bg-gray-950 border border-gray-800 rounded-xl leading-5 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm transition-all shadow-inner"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 px-1 flex items-center gap-2">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Results found:</span>
            <span className="text-[10px] text-blue-400 font-mono">{filteredRecordings.length}</span>
          </div>
        )}
      </div>

      {/* Manual Add Modal */}
      {isAddingManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Create Manual Entry</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Project Name</label>
                <input 
                  type="text" 
                  value={newManual.projectName} 
                  onChange={(e) => setNewManual({...newManual, projectName: e.target.value})}
                  placeholder="Enter project category..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Meeting Date</label>
                <input 
                  type="text" 
                  value={newManual.meetingDate} 
                  onChange={(e) => setNewManual({...newManual, meetingDate: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Subject</label>
                <input 
                  type="text" 
                  value={newManual.subject} 
                  onChange={(e) => setNewManual({...newManual, subject: e.target.value})}
                  placeholder="Summarize the core topic..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Remarks</label>
                <textarea 
                  rows={3}
                  value={newManual.remarks} 
                  onChange={(e) => setNewManual({...newManual, remarks: e.target.value})}
                  placeholder="Any manual notes or meeting details..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleManualAdd} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition-colors">Add to Hub</button>
              <button onClick={() => setIsAddingManual(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold py-2 rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recording Modal */}
      {editingRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">Edit Hub Record</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Project Name</label>
                <input 
                  type="text" 
                  value={editingRecording.projectName} 
                  onChange={(e) => setEditingRecording({...editingRecording, projectName: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Meeting Date</label>
                <input 
                  type="text" 
                  value={editingRecording.meetingDate} 
                  onChange={(e) => setEditingRecording({...editingRecording, meetingDate: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Subject</label>
                <input 
                  type="text" 
                  value={editingRecording.subject} 
                  onChange={(e) => setEditingRecording({...editingRecording, subject: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Manual Remarks</label>
                <textarea 
                  rows={3}
                  value={editingRecording.remarks || ""} 
                  onChange={(e) => setEditingRecording({...editingRecording, remarks: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleEditRecordingSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-colors">Save Changes</button>
              <button onClick={() => setEditingRecording(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold py-2 rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bookmark Modal */}
      {editingPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Bookmark</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Timestamp</label>
                <input 
                  type="text" 
                  value={editingPoint.timestamp} 
                  onChange={(e) => setEditingPoint({...editingPoint, timestamp: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Content Snippet</label>
                <textarea 
                  rows={4}
                  value={editingPoint.content} 
                  onChange={(e) => setEditingPoint({...editingPoint, content: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleEditPointSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-colors">Save Changes</button>
              <button onClick={() => setEditingPoint(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold py-2 rounded-lg transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-gray-800">
        <div className="flex">
          <button 
            onClick={() => setActiveTab('recordings')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'recordings' ? 'text-blue-500 border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            Project Hub ({filteredRecordings.length})
          </button>
          <button 
            onClick={() => setActiveTab('points')}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'points' ? 'text-blue-500 border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            Bookmarks ({points.length + bookmarkedMeetings.length})
          </button>
        </div>
        
        {activeTab === 'recordings' && (
          <button 
            onClick={() => setIsAddingManual(true)}
            className="mb-2 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-green-500/10 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Manual Entry
          </button>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
        {activeTab === 'recordings' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-950 text-[10px] font-bold uppercase text-gray-500 tracking-widest">
                <tr>
                  <th className="px-6 py-4">Recording</th>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Topic (Subject)</th>
                  <th className="px-6 py-4">Meeting Date</th>
                  <th className="px-6 py-4">Attendees</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredRecordings.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">{searchQuery ? 'No recordings match your search.' : 'No recordings found.'}</td></tr>
                ) : (
                  filteredRecordings.map((rec) => (
                    <tr 
                      key={rec.id} 
                      onDoubleClick={() => onOpenRecording(rec)}
                      className="hover:bg-blue-600/5 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-gray-500 group-hover:text-blue-400 transition-colors">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <span className="text-sm font-medium text-gray-200">{rec.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-800 px-2 py-1 rounded uppercase tracking-widest border border-gray-700 whitespace-nowrap">
                          {rec.projectName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-blue-400 truncate max-w-[120px] inline-block">{rec.subject}</span>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-gray-300 whitespace-nowrap">{rec.meetingDate || rec.dateCreated}</td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] text-gray-500 truncate max-w-[120px] italic">
                          {rec.attendees && rec.attendees.length > 0 
                            ? `${rec.attendees.length} Attendee(s)` 
                            : 'Not listed'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(rec); }}
                            className={`p-2 rounded transition-colors ${rec.isBookmarked ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-600 hover:text-yellow-500'}`}
                            title={rec.isBookmarked ? "Remove from Bookmarks" : "Bookmark Meeting"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={rec.isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingRecording(rec); }} className="text-gray-600 hover:text-blue-400 p-2 transition-colors" title="Edit Metadata">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onDeleteRecording(rec.id); }} className="text-gray-600 hover:text-red-500 p-2 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col min-h-[400px]">
            {/* Bookmarked Meetings Section */}
            <div className="p-6 border-b border-gray-800">
              <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4">Flagged Meetings {searchQuery && '(Filtered)'}</h4>
              {bookmarkedMeetings.length === 0 ? (
                <p className="text-xs text-gray-600 italic">{searchQuery ? 'No bookmarked meetings match your search.' : 'No meetings bookmarked yet.'}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bookmarkedMeetings.map(rec => (
                    <div 
                      key={rec.id} 
                      className="bg-gray-950/50 border border-gray-800 p-4 rounded-xl hover:border-blue-500/50 cursor-pointer group transition-all"
                      onClick={() => onOpenRecording(rec)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold uppercase">{rec.projectName}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleBookmark(rec); }}
                          className="text-yellow-500"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                        </button>
                      </div>
                      <h5 className="text-sm font-bold text-white mb-1 group-hover:text-blue-400 transition-colors truncate">{rec.name}</h5>
                      <p className="text-xs text-gray-400 line-clamp-2 mb-3 h-8">{rec.subject}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-600 font-mono">
                        <span>{rec.meetingDate}</span>
                        <span className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {rec.transcript.length} Segments
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Snippets Section */}
            <div className="p-6">
              <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4">Saved Content Snippets</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-950 text-[10px] font-bold uppercase text-gray-500 tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Source Video</th>
                      <th className="px-6 py-4">Snippet</th>
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {points.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">No bookmarks saved.</td></tr>
                    ) : (
                      points.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-6 py-4 text-xs font-bold text-gray-300">{p.sourceVideo}</td>
                          <td className="px-6 py-4 text-sm text-gray-400 max-w-md truncate">{p.content}</td>
                          <td className="px-6 py-4 text-xs font-mono text-blue-400">{p.timestamp}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1">
                              {/* Share via WhatsApp */}
                              <button 
                                onClick={() => handleShareWhatsApp(p)} 
                                className="text-gray-600 hover:text-green-500 p-2 transition-colors" 
                                title="Share via WhatsApp"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              </button>
                              {/* Share via SMS */}
                              <button 
                                onClick={() => handleShareSMS(p)} 
                                className="text-gray-600 hover:text-blue-400 p-2 transition-colors" 
                                title="Send via Text Message"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                              </button>
                              <button onClick={() => setEditingPoint(p)} className="text-gray-600 hover:text-blue-400 p-2 transition-colors" title="Edit Bookmark">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button onClick={() => onDeletePoint(p.id)} className="text-gray-600 hover:text-red-500 p-2 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
