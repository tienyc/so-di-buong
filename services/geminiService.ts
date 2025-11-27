import { GoogleGenAI, Type } from "@google/genai";
import { getWardFromRoom, getRoomWardMappingForPrompt, getAllValidRooms } from "./roomMapping";

// Re-export for other components
export { getWardFromRoom } from "./roomMapping";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to parse unstructured text (e.g., voice dictation or pasted notes) into patient data
export const parsePatientInput = async (inputText: string) => {
    try {
        const currentDate = new Date().toLocaleDateString('vi-VN');
        const todayISO = new Date().toISOString().split('T')[0];

        // Get valid rooms mapping for the prompt
        const validRooms = getAllValidRooms();
        const roomWardMapping = getRoomWardMappingForPrompt();

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

4️⃣ **⚠️ PHÒNG (roomNumber) - CỰC KỲ QUAN TRỌNG:**
   **CHỈ được trả về CHÍNH XÁC một trong các giá trị sau (phân biệt hoa thường):**
   ${validRooms.map(r => `"${r}"`).join(', ')}

   **KHÔNG ĐƯỢC** tự sáng tạo tên phòng khác!
   **KHÔNG ĐƯỢC** viết "Phòng B4" - chỉ viết "B4"
   **KHÔNG ĐƯỢC** viết "Buồng B1" - chỉ viết "B1"

   Nếu không tìm thấy phòng trong input → roomNumber = "Cấp cứu 1"

5️⃣ **⚠️ KHU (ward) - KHÔNG TỰ Ý NHẬP:**
   **TUYỆT ĐỐI KHÔNG TỰ ĐIỀN ward!**
   **LUÔN LUÔN để ward = ""** (chuỗi rỗng)

   Lý do: Backend sẽ tự động map đúng ward từ roomNumber theo bảng sau:
${roomWardMapping}

   Ví dụ:
   - roomNumber = "B1" → Backend tự set ward = "B1-B4"
   - roomNumber = "B8" → Backend tự set ward = "Tiền Phẫu"
   - roomNumber = "Cấp cứu 1" → Backend tự set ward = "Cấp Cứu 1"

6️⃣ **Chẩn đoán (diagnosis):**
   - Tên bệnh: gãy, trật, viêm, u, áp xe, nhiễm trùng...
   - Vị trí: đùi, chân, bàn chân, ngón tay...
   - Viết hoa chữ cái đầu câu
   - Ví dụ: "gãy xương đùi" → "Gãy xương đùi"

7️⃣ **Tình trạng (historySummary):**
   - Triệu chứng: đau, sưng, đỏ, sốt, khó thở...
   - Diễn biến: tỉnh táo, tiếp xúc tốt, ăn uống được...

8️⃣ **Ngày vào viện (admissionDate):**
   - Nhận dạng: "23/11", "ngày 23", "hôm nay", "hôm qua"
   - Chuẩn hóa: YYYY-MM-DD
   - Mặc định: ${todayISO}

**VÍ DỤ ĐÚNG:**
Input: "1. Anh Tùng 45t, gãy xương đùi, đau nhiều, B1"
Output: [{"fullName":"Anh Tùng","age":45,"gender":"Nam","roomNumber":"B1","ward":"","diagnosis":"Gãy xương đùi","historySummary":"Đau nhiều","admissionDate":"${todayISO}"}]

Input: "Bà Lan 67t, Hậu phẫu"
Output: [{"fullName":"Bà Lan","age":67,"gender":"Nữ","roomNumber":"Hậu phẫu","ward":"","diagnosis":"","historySummary":"","admissionDate":"${todayISO}"}]

**INPUT TEXT:**
"${inputText}"

**LƯU Ý QUAN TRỌNG:**
- LUÔN trả về mảng, dù chỉ có 1 bệnh nhân
- roomNumber: CHỈ chọn từ danh sách có sẵn, KHÔNG tự sáng tạo
- ward: LUÔN LUÔN để "" (rỗng), backend sẽ tự động điền
- Không thêm field nào khác ngoài schema`,
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

        const parsedPatients = JSON.parse(response.text || '[]');

        // CRITICAL: Auto-map ward from roomNumber using the single source of truth
        return parsedPatients.map((patient: any) => ({
            ...patient,
            ward: getWardFromRoom(patient.roomNumber || 'Cấp cứu 1')
        }));
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

export const generateSurgerySchedule = async (patients: any[], alreadyScheduled: any[]) => {
    try {
        const patientsToSchedule = patients.map(p => ({ 
            id: p.id,
            fullName: p.fullName,
            diagnosis: p.diagnosis,
        }));

        const scheduledForContext = alreadyScheduled.map(p => ({
            id: p.id,
            operatingRoom: p.operatingRoom,
            surgeryTime: p.surgeryTime,
            surgeonName: p.surgeonName,
        }));

        if (patientsToSchedule.length === 0) {
            return [];
        }

        const prompt = `
1.  **VAI TRÒ & MỤC TIÊU**
    Bạn là Trợ lý AI Điều phối Lịch mổ, chuyên khoa Chấn thương Chỉnh hình. Nhiệm vụ của bạn là nhận một danh sách bệnh nhân, xác định thứ tự ưu tiên, tính toán thời gian mổ, và xếp lịch mổ cho họ vào các phòng mổ có sẵn một cách tối ưu nhất, **tránh xung đột với các ca đã có lịch sẵn**.

2.  **THÔNG TIN ĐẦU VÀO**
    -   **Danh sách bệnh nhân cần xếp:** Một mảng JSON các bệnh nhân, mỗi người có \`id\`, \`fullName\`, và \`diagnosis\`.
    -   **Danh sách bệnh nhân đã có lịch:** Dùng để kiểm tra và tránh xếp trùng giờ, trùng phòng.
    -   **Lịch làm việc:**
        -   Bắt đầu ca sáng: 08:00
        -   Kết thúc ca sáng (nghỉ trưa): 11:30
        -   Bắt đầu ca chiều: 13:30
        -   Kết thúc ca chiều: 17:00
    -   **Phòng mổ có sẵn:** ["Phòng 1", "Phòng 7", "Phòng 8", "Phòng 9", "Phòng 10"]

3.  **QUY TRÌNH XỬ LÝ (Từng bước)**

    **Bước 1: Phân tích & Ước tính thời gian cho mỗi bệnh nhân CẦN XẾP LỊCH**
    a.  **Xác định 'PPPT' (Phương pháp phẫu thuật):** Dựa vào \`diagnosis\`.
        -   "PT", "Phương tiện", "nẹp vít", "Đinh K" -> "Tháo phương tiện"
        -   "U phần mềm", "U..." -> "Bóc u"
        -   "Nhiễm trùng" -> "PT nạo viêm"
        -   "Khuyết hổng" -> "PT chuyển vạt da"
        -   "Gãy xương" -> "PT kết hợp xương"
        -   "Gãy cổ xương đùi" -> "PT thay khớp háng bán phần"
        -   "Hoại tử chỏm xương đùi" -> "PT thay khớp háng toàn phần"
        -   "Đứt dây chằng" -> "PTNS tái tạo dây chằng"
    b.  **Ước tính 'duration' (Thời gian mổ):** Dựa vào 'PPPT'.
        -   **60 phút:** "PT thay khớp háng bán phần", "PT thay khớp háng toàn phần", "PT chuyển vạt da", "PTNS tái tạo dây chằng", "PT kết hợp xương".
        -   **30 phút:** "Tháo phương tiện", "Bóc u", "PT nạo viêm".

    **Bước 2: Sắp xếp thứ tự ưu tiên mổ (chỉ cho bệnh nhân CẦN XẾP LỊCH)**
    1.  **Nhiễm trùng:** \`diagnosis\` chứa "viêm", "nhiễm trùng", "áp xe", "hoại tử".
    2.  **Ca đại phẫu:** \`duration\` là 60 phút.
    3.  **Ca trung phẫu:** \`duration\` là 30 phút.

    **Bước 3: Xếp lịch vào các phòng mổ**
    Tuần tự xếp từng bệnh nhân (theo thứ tự đã ưu tiên) vào các "slot" trống.
    -   **QUAN TRỌNG NHẤT:** Một "slot" chỉ được coi là trống nếu nó không bị trùng giờ và trùng phòng với bất kỳ ca nào trong danh sách **BỆNH NHÂN ĐÃ CÓ LỊCH**.
    -   Phải tuân thủ lịch nghỉ trưa (không có ca nào bắc cầu qua 11:30 - 13:30).
    -   **Quy tắc chọn phòng:**
        -   Nếu \`diagnosis\` chứa "viêm", "nhiễm trùng", "áp xe", "hoại tử" -> **Ưu tiên Phòng 1**.
        -   Các trường hợp còn lại -> **Ưu tiên Phòng 7, 8, 9, 10**.

4.  **DỮ LIỆU ĐẦU VÀO**

    **A. BỆNH NHÂN CẦN XẾP LỊCH:**
    \`\`\`json
    ${JSON.stringify(patientsToSchedule)}
    \`\`\`

    **B. BỆNH NHÂN ĐÃ CÓ LỊCH (Để tránh trùng lặp):**
    \`\`\`json
    ${JSON.stringify(scheduledForContext)}
    \`\`\`

5.  **ĐỊNH DẠNG ĐẦU RA**
    Chỉ trả về một mảng JSON. Mỗi object phải chứa:
    -   \`id\`: ID của bệnh nhân.
    -   \`PPPT\`: Phương pháp phẫu thuật đã xác định.
    -   \`operatingRoom\`: Phòng mổ được gán.
    -   \`surgeryTime\`: Giờ bắt đầu mổ, định dạng "HH:mm".
    -   \`surgeonName\`: Nếu 'PPPT' chứa "PTNS" hoặc "thay khớp", điền "Ts Minh", ngược lại để trống.
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            PPPT: { type: Type.STRING },
                            operatingRoom: { type: Type.STRING },
                            surgeryTime: { type: Type.STRING },
                            surgeonName: { type: Type.STRING },
                        },
                        required: ["id", "PPPT", "operatingRoom", "surgeryTime"]
                    }
                }
            }
        });

        const suggestions = JSON.parse(response.text || '[]');
        return suggestions;

    } catch (error) {
        console.error("Lỗi khi tạo lịch mổ:", error);
        return { error: true, message: "Không thể nhận được gợi ý từ AI. Vui lòng thử lại." };
    }
};