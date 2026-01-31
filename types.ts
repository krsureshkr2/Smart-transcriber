
export interface Attendee {
  name: string;
  company: string;
}

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  speaker?: string;
  text: string;
  translatedText?: string;
  language?: 'English' | 'Hindi' | 'Marathi' | 'Mixed';
}

export interface Recording {
  id: string;
  name: string;
  projectName: string;
  subject: string;
  transcript: TranscriptSegment[];
  fullText: string;
  dateCreated: string;
  meetingDate: string;
  remarks?: string;
  isBookmarked?: boolean;
  mediaUrl?: string; 
  attendees?: Attendee[];
}

export interface SavedPoint {
  id: string;
  recordingId?: string;
  sourceVideo: string;
  timestamp: string;
  content: string;
  dateSaved: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export enum AppTab {
  DASHBOARD = 'dashboard',
  KNOWLEDGE_BASE = 'knowledge_base'
}
