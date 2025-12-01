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

// Mặc định nếu không tìm được phòng
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
 * Nếu sai/không khớp → rỗng để UI xử lý.
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
/*  Helper: sinh PPPT từ chẩn đoán (ưu tiên nhóm dây chằng)          */
/* ------------------------------------------------------------------ */

function derivePPPTFromDiagnosis(diagnosis: string): string {
  const text = diagnosis.toLowerCase();

  // 1️⃣ NHÓM DÂY CHẰNG – ưu tiên xử lý trước
  let ligamentLabel = "";

  if (text.includes("dcct")) {
    ligamentLabel = "DCCT";
  } else if (text.includes("dccs")) {
    ligamentLabel = "DCCS";
  } else if (text.includes("dây chằng chéo trước")) {
    ligamentLabel = "dây chằng chéo trước";
  } else if (text.includes("dây chằng chéo sau")) {
    ligamentLabel = "dây chằng chéo sau";
  }

  if (ligamentLabel) {
    // Vị trí & bên cho dây chằng
    let location = "";
    if (text.includes("gối")) location = "gối";

    let side = "";
    if (text.includes("hai bên") || text.includes("2 bên")) {
      side = "2 bên";
    } else if (text.match(/\bbên trái\b/) || text.match(/\btrái\b/)) {
      side = "T";
    } else if (text.match(/\bbên phải\b/) || text.match(/\bphải\b/)) {
      side = "P";
    }

    const parts = [`PTNS tái tạo ${ligamentLabel}`, location, side].filter(
      Boolean
    );
    // Ví dụ: "PTNS tái tạo DCCT gối P"
    return parts.join(" ");
  }

  // 2️⃣ CÁC NHÓM KHÁC (gãy, u, viêm, khuyết hổng...)
  let base = "Phẫu thuật";

  if (
    text.includes("nẹp") ||
    text.includes("vít") ||
    text.includes("đinh") ||
    text.includes("phương tiện")
  ) {
    base = "PT Tháo phương tiện";
  } else if (
    text.includes("u ") ||
    text.includes("u mỡ") ||
    text.includes("nang") ||
    text.includes("hạch") ||
    text.includes("bướu")
  ) {
    base = "PT Bóc u";
  } else if (
    text.includes("viêm") ||
    text.includes("nhiễm trùng") ||
    text.includes("áp xe") ||
    text.includes("hoại tử") ||
    text.includes("hở")
  ) {
    base = "PT Nạo viêm";
  } else if (text.includes("khuyết hổng") || text.includes("lộ xương")) {
    base = "PT Chuyển vạt da";
  } else if (text.includes("gãy cổ xương đùi")) {
    base = "PT Thay khớp háng";
  } else if (text.includes("gãy")) {
    base = "PT KHX";
  }

  // Vị trí: CHỮ THƯỜNG vì nằm giữa câu: "PT KHX đùi T"
  let location = "";
  if (text.includes("cẳng chân")) location = "cẳng chân";
  else if (text.includes("cẳng tay")) location = "cẳng tay";
  else if (text.includes("cánh tay")) location = "cánh tay";
  else if (text.includes("đùi")) location = "đùi";
  else if (text.includes("vai")) location = "vai";
  else if (text.includes("cổ tay")) location = "cổ tay";
  else if (text.includes("bàn tay")) location = "bàn tay";
  else if (text.includes("bàn chân")) location = "bàn chân";
  else if (text.includes("gối")) location = "gối";

  // Bên: T / P / 2 bên
  let side = "";
  if (text.includes("hai bên") || text.includes("2 bên")) {
    side = "2 bên";
  } else if (text.match(/\bbên trái\b/) || text.match(/\btrái\b/)) {
    side = "T";
  } else if (text.match(/\bbên phải\b/) || text.match(/\bphải\b/)) {
    side = "P";
  }

  const parts = [base, location, side].filter(Boolean);
  // Ví dụ: "PT KHX đùi T", "PT Nạo viêm cẳng chân P"
  return parts.join(" ");
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
    const workingDate = todayISO;

    const { validRooms, roomLookup } = buildRoomLookup();
    const roomWardMapping = getRoomWardMappingForPrompt();
    const allowedRooms = ["1", "7", "8", "9", "10"];

    // Placeholder for patientsToSchedule - should be populated from actual data
    const patientsToSchedule: any[] = [];
    const scheduledForContext: any[] = [];

    const prompt = `
I. VAI TRÒ
Bạn là AI điều phối lịch mổ Chấn thương chỉnh hình.

II. NGÀY LÀM VIỆC
- Ngày đang cần xếp lịch: ${workingDate} (YYYY-MM-DD)
- Các ca trong "List A" mặc định sẽ được xếp trong ngày này.
- "List B" là các ca đã xếp (có thể ở ngày khác), dùng để tham khảo pattern phân bố.

III. DỮ LIỆU
1. List A (Cần xếp trong ngày ${workingDate}):
${JSON.stringify(patientsToSchedule)}

2. List B (Đã xếp trước đó - context):
${JSON.stringify(scheduledForContext)}

3. Khung giờ & Phòng mổ:
- Buổi sáng: 08:00–11:30
- Buổi chiều: 13:30–17:00
- Phòng mổ hợp lệ: ${allowedRooms.join(", ")}

IV. CHUẨN HÓA PPPT & THỜI LƯỢNG

BƯỚC 1: CHUẨN HÓA PPPT
Tạo trường "PPPT" từ chẩn đoán:

[TÊN CƠ BẢN] + " " + [VỊ TRÍ & BÊN]

1. [TÊN CƠ BẢN] (ưu tiên từ trên xuống):
- Nếu chẩn đoán chứa "Nẹp", "Vít", "Đinh", "Phương tiện" → "PT Tháo phương tiện"
- Nếu chứa "U", "Nang", "Hạch", "Bướu" → "PT Bóc u"
- Nếu chứa "Viêm", "Nhiễm trùng", "Áp xe", "Hoại tử", "Hở" → "PT Nạo viêm"
- Nếu chứa "Khuyết hổng", "Lộ xương" → "PT Chuyển vạt da"
- Nếu chứa "Gãy cổ xương đùi" → "PT Thay khớp háng"
- Nếu chứa "Gãy" (các vị trí khác) → "PT KHX"
- Nếu chứa "Dây chằng" → "PTNS tái tạo dây chằng"
- Không thuộc các nhóm trên → "Phẫu thuật"

2. [VỊ TRÍ & BÊN]:
- Vị trí: Đùi, Cẳng chân, Cánh tay, Cẳng tay, Vai, Cổ tay, Ngón...
- Bên: "T", "P", "2 bên".
- Ví dụ:
  - "Gãy kín 1/3 giữa xương đùi T" → "PT KHX Đùi T"
  - "U mỡ vùng bả vai P" → "PT Bóc u vai P"
  - "Nhiễm trùng vết mổ cẳng chân" → "PT Nạo viêm cẳng chân"

BƯỚC 2: THỜI LƯỢNG (Duration)
- 60 phút nếu PPPT chứa: "Thay khớp", "Chuyển vạt", "Dây chằng", "KHX".
- 30 phút cho các trường hợp còn lại.

V. PHÂN LOẠI ƯU TIÊN
- Ưu tiên 1: ca Nhiễm trùng/Viêm → nên xếp **phòng 1** nếu có thể.
- Ưu tiên 2: Đại phẫu 60 phút.
- Ưu tiên 3: Tiểu phẫu 30 phút.

VI. LOGIC XẾP LỊCH TRONG NGÀY ${workingDate} – DÀN TRẢI THEO BUỔI

Mục tiêu:
- Không để phòng 7 quá tải trong khi 8–9–10 còn trống.
- Hạn chế đẩy bệnh nhân xuống **buổi chiều** nếu **buổi sáng** ở phòng khác còn slot.
- Ưu tiên phòng 7 và 8, nhưng **trong cùng một buổi** phải dàn trải giữa 7 và 8 trước khi dùng 9–10.

1. Khái niệm:
- Mỗi (phòng, buổi) là một "dây chuyền" riêng:
  - 1_sáng, 1_chiều, 7_sáng, 7_chiều, 8_sáng, 8_chiều, 9_sáng, 9_chiều, 10_sáng, 10_chiều.
- Chỉ xếp ca trong ngày ${workingDate}. Không vắt ca sang ngày khác.

2. Thứ tự xếp:
- Duyệt bệnh nhân theo mức độ ưu tiên: Ưu tiên 1 → 2 → 3 (trong mỗi nhóm, giữ nguyên thứ tự nhập).
- Với từng bệnh nhân, thực hiện lần lượt:

  2.1. THỬ BUỔI SÁNG TRƯỚC:
    a. Nếu là ca nhiễm trùng:
       - Cố gắng xếp **phòng 1 buổi sáng** nếu còn slot (08:00–11:30, không trùng ca phòng 1).
       - Nếu phòng 1 sáng không còn slot, cho phép dùng phòng 1 buổi chiều theo logic ở mục "Buổi chiều" bên dưới.

    b. Nếu là ca sạch (không nhiễm trùng):
       - ƯU TIÊN SÁNG, và trong buổi sáng:
         i. Đầu tiên xét **phòng 7 và 8 buổi sáng**:
            - Với mỗi phòng (7_sáng, 8_sáng):
              • Tính thời điểm bắt đầu sớm nhất có thể trong khoảng 08:00–11:30.
              • Không được trùng giờ với ca đã xếp trong phòng đó.
              • Ca không được vắt qua 11:30.
            - Trong các slot hợp lệ của 7_sáng và 8_sáng:
              • Chọn phương án có **giờ kết thúc sớm nhất**.
              • Nếu hoà, chọn phòng có **ít ca hơn trong buổi sáng**.
              • Nếu còn hoà, chọn phòng có số nhỏ hơn.

         ii. Chỉ khi **không còn slot hợp lệ ở 7_sáng và 8_sáng**:
            - Mới xét tiếp **phòng 9_sáng và 10_sáng** theo nguyên tắc tương tự:
              • Tìm slot sớm nhất không trùng, không vắt qua 11:30.
              • Chọn phương án kết thúc sớm nhất, ít ca hơn, số phòng nhỏ hơn (9 trước 10).
       - Nếu **bất kỳ phòng nào trong 7,8,9,10 buổi sáng còn slot hợp lệ**, phải xếp vào BUỔI SÁNG
         (không được đẩy sang buổi chiều).

  2.2. CHỈ KHI MỌI PHÒNG 7–8–9–10 BUỔI SÁNG ĐỀU KHÔNG CÒN SLOT:
    - Mới bắt đầu xếp sang BUỔI CHIỀU (13:30–17:00) cho ngày ${workingDate}.

    - Quy tắc cho BUỔI CHIỀU:
      a. Ca nhiễm trùng:
         - Ưu tiên phòng 1 buổi chiều (1_chiều): tìm slot sớm nhất 13:30–17:00, không trùng, không vắt qua 17:00.
      b. Ca sạch:
         - Áp dụng thứ tự phòng **7,8 trước, sau đó 9,10** trong BUỔI CHIỀU:
           • Bước 1: xét 7_chiều và 8_chiều → chọn slot hợp lệ kết thúc sớm nhất, ưu tiên dây chuyền ít ca hơn.
           • Nếu không còn slot ở 7_chiều và 8_chiều → xét 9_chiều, 10_chiều tương tự.

3. Quy tắc kiểm tra xung đột:
- Một ca được xem là trùng nếu khoảng [Start, End) của nó giao nhau (overlap) với bất kỳ ca nào đã được xếp
  trong cùng phòng và cùng ngày ${workingDate}.
- Không được vắt ca qua:
  - Buổi sáng: KHÔNG vắt quá 11:30.
  - Buổi chiều: KHÔNG vắt quá 17:00.
- Không xếp ca vào khoảng 11:30–13:30.

4. Tuyệt đối KHÔNG được dồn tất cả ca sạch vào duy nhất một phòng rồi mới dùng phòng khác.
- Ví dụ sai: xếp lần lượt 7_sáng đầy, 7_chiều đầy, rồi mới bắt đầu dùng 8_sáng.
- Cách làm đúng: nếu 7_sáng vẫn còn ca nhưng 8_sáng đang trống, thì nên dàn trải sang 8_sáng trước khi đẩy ca xuống chiều.

VII. ĐỊNH DẠNG ĐẦU RA
Trả về mảng JSON, mỗi phần tử:

{
  "id": "id của bệnh nhân từ List A",
  "PPPT": "Theo chuẩn BƯỚC 1",
  "operatingRoom": "1 hoặc 7 hoặc 8 hoặc 9 hoặc 10",
  "surgeryTime": "HH:mm (giờ bắt đầu)",
  "surgeonName": "Tên phẫu thuật viên (có thể rỗng)",
  "surgeryDate": "${workingDate}"
}

- "surgeryDate" LUÔN ở dạng YYYY-MM-DD và trong hầu hết trường hợp là "${workingDate}".
- Không thêm field nào khác ngoài các field này.
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
/*  4. Dùng AI gợi ý lịch mổ (AI lo phòng/giờ, PPPT tự sinh từ Dx)    */
/* ------------------------------------------------------------------ */

type AIScheduleRaw = {
  id?: string;
  operatingRoom?: string;
  surgeryTime?: string;
  surgeonName?: string;
  // PPPT từ AI không bắt buộc vì ta tự sinh từ chẩn đoán
  PPPT?: string;
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

    // Lookup chẩn đoán theo id để sinh PPPT
    const diagnosisById = new Map<string, string>();
    for (const p of patientsToSchedule) {
      diagnosisById.set(p.id, p.diagnosis || "");
    }

    const scheduledForContext = alreadyScheduled.map((p) => ({
      id: p.id,
      operatingRoom: p.operatingRoom,
      surgeryTime: p.surgeryTime,
      info: p.PPPT || p.diagnosis || "Phẫu thuật",
    }));

    if (patientsToSchedule.length === 0) return [];

    const patientsJson = JSON.stringify(patientsToSchedule);
    const scheduledJson = JSON.stringify(scheduledForContext);

    const prompt = `
I. VAI TRÒ
Bạn là AI điều phối lịch mổ Chấn thương chỉnh hình.
II. DỮ LIỆU
1. List A (Cần xếp): ${patientsJson}
2. List B (Đã xếp): ${scheduledJson}
3. Tài nguyên:
   - Buổi sáng: 08:00-11:30
   - Buổi chiều: 13:30-17:00
   - Phòng mổ hợp lệ: "1", "7", "8", "9", "10" (output phải đúng các chuỗi này, không thêm phòng khác).

III. QUY TẮC XỬ LÝ (TÓM TẮT)
1. Ước lượng thời lượng:
   - 60 phút nếu là các ca lớn (thay khớp, chuyển vạt, gãy xương dài, dây chằng...).
   - 30 phút cho các ca còn lại.
2. Phân loại sạch / nhiễm:
   - Nhiễm trùng/viêm/áp xe -> ưu tiên Phòng 1.
   - Ca sạch → ưu tiên lấp đầy 7,8 rồi mới đến 9,10.
3. Xếp lịch:
   - Không cho trùng khoảng thời gian với List B cùng phòng.
   - Không trùng với các ca A đã xếp trước.
   - Không vắt qua trưa (11:30-13:30).

IV. ĐẦU RA
- Bạn KHÔNG cần tự suy luận PPPT.
- CHỈ cần đề xuất phòng mổ và giờ mổ cho từng id trong List A.
- Nếu không xếp được slot hợp lệ, hãy trả operatingRoom = "" và surgeryTime = "".

V. ĐỊNH DẠNG JSON
Trả về MẢNG JSON:
[
  {
    "id": "...",                    // id bệnh nhân tương ứng
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
              operatingRoom: { type: Type.STRING },
              surgeryTime: { type: Type.STRING },
              surgeonName: { type: Type.STRING },
              PPPT: { type: Type.STRING },
            },
            required: ["id", "operatingRoom", "surgeryTime"],
          },
        },
      },
    });

    const raw = safeJsonParse<AIScheduleRaw[]>(response.text, []);

    const cleaned = raw
      .filter((s) => s && s.id)
      .map((s) => {
        const operatingRoom = normalizeOperatingRoom(s.operatingRoom);
        const surgeryTime = normalizeSurgeryTime(s.surgeryTime);

        const originalDx = diagnosisById.get(s.id!) || "";
        const finalPPPT = originalDx
          ? derivePPPTFromDiagnosis(originalDx)
          : (s.PPPT || "").trim() || "Phẫu thuật";

        return {
          id: s.id as string,
          PPPT: finalPPPT,
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
