// services/localScheduler.ts

import { Patient } from "../types";

export type LocalSuggestion = {
  id: string;
  PPPT: string;
  operatingRoom: string;   // "1" | "7" | "8" | "9" | "10" | ""
  surgeryTime: string;     // "HH:mm" hoặc ""
  surgeonName: string;
  surgeryDate?: string;    // tùy anh dùng ở layer trên
};

export type ExistingSurgery = {
  id: string;
  operatingRoom: string;   // "1" | "7" | "8" | "9" | "10"
  surgeryTime: string;     // "HH:mm"
  PPPT?: string;
  diagnosis?: string;
};

/* ------------------------------------------------------------------ */
/*  1. Sinh PPPT từ chẩn đoán                                         */
/* ------------------------------------------------------------------ */
/**
 * Sinh PPPT dạng:
 *   - "PTNS tái tạo DCCT gối T"
 *   - "PT KHX đùi T"
 *   - "PT Tháo phương tiện cẳng chân P"
 *   - "PT Bóc u vai P"
 *   - "PT Nạo viêm cẳng chân"
 */
export function derivePPPTFromDiagnosis(diagnosis: string): string {
  const text = diagnosis.toLowerCase();

  // --- Nhóm dây chằng (nội soi) -----------------------------------
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

    const parts = [`PTNS tái tạo ${ligamentLabel}`, location, side].filter(Boolean);
    // VD: "PTNS tái tạo DCCT gối T"
    return parts.join(" ");
  }

  // --- Các nhóm còn lại -------------------------------------------
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
    text.includes("viem") ||
    text.includes("nhiễm trùng") ||
    text.includes("nhiem trung") ||
    text.includes("áp xe") ||
    text.includes("ap xe") ||
    text.includes("hoại tử") ||
    text.includes("hoai tu") ||
    text.includes("mủ")
  ) {
    base = "PT Nạo viêm";
  } else if (text.includes("khuyết hổng") || text.includes("lộ xương")) {
    base = "PT Chuyển vạt da";
  } else if (text.includes("gãy cổ xương đùi")) {
    base = "PT Thay khớp háng";
  } else if (text.includes("gãy")) {
    base = "PT KHX";
  }

  // Vị trí: viết thường giữa câu
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

  let side = "";
  if (text.includes("hai bên") || text.includes("2 bên")) {
    side = "2 bên";
  } else if (text.match(/\bbên trái\b/) || text.match(/\btrái\b/)) {
    side = "T";
  } else if (text.match(/\bbên phải\b/) || text.match(/\bphải\b/)) {
    side = "P";
  }

  const parts = [base, location, side].filter(Boolean);
  // VD: "PT KHX đùi T"
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/*  2. Thời lượng + đổi giờ                                           */
/* ------------------------------------------------------------------ */

function getDurationMinutes(pppt: string): number {
  const text = pppt.toLowerCase();
  if (
    text.includes("thay khớp") ||
    text.includes("ptns tái tạo") ||
    text.includes("dây chằng") ||
    text.includes("khx")
  ) {
    return 90;
  }
  if (text.includes("chuyển vạt")) {
    return 60;
  }
  return 30;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 59));
  const h = Math.floor(clamped / 60).toString().padStart(2, "0");
  const m = (clamped % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function requiresTsMinh(pppt: string): boolean {
  const text = pppt.toLowerCase();
  return (
    text.includes("ptns tái tạo") ||
    text.includes("tái tạo dây chằng") ||
    text.includes("thay khớp háng")
  );
}

type Block = {
  start: number;
  end: number;
  id: string;
};

/* ------------------------------------------------------------------ */
/*  3. Phân loại ca theo mức ưu tiên                                  */
/* ------------------------------------------------------------------ */

type PriorityTag =
  | "infection"
  | "tha_arthroscopy"
  | "khx_high_risk"
  | "khx_other"
  | "tumor"
  | "remove_implant"
  | "other_major"
  | "minor";

type ClassifiedCase = {
  patient: Patient;
  pppt: string;
  duration: number;
  priority: PriorityTag;
  // Tầng 1: luôn thử xếp vào đây trước
  primaryRooms: string[];
  // Tầng 2: chỉ dùng nếu primaryRooms không còn slot (bóc u & tháo PT)
  fallbackRooms?: string[];
};

function classifyCase(dx: string, pppt: string, age: number): {
  priority: PriorityTag;
  primaryRooms: string[];
  fallbackRooms?: string[];
} {
  const dxLower = dx.toLowerCase();
  const ppptLower = pppt.toLowerCase();

  // 1. Ca nhiễm trùng / viêm → phòng 1
  const isInfection =
    dxLower.includes("nhiễm trùng") ||
    dxLower.includes("nhiem trung") ||
    dxLower.includes("viêm") ||
    dxLower.includes("viem") ||
    dxLower.includes("áp xe") ||
    dxLower.includes("ap xe") ||
    dxLower.includes("hoại tử") ||
    dxLower.includes("hoai tu") ||
    dxLower.includes("mủ") ||
    ppptLower.startsWith("pt nạo viêm") ||
    ppptLower.startsWith("pt chuyển vạt da");

  if (isInfection) {
    return { priority: "infection", primaryRooms: ["1"] };
  }

  // 2. Thay khớp háng / nội soi DCCT/DCCS → mổ lớn ưu tiên trên
  const isTHA =
    dxLower.includes("gãy cổ xương đùi") ||
    dxLower.includes("gay co xuong dui") ||
    ppptLower.includes("thay khớp háng");

  const isArthroscopy =
    ppptLower.startsWith("ptns tái tạo") ||
    dxLower.includes("dcct") ||
    dxLower.includes("dccs") ||
    dxLower.includes("dây chằng chéo trước") ||
    dxLower.includes("dây chằng chéo sau");

  if (isTHA || isArthroscopy) {
    return {
      priority: "tha_arthroscopy",
      primaryRooms: ["7"],
      fallbackRooms: ["8"],
    };
  }

  // 3. Dựa theo PPPT: KHX / bóc u / tháo PT
  const isKHX =
    ppptLower.startsWith("pt khx") && !ppptLower.includes("tháo phương tiện");
  const isRemoveImplant =
    ppptLower.startsWith("pt tháo phương tiện") ||
    ppptLower.includes("tháo phương tiện");
  const isTumor = ppptLower.startsWith("pt bóc u");

  // 3.1 KHX người già >70 hoặc trẻ <7
  if (isKHX && (age >= 70 || age <= 7)) {
    return {
      priority: "khx_high_risk",
      primaryRooms: ["7", "8"],
    };
  }

  // 3.2 KHX thường
  if (isKHX) {
    return {
      priority: "khx_other",
      primaryRooms: ["7", "8"],
    };
  }

  // 3.3 Bóc u → primary 7–8, fallback 9–10
  if (isTumor) {
    return {
      priority: "tumor",
      primaryRooms: ["7", "8"],
      fallbackRooms: ["9", "10"],
    };
  }

  // 3.4 Tháo phương tiện → primary 7–8, fallback 9–10
  if (isRemoveImplant) {
    return {
      priority: "remove_implant",
      primaryRooms: ["7", "8"],
      fallbackRooms: ["9", "10"],
    };
  }

  // 4. Các mổ lớn khác (60p) → sau KHX, trước ca nhỏ
  const duration = getDurationMinutes(pppt);
  if (duration === 60) {
    return {
      priority: "other_major",
      primaryRooms: ["7", "8"],
    };
  }

  // 5. Ca nhỏ 30p → vẫn thử nhét 7–8 trước, nếu sau này anh muốn có thể thêm fallback 9–10
  return {
    priority: "minor",
    primaryRooms: ["7", "8"],
  };
}

/* ------------------------------------------------------------------ */
/*  4. Logic buổi sáng/chiều & chọn slot kết thúc sớm                 */
/* ------------------------------------------------------------------ */

const MORNING_START = 8 * 60;
const MORNING_END = 11 * 60 + 30;
const AFTERNOON_START = 13 * 60 + 30;
const AFTERNOON_END = 17 * 60;

/**
 * Tìm slot trống trong 1 phòng, 1 buổi, không vắt qua sessionEnd.
 */
function findFreeSlot(
  blocks: Block[],
  duration: number,
  sessionStart: number,
  sessionEnd: number
): number | null {
  let current = sessionStart;

  for (const b of blocks) {
    // khoảng trống trước block b
    if (current + duration <= b.start) {
      if (current + duration <= sessionEnd) return current;
      return null;
    }
    if (b.end > current) current = b.end;
    if (current >= sessionEnd) return null;
  }

  if (current + duration <= sessionEnd) return current;
  return null;
}

// Đếm số ca trong 1 buổi (để ưu tiên dây chuyền ít ca hơn)
function countBlocksInSession(
  blocks: Block[],
  sessionStart: number,
  sessionEnd: number
): number {
  return blocks.filter(
    (b) => b.start < sessionEnd && b.end > sessionStart
  ).length;
}

/**
 * Chọn slot tốt nhất:
 *  - Luôn ưu tiên BUỔI SÁNG nếu bất kỳ phòng nào còn slot.
 *  - Trong cùng một buổi:
 *      + chọn ca có thời điểm kết thúc sớm nhất,
 *      + nếu trùng, chọn phòng có ít ca hơn trong buổi,
 *      + nếu vẫn trùng, dùng thứ tự roomCandidates (vd ["7","8","9","10"]).
 */
function findBestSlotForRooms(
  roomBlocks: Record<string, Block[]>,
  roomCandidates: string[],
  duration: number
): { room: string; start: number } | null {
  type Candidate = { room: string; start: number; end: number; countInSession: number };

  // 1. Thử buổi sáng
  const morningCandidates: Candidate[] = [];

  for (const room of roomCandidates) {
    const blocks = roomBlocks[room] || [];
    const start = findFreeSlot(blocks, duration, MORNING_START, MORNING_END);
    if (start !== null) {
      const end = start + duration;
      const count = countBlocksInSession(blocks, MORNING_START, MORNING_END);
      morningCandidates.push({ room, start, end, countInSession: count });
    }
  }

  if (morningCandidates.length > 0) {
    morningCandidates.sort((a, b) => {
      if (a.end !== b.end) return a.end - b.end;
      if (a.countInSession !== b.countInSession)
        return a.countInSession - b.countInSession;
      return roomCandidates.indexOf(a.room) - roomCandidates.indexOf(b.room);
    });
    const best = morningCandidates[0];
    return { room: best.room, start: best.start };
  }

  // 2. Nếu sáng mọi phòng đều kín → thử chiều
  const afternoonCandidates: Candidate[] = [];

  for (const room of roomCandidates) {
    const blocks = roomBlocks[room] || [];
    const start = findFreeSlot(
      blocks,
      duration,
      AFTERNOON_START,
      AFTERNOON_END
    );
    if (start !== null) {
      const end = start + duration;
      const count = countBlocksInSession(
        blocks,
        AFTERNOON_START,
        AFTERNOON_END
      );
      afternoonCandidates.push({ room, start, end, countInSession: count });
    }
  }

  if (afternoonCandidates.length > 0) {
    afternoonCandidates.sort((a, b) => {
      if (a.end !== b.end) return a.end - b.end;
      if (a.countInSession !== b.countInSession)
        return a.countInSession - b.countInSession;
      return roomCandidates.indexOf(a.room) - roomCandidates.indexOf(b.room);
    });
    const best = afternoonCandidates[0];
    return { room: best.room, start: best.start };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  5. Hàm chính: autoScheduleLocally                                 */
/* ------------------------------------------------------------------ */

export function autoScheduleLocally(
  patientsToSchedule: Patient[],
  alreadyScheduled: ExistingSurgery[]
): LocalSuggestion[] {
  // 1. Xây map phòng -> blocks từ List B (đã xếp)
  const roomBlocks: Record<string, Block[]> = {};

  for (const s of alreadyScheduled) {
    const room = s.operatingRoom?.trim();
    if (!room) continue;
    if (!roomBlocks[room]) roomBlocks[room] = [];

    const basePPPT =
      s.PPPT ||
      (s.diagnosis ? derivePPPTFromDiagnosis(s.diagnosis) : "Phẫu thuật");
    const dur = getDurationMinutes(basePPPT);

    try {
      const start = timeToMinutes(s.surgeryTime);
      roomBlocks[room].push({
        id: s.id,
        start,
        end: start + dur,
      });
    } catch {
      // bỏ qua nếu giờ sai
    }
  }

  // sort blocks theo start
  Object.values(roomBlocks).forEach((blocks) =>
    blocks.sort((a, b) => a.start - b.start)
  );

  // 2. Phân loại từng bệnh nhân mới
  const classified: ClassifiedCase[] = patientsToSchedule.map((p) => {
    const dx = p.diagnosis || "";
    const age = typeof p.age === "number" ? p.age : 0;
    const pppt = derivePPPTFromDiagnosis(dx);
    const duration = getDurationMinutes(pppt);

    const { priority, primaryRooms, fallbackRooms } = classifyCase(
      dx,
      pppt,
      age
    );

    return { patient: p, pppt, duration, priority, primaryRooms, fallbackRooms };
  });

  // 3. Thứ tự ưu tiên toàn cục
  const priorityOrder: PriorityTag[] = [
    "infection",        // phòng 1
    "tha_arthroscopy",  // THA + nội soi DCCT/DCCS
    "khx_high_risk",    // KHX >70t/<7t
    "khx_other",        // KHX thường
    "tumor",            // Bóc u
    "remove_implant",   // Tháo PT
    "other_major",      // Mổ lớn khác
    "minor",            // Ca nhỏ
  ];

  classified.sort(
    (a, b) =>
      priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
  );

  const results: LocalSuggestion[] = [];

  // 4. Xếp lần lượt từng ca theo priority + primaryRooms + fallbackRooms
  for (const c of classified) {
    const { patient, pppt, duration, primaryRooms, fallbackRooms } = c;

    // Bước 1: luôn thử primaryRooms (7–8 hoặc 1)
    let best = findBestSlotForRooms(roomBlocks, primaryRooms, duration);

    // Bước 2: nếu không có slot & có fallback (Bóc u / Tháo PT) → thử 9–10
    if (!best && fallbackRooms && fallbackRooms.length > 0) {
      best = findBestSlotForRooms(roomBlocks, fallbackRooms, duration);
    }

    if (best) {
      const { room, start } = best;
      const timeStr = minutesToTime(start);

      if (!roomBlocks[room]) roomBlocks[room] = [];
      roomBlocks[room].push({
        id: patient.id,
        start,
        end: start + duration,
      });
      roomBlocks[room].sort((a, b) => a.start - b.start);

      const surgeonName = requiresTsMinh(pppt) ? "TS Minh" : "";

      results.push({
        id: patient.id,
        PPPT: pppt,
        operatingRoom: room,
        surgeryTime: timeStr,
        surgeonName,
      });
    } else {
      const surgeonName = requiresTsMinh(pppt) ? "TS Minh" : "";
      // Không tìm được slot ở bất cứ buổi/phòng nào
      results.push({
        id: patient.id,
        PPPT: pppt,
        operatingRoom: "",
        surgeryTime: "",
        surgeonName,
      });
    }
  }

  return results;
}
