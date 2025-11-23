import { GoogleGenAI, Type } from "@google/genai";
import { OrderType } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to parse unstructured text (e.g., voice dictation or pasted notes) into patient data
export const parsePatientInput = async (inputText: string) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Parse the following unstructured medical handover notes into a structured JSON list of patients. 
            Current date is ${new Date().toISOString()}.
            
            Input text: "${inputText}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            fullName: { type: Type.STRING },
                            age: { type: Type.NUMBER },
                            diagnosis: { type: Type.STRING },
                            roomNumber: { type: Type.STRING },
                            bedNumber: { type: Type.STRING },
                            historySummary: { type: Type.STRING, description: "Brief summary of history if available" }
                        },
                        required: ["fullName", "diagnosis"]
                    }
                }
            }
        });
        
        return JSON.parse(response.text || '[]');
    } catch (error) {
        console.error("Error parsing patient input:", error);
        return [];
    }
};

// Helper to format surgery schedule for Google Sheets
export const formatForGoogleSheet = async (patients: any[]) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `I have a list of patients scheduled for surgery. Format this data into a CSV string (comma separated) that represents a professional surgery schedule spreadsheet. 
            Columns should be: Date, Room, Patient Name, Age, Diagnosis, Notes.
            
            Patients Data: ${JSON.stringify(patients)}`,
        });
        return response.text;
    } catch (error) {
        console.error("Error formatting for sheet:", error);
        return "Error formatting data.";
    }
};

export const suggestOrders = async (diagnosis: string, history: string) => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Suggest 3-5 standard medical orders (in Vietnamese) for a patient with:
            Diagnosis: ${diagnosis}
            History: ${history}
            
            Return ONLY a JSON array of strings.`,
             config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return JSON.parse(response.text || '[]');
    } catch (error) {
        return [];
    }
};