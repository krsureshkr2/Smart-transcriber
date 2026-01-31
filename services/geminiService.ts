
import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptSegment } from "../types";

const API_KEY = process.env.API_KEY || "";

/**
 * Robust media processing with Gemini
 * Includes error handling for transient 500 errors
 */
export const processMedia = async (mediaBase64: string, mimeType: string, retries = 2): Promise<{ transcript: TranscriptSegment[]; fullText: string; subject: string }> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
    You are an expert transcriber and analyst. Transcribe the provided media content (audio or video) and summarize the main subject.
    The content may contain speech in English, Hindi, or Marathi, or a mix.
    
    Rules:
    1. Identify the language for each segment.
    2. Provide timestamps in format [MM:SS].
    3. If multiple speakers are present, label them distinctly (e.g., Speaker 1, Speaker 2).
    4. Provide a concise "subject" line (max 10 words) describing the main topic.
    5. Transcribe ALL spoken words accurately into text.
    6. MANDATORY: For any segments in Hindi or Marathi, provide an accurate English translation in the "translatedText" field.
    
    Strictly use JSON output format with the following schema:
    {
      "subject": "Concise summary of the meeting",
      "segments": [
        { 
          "timestamp": "00:05", 
          "speaker": "Speaker 1", 
          "text": "The original spoken text...", 
          "translatedText": "English translation if text was Hindi/Marathi, else leave blank",
          "language": "English/Hindi/Marathi" 
        }
      ],
      "fullText": "Full concatenated text without timestamps"
    }
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
            subject: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  speaker: { type: Type.STRING },
                  text: { type: Type.STRING },
                  translatedText: { type: Type.STRING },
                  language: { type: Type.STRING }
                },
                required: ["timestamp", "text"]
              }
            },
            fullText: { type: Type.STRING }
          },
          required: ["subject", "segments", "fullText"]
        }
      }
    });

    if (!response.text) throw new Error("Empty response from AI model");

    const data = JSON.parse(response.text);
    return {
      subject: data.subject || "Untitled Recording",
      transcript: (data.segments || []).map((s: any, idx: number) => ({
        ...s,
        id: `seg-${idx}-${Date.now()}`
      })),
      fullText: data.fullText || ""
    };
  } catch (err: any) {
    if (retries > 0 && (err.message?.includes('500') || err.message?.includes('xhr'))) {
      console.warn(`Transient error detected, retrying... (${retries} left)`);
      await new Promise(r => setTimeout(r, 2000));
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
