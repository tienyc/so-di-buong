// services/geminiService.ts

import { GoogleGenAI, Type } from "@google/genai";
import {
  getWardFromRoom,
  getRoomWardMappingForPrompt,
  getAllValidRooms,
} from "./roomMapping";

// Re-export cho nơi khác dùng nếu cần
export { getWardFromRoom } from "./roomMapping";

const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

/* ------------------------------------------------------------------ */
/*  Helpers chung                                                     */
/* ------------------------------------------------------------------ */

function safeJsonParse<T>(text: string | undefined | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("JSON parse error:", err);
    return fallback;
  }
}

// Xây lookup cho room: "b2" -> "B2"
function buildRoomLookup() {
  const validRooms = getAllValidRooms();
  const roomLookup: Record<string, string> = {};
  for (const room of validRooms) {
    roomLookup[room.toLowerCase().trim()] = room;
  }
  return { validRooms, roomLookup };
}

const DEFAULT_ROOM = "Cấp cứu 1";

/**
 * Nếu raw rỗng → DEFAULT_ROOM
 * Nếu raw trùng (không phân biệt hoa/thường) với danh sách hợp lệ → trả về dạng chuẩn (vd "B2")
 * Nếu raw không khớp gì → DEFAULT_ROOM
 */
function normalizeRoomNumber(
  raw: string | undefined | null,
  roomLookup: Record<string, string>
): string {
  if (!raw) return DEFAULT_ROOM;
  const key = raw.toLowerCase().trim();
  return roomLookup[key] || DEFAULT_ROOM;
}

/**
 * Chuẩn hoá ngày vào viện:
 * - Nếu AI trả YYYY-MM-DD hợp lệ → dùng
 * - Nếu không có / sai format → dùng todayISO
 */
function normalizeAdmissionDate(
  raw: string | undefined | null,
  todayISO: string
): string {
  if (!raw) return todayISO;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayISO;
}

/**
 * Chuẩn hoá phòng mổ: chỉ cho phép "1","7","8","9","10".
 * Nếu sai/không khớp → rỗng để layer trên xử lý tiếp.
 */
const VALID_OR_ROOMS = ["1", "7", "8", "9", "10"];

function normalizeOperatingRoom(raw: string | undefined | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const noLeadingZero = trimmed.replace(/^0+/, "") || "0";
  return VALID_OR_ROOMS.includes(noLeadingZero) ? noLeadingZero : "";
}

/**
 * Chuẩn hoá giờ mổ: chỉ nhận "HH:mm". Nếu sai → rỗng.
 */
function normalizeSurgeryTime(raw: string | undefined | null): string {
  if (!raw) return "";
  const value = raw.trim();
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  return "";
}

/* ------------------------------------------------------------------ */
/*  1. Dùng AI để phân tích text nhập bệnh nhân                       */
/* ------------------------------------------------------------------ */

type RawPatient = {
  fullName?: string;
  age?: number;
  gender?: string;
  diagnosis?: string;
  roomNumber?: string;
  historySummary?: string;
  admissionDate?: string;
};

export const parsePatientInput = async (inputText: string) => {
  try {
    const now = new Date();
    const currentDate = now.toLocaleDateString("vi-VN");
    const todayISO = now.toISOString().split("T")[0];

    const { validRooms, roomLookup } = buildRoomLookup();
    const roomWardMapping = getRoomWardMappingForPrompt();

    const prompt = `
Bạn là AI chuyên phân tích danh sách bệnh nhân trong ứng dụng y tế SmartRound.

**NHIỆM VỤ:**
Phân tích văn bản không có cấu trúc (có thể 1 hoặc nhiều bệnh nhân) và trả về MẢNG JSON theo schema.

**NGÀY HIỆN TẠI:** ${currentDate} (${todayISO})

**QUY TẮC PHÂN TÍCH:**

1️⃣ Họ tên (fullName):
   - Viết hoa chữ cái đầu mỗi từ
   - Loại bỏ số thứ tự: "1. Nguyễn Văn A" → "Nguyễn Văn A"
   - Ví dụ: "anh tùng" → "Anh Tùng"

2️⃣ Tuổi (age):
   - Tìm số kèm: "45t", "45T", "45 tuổi", "t45"
   - Hoặc số 2 chữ số (10-99) đứng sau tên, không phải ngày tháng
   - Không tìm thấy → 0

3️⃣ Giới tính (gender):
   - Nam: "nam", "n", "m", "ông", "anh", "bác" (nam)
   - Nữ: "nữ", "nu", "f", "bà", "chị", "cô"
   - Không rõ → ""

4️⃣ ⚠️ PHÒNG (roomNumber):
   - Nếu trong text có ghi phòng (B1, B2, B8, Hồi sức, Cấp cứu 1, DV1, v.v.) thì hãy trích ra.
   - Khi trả về JSON, roomNumber CHỈ được dùng một trong các giá trị sau (đúng chính tả như bên dưới):
     ${validRooms.map((r) => `"${r}"`).join(", ")}

   - Không được sáng tạo thêm tên phòng mới.
   - Nếu không tìm thấy phòng nào phù hợp trong input → roomNumber = "${DEFAULT_ROOM}".

5️⃣ ⚠️ KHU (ward):
   - Bạn có thể để ward rỗng hoặc bỏ qua trong JSON.
   - Backend sẽ tự map ward từ roomNumber theo bảng sau:
${roomWardMapping}

6️⃣ Chẩn đoán (diagnosis):
   - Tên bệnh: gãy, trật, viêm, u, áp xe, nhiễm trùng...
   - Vị trí: đùi, chân, bàn chân, ngón tay...
   - Viết hoa chữ cái đầu câu.

7️⃣ Tình trạng (historySummary):
   - Triệu chứng: đau, sưng, đỏ, sốt, khó thở...
   - Diễn biến: tỉnh táo, tiếp xúc tốt, ăn uống được...

8️⃣ Ngày vào viện (admissionDate):
   - Nếu thấy: "23/11", "23-11", "Ngày 23", "hôm nay", "hôm qua"… → hãy suy luận và trả về dạng YYYY-MM-DD.
   - Nếu KHÔNG thấy thông tin ngày → admissionDate = "${todayISO}".

**VÍ DỤ ĐÚNG:**

Input: "Nguyễn Văn B, 45t, gãy xương đùi, phòng B2"
Output: [{
  "fullName": "Nguyễn Văn B",
  "age": 45,
  "gender": "Nam",
  "roomNumber": "B2",
  "diagnosis": "Gãy xương đùi",
  "historySummary": "",
  "admissionDate": "${todayISO}"
}]

Input: "Bà Lan 67t, Hậu phẫu, Hôm qua nhập viện"
Output: [{
  "fullName": "Bà Lan",
  "age": 67,
  "gender": "Nữ",
  "roomNumber": "${DEFAULT_ROOM}",
  "diagnosis": "Hậu phẫu",
  "historySummary": "",
  "admissionDate": "YYYY-MM-DD tương ứng hôm qua"
}]

**INPUT TEXT:**
"${inputText}"

**LƯU Ý QUAN TRỌNG:**
- LUÔN trả về mảng JSON, dù chỉ có 1 bệnh nhân.
- roomNumber: CHỈ chọn từ danh sách có sẵn, hoặc "${DEFAULT_ROOM}" nếu không tìm được.
- ward: không bắt buộc, backend sẽ bỏ qua và tự map lại từ roomNumber.
- Không thêm field nào khác ngoài: fullName, age, gender, diagnosis, roomNumber, historySummary, admissionDate.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              fullName: {
                type: Type.STRING,
                description: "Họ tên viết hoa chữ cái đầu",
              },
              age: { type: Type.NUMBER, description: "Tuổi, mặc định 0" },
              gender: {
                type: Type.STRING,
                description: "Nam/Nữ hoặc rỗng",
              },
              diagnosis: {
                type: Type.STRING,
                description: "Chẩn đoán, viết hoa chữ đầu",
              },
              roomNumber: {
                type: Type.STRING,
                description: "Mã phòng hợp lệ hoặc Cấp cứu 1",
              },
              historySummary: {
                type: Type.STRING,
                description: "Tình trạng lâm sàng",
              },
              admissionDate: {
                type: Type.STRING,
                description: "YYYY-MM-DD",
              },
            },
            required: ["fullName", "diagnosis"],
          },
        },
      },
    });

    const rawPatients = safeJsonParse<RawPatient[]>(response.text, []);

    const cleaned = rawPatients
      .filter(
        (p) =>
          p &&
          typeof p.fullName === "string" &&
          p.fullName.trim() &&
          typeof p.diagnosis === "string"
      )
      .map((p) => {
        const roomNumber = normalizeRoomNumber(p.roomNumber, roomLookup);
        const ward = getWardFromRoom(roomNumber) || ""; // luôn lấy từ mapping, không tạo khu mới

        return {
          fullName: p.fullName!.trim(),
          age: typeof p.age === "number" ? p.age : 0,
          gender: p.gender ?? "",
          diagnosis: p.diagnosis!.trim(),
          historySummary: (p.historySummary ?? "").trim(),
          roomNumber, // B2 / Hậu phẫu / Cấp cứu 1… (đã chuẩn hóa)
          ward, // auto từ roomNumber
          admissionDate: normalizeAdmissionDate(p.admissionDate, todayISO), // nếu không có → hôm nay
        };
      });

    return cleaned;
  } catch (error) {
    console.error("Error parsing patient input:", error);
    return [];
  }
};

/* ------------------------------------------------------------------ */
/*  2. Format dữ liệu cho Google Sheets                               */
/* ------------------------------------------------------------------ */

export const formatForGoogleSheet = async (patients: any[]) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

/* ------------------------------------------------------------------ */
/*  3. Gợi ý y lệnh từ chẩn đoán + diễn biến                          */
/* ------------------------------------------------------------------ */

export const suggestOrders = async (diagnosis: string, history: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Suggest 3-5 standard medical orders (in Vietnamese) for a patient with:
Diagnosis: ${diagnosis}
History: ${history}

Return ONLY a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    return safeJsonParse<string[]>(response.text, []);
  } catch (error) {
    console.error("Error suggesting orders:", error);
    return [];
  }
};

/* ------------------------------------------------------------------ */
/*  4. Dùng AI gợi ý lịch mổ (có chuẩn hoá phòng mổ & giờ)            */
/* ------------------------------------------------------------------ */

type AIScheduleRaw = {
  id?: string;
  PPPT?: string;
  operatingRoom?: string;
  surgeryTime?: string;
  surgeonName?: string;
};

export const generateSurgerySchedule = async (
  patients: any[],
  alreadyScheduled: any[]
) => {
  try {
    const patientsToSchedule = patients.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      diagnosis: p.diagnosis,
    }));

    const scheduledForContext = alreadyScheduled.map((p) => ({
      id: p.id,
      operatingRoom: p.operatingRoom,
      surgeryTime: p.surgeryTime,
      info: p.PPPT || p.diagnosis || "Phẫu thuật",
    }));

    if (patientsToSchedule.length === 0) return [];

    const prompt = `
I. VAI TRÒ
Bạn là AI điều phối lịch mổ Chấn thương chỉnh hình.

II. DỮ LIỆU
1. List A (Cần xếp): ${JSON.stringify(patientsToSchedule)}
2. List B (Đã xếp): ${JSON.stringify(scheduledForContext)}
3. Tài nguyên:
   - Buổi sáng: 08:00-11:30
   - Buổi chiều: 13:30-17:00
   - Phòng mổ hợp lệ: "1", "7", "8", "9", "10" (output phải đúng các chuỗi này, không thêm phòng khác).

III. QUY TRÌNH XỬ LÝ (LOGIC CỐT LÕI)

BƯỚC 1: CHUẨN HÓA PPPT & THỜI GIAN (BẮT BUỘC CHÍNH XÁC)
Bạn phải tạo ra trường 'PPPT' theo công thức ghép chuỗi sau:
**Công thức:** \`[TÊN CƠ BẢN] + " " + [VỊ TRÍ & BÊN]\`

1. Quy tắc xác định [TÊN CƠ BẢN] (Ưu tiên từ trên xuống):
   - Nếu chứa "Nẹp", "Vít", "Đinh", "Phương tiện" -> "PT Tháo phương tiện"
   - Nếu chứa "U", "Nang", "Hạch", "Bướu" -> "PT Bóc u"
   - Nếu chứa "Viêm", "Nhiễm trùng", "Áp xe", "Hoại tử", "Hở" -> "PT Nạo viêm"
   - Nếu chứa "Khuyết hổng", "Lộ xương" -> "PT Chuyển vạt da"
   - Nếu chứa "Gãy cổ xương đùi" -> "PT Thay khớp háng"
   - Nếu chứa "Gãy" (các vị trí khác) -> "PT KHX"
   - Nếu chứa "Dây chằng chéo trước ", "DCCT", "DCCS" -> "PTNS tái tạo" "dây chằng chéo trước" hoặc " DCCT", "DCCS".
   - Không thuộc các nhóm trên -> "Phẫu thuật"

2. Quy tắc trích xuất [VỊ TRÍ & BÊN]:
   - Tìm từ chỉ vị trí: đùi, cẳng chân, cánh tay, cẳng tay, vai, cổ tay, ngón...
   - Viết thường không viết hoa các từ chỉ vị trí
   - Tìm từ chỉ bên: "T" (Trái), "P" (Phải), "2 bên".
   - Giữ nguyên chữ hoa/thường của T và P.

3. Ví dụ mẫu:
   - Input: "Gãy kín 1/3 giữa xương đùi T" -> Output PPPT: "PT KHX Đùi T"
   - Input: "U mỡ vùng bả vai P" -> Output PPPT: "PT Bóc u vai P"
   - Input: "Nhiễm trùng vết mổ cẳng chân" -> Output PPPT: "PT Nạo viêm cẳng chân"

4. Xác định Duration (Thời lượng):
   - 60 phút: nếu PPPT chứa "Thay khớp", "Chuyển vạt", "Dây chằng", "KHX".
   - 30 phút: các trường hợp còn lại.
   (Áp dụng quy tắc tính Duration này cho cả List A và List B để tính khoảng bận).

BƯỚC 2: PHÂN LOẠI ƯU TIÊN (Priority)
1. Ưu tiên 1 (Nhiễm trùng/Viêm): Bắt buộc xếp Phòng 1.
2. Ưu tiên 2 (Đại phẫu 60p): Xếp sau.
3. Ưu tiên 3 (Tiểu phẫu 30p): Xếp cuối.

BƯỚC 3: XẾP LỊCH & CHECK XUNG ĐỘT
Duyệt từng ca A tìm Slot trống:
1. Phân tầng phòng:
   - Ca Nhiễm trùng -> Chỉ Phòng 1.
   - Ca Sạch -> Ưu tiên lấp đầy Phòng 7, 8. Nếu kín mới sang 9, 10.
2. Luật Check Trùng (Collision Check):
   - Slot [Start, End] KHÔNG ĐƯỢC trùng phút nào với List B tại phòng đó.
   - KHÔNG ĐƯỢC trùng với các ca A đã xếp trước đó.
   - KHÔNG ĐƯỢC vắt qua trưa (11:30-13:30).
3. Nếu không tìm được slot hợp lệ cho một ca, bạn vẫn trả ca đó với operatingRoom = "" và surgeryTime = "" (để backend biết là chưa xếp được).

IV. ĐỊNH DẠNG ĐẦU RA
Trả về MẢNG JSON:
[
  {
    "id": "...",              // id bệnh nhân tương ứng
    "PPPT": "Theo chuẩn ở Bước 1",
    "operatingRoom": "1|7|8|9|10 hoặc rỗng nếu không xếp được",
    "surgeryTime": "HH:mm hoặc rỗng nếu không xếp được",
    "surgeonName": "Tên phẫu thuật viên gợi ý hoặc rỗng"
  }
]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
            required: ["id", "PPPT", "operatingRoom", "surgeryTime"],
          },
        },
      },
    });

    const raw = safeJsonParse<AIScheduleRaw[]>(response.text, []);

    const cleaned = raw
      .filter((s) => s && s.id && s.PPPT)
      .map((s) => {
        const operatingRoom = normalizeOperatingRoom(s.operatingRoom);
        const surgeryTime = normalizeSurgeryTime(s.surgeryTime);

        return {
          id: s.id as string,
          PPPT: s.PPPT!.trim(),
          operatingRoom, // chỉ "1|7|8|9|10" hoặc ""
          surgeryTime, // "HH:mm" hoặc ""
          surgeonName: (s.surgeonName ?? "").trim(),
        };
      });

    return cleaned;
  } catch (error) {
    console.error("Lỗi AI xếp lịch:", error);
    return [];
  }
};
