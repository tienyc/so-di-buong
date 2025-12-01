// components/SurgerySchedulerModal.tsx

import React, { useState, useEffect } from "react";
import { Patient } from "../types";
import {
  Loader,
  X,
  Edit2,
  AlertTriangle,
  CheckSquare,
  Square,
} from "lucide-react";

export type AISuggestion = {
  id: string;
  PPPT: string;
  operatingRoom: string;
  surgeryTime: string; // "HH:mm"
  surgeonName: string;
  surgeryDate?: string; // YYYY-MM-DD
};

interface SurgerySchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  suggestedSchedule: AISuggestion[];
  isLoading: boolean;
  onConfirm: (schedule: AISuggestion[]) => void;
  doctors: string[];
}

/* ----------------- Helpers cho logic trùng lịch ------------------- */

// Quy tắc thời lượng (khớp với frontend anh đang dùng)
function getDurationMinutes(pppt: string): number {
  const text = pppt.toLowerCase();
  if (
    text.includes("thay khớp") ||
    text.includes("chuyển vạt") ||
    text.includes("dây chằng") ||
    text.includes("khx")
  ) {
    return 60;
  }
  return 30;
}

// "HH:mm" -> phút từ 00:00
function timeToMinutes(t: string | undefined | null): number | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hours = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (clamped % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

type ConflictMap = Record<
  string,
  {
    reasons: string[];
  }
>;

// Phát hiện trùng giữa các ca trong cùng modal (chỉ xét ca được chọn)
function detectConflicts(schedule: AISuggestion[]): ConflictMap {
  const conflicts: ConflictMap = {};

  for (let i = 0; i < schedule.length; i++) {
    const a = schedule[i];
    const aRoom = a.operatingRoom?.trim();
    const aStart = timeToMinutes(a.surgeryTime);
    const aDur = getDurationMinutes(a.PPPT);
    const aEnd = aStart !== null ? aStart + aDur : null;

    if (!aRoom || aStart === null || aEnd === null) continue;

    for (let j = i + 1; j < schedule.length; j++) {
      const b = schedule[j];
      const bRoom = b.operatingRoom?.trim();
      const bStart = timeToMinutes(b.surgeryTime);
      const bDur = getDurationMinutes(b.PPPT);
      const bEnd = bStart !== null ? bStart + bDur : null;

      if (!bRoom || bStart === null || bEnd === null) continue;
      if (aRoom !== bRoom) continue;

      // Điều kiện giao nhau: [aStart, aEnd) vs [bStart, bEnd)
      const overlap = aStart < bEnd && bStart < aEnd;
      if (overlap) {
        const reason = `Trùng phòng ${aRoom} và khoảng thời gian với ca khác`;

        if (!conflicts[a.id]) conflicts[a.id] = { reasons: [] };
        if (!conflicts[b.id]) conflicts[b.id] = { reasons: [] };

        conflicts[a.id].reasons.push(reason);
        conflicts[b.id].reasons.push(reason);
      }
    }
  }

  return conflicts;
}

/* ------------------------- Component chính ------------------------ */

type EditableSuggestion = AISuggestion & {
  selected: boolean;
};

const SurgerySchedulerModal: React.FC<SurgerySchedulerModalProps> = ({
  isOpen,
  onClose,
  patients,
  suggestedSchedule,
  isLoading,
  onConfirm,
  doctors,
}) => {
  const [editableSchedule, setEditableSchedule] = useState<EditableSuggestion[]>(
    []
  );
  const [conflicts, setConflicts] = useState<ConflictMap>({});

  // Khởi tạo: mặc định chọn hết, ngày mổ = ngày mai nếu AI chưa trả
  useEffect(() => {
    if (!isOpen) return;

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowISO = tomorrow.toISOString().split("T")[0];

    setEditableSchedule(
      suggestedSchedule.map((item) => ({
        ...item,
        surgeryDate: item.surgeryDate || tomorrowISO,
        selected: true,
      }))
    );
  }, [suggestedSchedule, isOpen]);

  // Mỗi khi editableSchedule thay đổi → tính lại conflict cho những ca được chọn
  useEffect(() => {
    const active = editableSchedule
      .filter((s) => s.selected)
      .map((s) => ({
        id: s.id,
        PPPT: s.PPPT,
        operatingRoom: s.operatingRoom,
        surgeryTime: s.surgeryTime,
        surgeonName: s.surgeonName,
        surgeryDate: s.surgeryDate,
      }));
    setConflicts(detectConflicts(active));
  }, [editableSchedule]);

  if (!isOpen) return null;

  const handleScheduleChange = (
    id: string,
    field: keyof AISuggestion,
    value: string
  ) => {
    setEditableSchedule((currentSchedule) =>
      currentSchedule.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleToggleSelect = (id: string) => {
    setEditableSchedule((currentSchedule) =>
      currentSchedule.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const getPatientById = (id: string) => patients.find((p) => p.id === id);

  const handleAdjustTime = (id: string, deltaMinutes: number) => {
    setEditableSchedule((currentSchedule) =>
      currentSchedule.map((item) => {
        if (item.id !== id) return item;
        const current = timeToMinutes(item.surgeryTime) ?? 9 * 60;
        const nextTime = minutesToTime(current + deltaMinutes);
        return { ...item, surgeryTime: nextTime };
      })
    );
  };

  const hasConflicts = Object.keys(conflicts).length > 0;

  const selectedItems = editableSchedule.filter((s) => s.selected);

  // Nhắc thiếu: chỉ xét các ca được chọn
  const hasMissingRequired = selectedItems.some(
    (s) =>
      !s.operatingRoom?.trim() ||
      !s.surgeryTime?.trim() ||
      !s.surgeryDate?.trim()
  );

  const handleConfirm = () => {
    if (selectedItems.length === 0) {
      window.alert("Bạn chưa chọn ca nào để xếp lịch.");
      return;
    }

    const warnings: string[] = [];
    if (hasConflicts) warnings.push("- Có ca trùng phòng/giờ.");
    if (hasMissingRequired)
      warnings.push("- Có ca thiếu Ngày mổ, Phòng mổ hoặc Giờ bắt đầu.");

    if (warnings.length > 0) {
      const ok = window.confirm(
        `Lịch hiện tại còn một số vấn đề:\n${warnings.join(
          "\n"
        )}\n\nBạn vẫn muốn áp dụng lịch này chứ?`
      );
      if (!ok) return;
    }

    // Chỉ gửi các ca được chọn, bỏ field selected khi trả ra
    const finalSchedule: AISuggestion[] = selectedItems.map(
      ({ selected, ...rest }) => rest
    );

    onConfirm(finalSchedule);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-bold text-lg text-blue-600">
            Gợi ý và Chỉnh sửa Lịch mổ
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <Loader size={40} className="text-blue-500 animate-spin" />
              <p className="mt-4 text-gray-500 font-medium">
                AI đang phân tích và xếp lịch...
              </p>
              <p className="text-sm text-gray-400">
                Quá trình này có thể mất vài giây.
              </p>
            </div>
          )}

          {!isLoading && editableSchedule.length > 0 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm mb-4 flex gap-3">
                <Edit2 size={24} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Đây là gợi ý từ AI. Bạn có thể:
                  </p>
                  <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                    <li>Tích chọn các ca muốn xếp lịch trong đợt này.</li>
                    <li>
                      Chỉnh Ngày mổ, Phòng mổ, Giờ bắt đầu, PP phẫu thuật,
                      Phẫu thuật viên.
                    </li>
                    <li>
                      Hệ thống tự phát hiện trùng phòng/giờ và đánh dấu màu đỏ.
                    </li>
                  </ul>
                </div>
              </div>

              {hasConflicts && (
                <div className="bg-amber-50 border border-amber-300 text-amber-800 p-3 rounded-lg text-xs flex gap-2 items-start mb-4">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Đang có ít nhất một số ca trùng lịch.
                    </div>
                    <div>
                      Các ca bị trùng sẽ có viền đỏ và ghi chú
                      &quot;Trùng lịch phòng/giờ&quot;. Nên chỉnh lại trước khi
                      áp dụng.
                    </div>
                  </div>
                </div>
              )}

              {editableSchedule.map((item, index) => {
                const patient = getPatientById(item.id);
                if (!patient) return null;

                const conflictInfo = conflicts[item.id];
                const isConflict = !!conflictInfo;
                const isSelected = item.selected;
                const isMissing =
                  isSelected &&
                  (!item.operatingRoom?.trim() ||
                    !item.surgeryTime?.trim() ||
                    !item.surgeryDate?.trim());

                return (
                  <div
                    key={item.id}
                    className={`bg-gray-50 p-4 rounded-xl border transition-all ${
                      isConflict
                        ? "border-red-400 shadow-[0_0_0_1px_rgba(248,113,113,0.5)]"
                        : "border-gray-200/80"
                    } ${!isSelected ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox chọn ca */}
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(item.id)}
                        className="mt-1 text-gray-600 hover:text-blue-600"
                      >
                        {isSelected ? (
                          <CheckSquare size={20} />
                        ) : (
                          <Square size={20} />
                        )}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-baseline gap-3">
                          <span className="text-lg font-bold text-blue-600">
                            {index + 1}.
                          </span>
                          <div className="flex-1">
                            <div className="font-bold text-slate-800">
                              {patient.fullName}{" "}
                              <span className="font-normal text-gray-500">
                                ({patient.age}T)
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              {patient.diagnosis}
                            </div>
                          </div>
                          {/* Ngày mổ mini pill */}
                          <div className="text-xs text-gray-500">
                            <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 bg-white">
                              Ngày mổ:&nbsp;
                              <span className="font-semibold text-gray-800">
                                {item.surgeryDate}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 mt-4 pl-4">
                          <div className="col-span-2">
                            <label className="text-xs font-bold text-gray-500">
                              PP Phẫu thuật
                            </label>
                            <input
                              type="text"
                              value={item.PPPT}
                              onChange={(e) =>
                                handleScheduleChange(
                                  item.id,
                                  "PPPT",
                                  e.target.value
                                )
                              }
                              className="w-full text-sm p-2 border border-gray-300 rounded-md mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-500">
                              Phẫu thuật viên
                            </label>
                            <select
                              value={item.surgeonName}
                              onChange={(e) =>
                                handleScheduleChange(
                                  item.id,
                                  "surgeonName",
                                  e.target.value
                                )
                              }
                              className="w-full text-sm p-2 border border-gray-300 rounded-md mt-1"
                            >
                              <option value="">Chọn phẫu thuật viên</option>
                              {doctors.map((doc) => (
                                <option key={doc} value={doc}>
                                  {doc}
                                </option>
                              ))}
                              {item.surgeonName &&
                                !doctors.includes(item.surgeonName) && (
                                  <option value={item.surgeonName}>
                                    {item.surgeonName}
                                  </option>
                                )}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-500">
                              Ngày mổ
                            </label>
                            <input
                              type="date"
                              value={item.surgeryDate || ""}
                              onChange={(e) =>
                                handleScheduleChange(
                                  item.id,
                                  "surgeryDate",
                                  e.target.value
                                )
                              }
                              className="w-full text-sm p-2 border border-gray-300 rounded-md mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-500">
                              Phòng mổ
                            </label>
                            <input
                              type="text"
                              value={item.operatingRoom}
                              onChange={(e) =>
                                handleScheduleChange(
                                  item.id,
                                  "operatingRoom",
                                  e.target.value
                                )
                              }
                              className="w-full text-sm p-2 border border-gray-300 rounded-md mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-500">
                              Giờ bắt đầu
                            </label>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdjustTime(item.id, -30)
                                }
                                className="px-2 py-1 text-xs font-bold border border-gray-300 rounded-md bg-white hover:bg-gray-100"
                                title="Lùi 30 phút"
                              >
                                -30'
                              </button>
                              <input
                                type="time"
                                value={item.surgeryTime}
                                onChange={(e) =>
                                  handleScheduleChange(
                                    item.id,
                                    "surgeryTime",
                                    e.target.value
                                  )
                                }
                                className="w-full text-sm p-2 border border-gray-300 rounded-md"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleAdjustTime(item.id, 30)
                                }
                                className="px-2 py-1 text-xs font-bold border border-gray-300 rounded-md bg-white hover:bg-gray-100"
                                title="Tiến 30 phút"
                              >
                                +30'
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Cảnh báo trùng lịch */}
                        {isConflict && (
                          <div className="mt-3 pl-4 text-xs text-red-600 flex items-start gap-2">
                            <AlertTriangle size={14} className="mt-0.5" />
                            <div>
                              <div className="font-semibold">
                                ⚠ Trùng lịch phòng/giờ với ca khác
                              </div>
                              {conflictInfo.reasons.map((r, idx) => (
                                <div key={idx}>- {r}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Cảnh báo thiếu field bắt buộc */}
                        {isMissing && (
                          <div className="mt-2 pl-4 text-xs text-amber-600 flex items-start gap-2">
                            <AlertTriangle size={14} className="mt-0.5" />
                            <div>
                              <span className="font-semibold">
                                ⚠ Thiếu thông tin:
                              </span>{" "}
                              cần điền đủ Ngày mổ, Phòng mổ và Giờ bắt đầu cho
                              ca đã chọn.
                            </div>
                          </div>
                        )}

                        {/* Gợi ý nếu không chọn ca này */}
                        {!isSelected && (
                          <div className="mt-2 pl-4 text-[11px] text-gray-500 italic">
                            Ca này đang tạm bỏ qua trong đợt xếp lịch này.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && suggestedSchedule.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p>Không có bệnh nhân nào trong danh sách chờ mổ.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-between items-center gap-3">
          <div className="text-xs text-gray-500">
            Đã chọn{" "}
            <span className="font-semibold text-gray-800">
              {selectedItems.length}
            </span>{" "}
            / {editableSchedule.length} ca để xếp lịch.
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition-all"
            >
              Đóng
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading || editableSchedule.length === 0}
              className="px-8 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all shadow-md"
            >
              Áp dụng và Xếp lịch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurgerySchedulerModal;
