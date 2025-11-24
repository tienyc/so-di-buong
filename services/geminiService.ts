import { GoogleGenAI, Type } from "@google/genai";
import { OrderType } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to parse unstructured text (e.g., voice dictation or pasted notes) into patient data
export const parsePatientInput = async (inputText: string) => {
    try {
        const currentDate = new Date().toLocaleDateString('vi-VN');
        const todayISO = new Date().toISOString().split('T')[0];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Bạn là AI chuyên phân tích danh sách bệnh nhân trong ứng dụng y tế SmartRound.

**NHIỆM VỤ:**
Phân tích văn bản không có cấu trúc (có thể 1 hoặc nhiều bệnh nhân) và trả về mảng JSON.

**NGÀY HIỆN TẠI:** ${currentDate} (${todayISO})

**QUY TẮC PHÂN TÍCH:**

1️⃣ **Họ tên (fullName):**
   - Viết hoa chữ cái đầu mỗi từ
   - Loại bỏ số thứ tự: "1. Nguyễn Văn A" → "Nguyễn Văn A"
   - Ví dụ: "anh tùng" → "Anh Tùng"

2️⃣ **Tuổi (age):**
   - Tìm số kèm: "45t", "45T", "45 tuổi", "t45"
   - Hoặc số 2 chữ số (10-99) đứng sau tên, không phải ngày tháng
   - Không tìm thấy → 0

3️⃣ **Giới tính (gender):**
   - Nam: "nam", "n", "m", "ông", "anh", "bác" (nam)
   - Nữ: "nữ", "nu", "f", "bà", "chị", "cô"
   - Không rõ → ""

4️⃣ **Phòng/Khu (roomNumber, ward):**
   Mã hợp lệ (không phân biệt hoa/thường):
   - Buồng bệnh: B1-B15
   - Dịch vụ: DV1-DV3
   - Cấp cứu: CC1, CC2, C1, C2, hoặc có từ "cứu"
   - Nhiễm: "Nhiễm", "Nhiễm trùng"
   - Nội soi: NS1, NS2
   - Hậu phẫu: HP1, HP2

   Fallback: roomNumber = "Cấp cứu 1", ward = "Cấp cứu 1"

5️⃣ **Chẩn đoán (diagnosis):**
   - Tên bệnh: gãy, trật, viêm, u, áp xe, nhiễm trùng...
   - Vị trí: đùi, chân, bàn chân, ngón tay...
   - Viết hoa chữ cái đầu câu
   - Ví dụ: "gãy xương đùi" → "Gãy xương đùi"

6️⃣ **Tình trạng (historySummary):**
   - Triệu chứng: đau, sưng, đỏ, sốt, khó thở...
   - Diễn biến: tỉnh táo, tiếp xúc tốt, ăn uống được...

7️⃣ **Ngày vào viện (admissionDate):**
   - Nhận dạng: "23/11", "ngày 23", "hôm nay", "hôm qua"
   - Chuẩn hóa: YYYY-MM-DD
   - Mặc định: ${todayISO}

**VÍ DỤ:**
Input: "1. Anh Tùng 45t, gãy xương đùi, đau nhiều, B1"
Output: [{"fullName":"Anh Tùng","age":45,"gender":"Nam","roomNumber":"B1","diagnosis":"Gãy xương đùi","historySummary":"Đau nhiều","ward":"Buồng bệnh","admissionDate":"${todayISO}"}]

**INPUT TEXT:**
"${inputText}"

**LƯU Ý:**
- LUÔN trả về mảng, dù chỉ có 1 bệnh nhân
- Không thêm field nào khác ngoài schema
- Nếu thiếu thông tin → dùng giá trị mặc định`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            fullName: { type: Type.STRING, description: "Họ tên viết hoa chữ cái đầu" },
                            age: { type: Type.NUMBER, description: "Tuổi, mặc định 0" },
                            gender: { type: Type.STRING, description: "Nam/Nữ hoặc rỗng" },
                            diagnosis: { type: Type.STRING, description: "Chẩn đoán, viết hoa chữ đầu" },
                            roomNumber: { type: Type.STRING, description: "Mã phòng: B1, DV1, CC1..." },
                            ward: { type: Type.STRING, description: "Tên khu" },
                            historySummary: { type: Type.STRING, description: "Tình trạng lâm sàng" },
                            admissionDate: { type: Type.STRING, description: "YYYY-MM-DD" }
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