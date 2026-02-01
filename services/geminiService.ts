
import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptSegment } from "../types";

const API_KEY = process.env.API_KEY || "";

/**
 * Robust media processing with Gemini
 * Optimized to prevent JSON truncation on large files by removing redundant 'fullText' from schema.
 */
export const processMedia = async (mediaBase64: string, mimeType: string, retries = 2): Promise<{ transcript: TranscriptSegment[]; fullText: string; subject: string }> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const isAudio = mimeType.startsWith('audio/');
  const prompt = `
    You are an expert professional transcribing and analyzing a ${isAudio ? 'Phone Call or Audio Recording' : 'Video Recording'}.
    The content may contain speech in English, Hindi, or Marathi, or a mix (Hinglish/Marathlish).
    
    TASK:
    1. Provide a concise 'subject' (max 10 words).
    2. Transcribe the conversation into chronological 'segments'.
    3. Identify the speaker (e.g., "Caller", "Receiver", "Client", "Agent") and the primary language of the segment.
    4. MANDATORY: For any non-English speech, provide an accurate English translation in 'translatedText'.
    
    OUTPUT FORMAT:
    Strictly return valid JSON. Do NOT include a 'fullText' summary of the whole transcript in the JSON to save space; 
    instead, focus only on high-quality segments.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { data: mediaBase64, mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { 
              type: Type.STRING,
              description: "A professional title for the recording."
            },
            segments: {
              type: Type.ARRAY,
              description: "Chronological list of spoken parts.",
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING, description: "[MM:SS] format" },
                  speaker: { type: Type.STRING },
                  text: { type: Type.STRING, description: "Verbatim text in original language" },
                  translatedText: { type: Type.STRING, description: "English translation for non-English segments" },
                  language: { type: Type.STRING }
                },
                required: ["timestamp", "text"]
              }
            }
          },
          required: ["subject", "segments"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI model");

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Initial JSON parse failed. Attempting to repair truncated JSON...", text.slice(-100));
      // Basic repair for common truncation: try closing the arrays/objects if they look cut off
      let repairedText = text.trim();
      if (!repairedText.endsWith('}')) {
        if (!repairedText.endsWith(']')) repairedText += ']}';
        else repairedText += '}';
      }
      data = JSON.parse(repairedText);
    }

    const segments: TranscriptSegment[] = (data.segments || []).map((s: any, idx: number) => ({
      ...s,
      id: `seg-${idx}-${Date.now()}`
    }));

    // Calculate fullText locally to avoid passing massive strings back and forth in JSON
    const fullText = segments.map(s => `[${s.timestamp}] ${s.speaker || 'Speaker'}: ${s.text}`).join('\n');

    return {
      subject: data.subject || "Untitled Recording",
      transcript: segments,
      fullText: fullText
    };
  } catch (err: any) {
    if (retries > 0 && (err.message?.includes('500') || err.message?.includes('xhr') || err.message?.includes('Unterminated'))) {
      console.warn(`Transient or truncation error detected, retrying with backoff... (${retries} left)`);
      await new Promise(r => setTimeout(r, 3000));
      return processMedia(mediaBase64, mimeType, retries - 1);
    }
    throw err;
  }
};

export const chatWithTranscript = async (
  query: string, 
  transcript: string, 
  history: { role: 'user' | 'model', content: string }[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const systemInstruction = `
    You are VideoScribe Assistant, a professional meeting analyst.
    The user is asking questions about a media transcription (English, Hindi, Marathi mix).
    
    YOUR RESPONSE RULES:
    1. ALWAYS structure your response using clear bullet points for readability.
    2. Use the following headers in your response if relevant information exists:
       - **Key Issues & Actions**: Bullet points of critical points or tasks.
       - **Persons Mentioned**: Use the names provided in the transcript. Explain their context.
       - **Dates & Timeline**: Specific dates, times, or deadlines mentioned.
    3. If information for a category is missing, explicitly state "Not mentioned".
    4. Maintain a high level of professional language.
    5. Contextualize Hindi/Marathi terms in English within your summary for clarity.
    
    TRANSCRIPT CONTEXT:
    ${transcript}
  `;

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: { systemInstruction }
  });

  const response = await chat.sendMessage({ message: query });
  return response.text || "I'm sorry, I couldn't process that request.";
};
