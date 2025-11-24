// src/services/api.ts
import { Patient, MedicalOrder } from '../types';
import {
  mapRawPatient,
  mapRawOrder,
  mapWardConfig,
  mapDropdownConfig,
  serializeWardToRaw,
  serializeDropdownToRaw,
  SettingsPayload,
  WardConfig,
  DropdownConfig,
  DropdownType,
} from './sheetMapping';

/**
 * Đọc env nếu chạy qua Vite (local), còn khi chạy thuần browser (Vercel + importmap)
 * thì import.meta.env sẽ là undefined → dùng fallback mặc định.
 */
const env = ((importMeta: ImportMeta | undefined) => {
  try {
    return (importMeta as any)?.env ?? {};
  } catch {
    return {};
  }
})(import.meta as ImportMeta | undefined);

// ✅ URL & SECRET chính thức dùng cho mọi môi trường
const API_URL: string =
  (env && (env as any).VITE_API_URL) ||
  'https://script.google.com/macros/s/AKfycbzgljIc8hNHam5zd7P2IuKFXL9vgJhm9NY9M0ntqVQvKg9mblrCYrnd3XjTQuGNyo8/exec';

const API_SECRET: string =
  (env && (env as any).VITE_API_SECRET) ||
  'so-di-buong-4.0-2025-quang-tri-xyz';

console.debug('[API] Using API_URL =', API_URL);

/* -------------------------------------------------------------------------- */
/*                               Helper functions                             */
/* -------------------------------------------------------------------------- */

function buildUrl(action: string, extra: Record<string, string> = {}) {
  const url = new URL(API_URL);
  url.searchParams.set('secret', API_SECRET);
  url.searchParams.set('action', action);

  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const full = url.toString();
  console.debug('[API] buildUrl', action, full);
  return full;
}

async function getJson<T = any>(url: string): Promise<T> {
  console.debug('[API] GET', url);

  const res = await fetch(url, { method: 'GET' });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} when calling ${url}`);
  }

  const data = await res
    .json()
    .catch((e) => {
      console.error('[API] JSON parse error (GET)', e);
      throw new Error('Cannot parse JSON from Apps Script');
    });

  if (data && (data as any).error) {
    throw new Error(String((data as any).error));
  }

  return data as T;
}

// 👉 POST dùng text/plain để tránh preflight CORS
async function postJson<T = any>(action: string, body: unknown): Promise<T> {
  console.debug('[API] POST', action, { body });

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      ...((body || {}) as object),
      secret: API_SECRET,
      action,
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} when POST ${action}`);
  }

  const data = await res
    .json()
    .catch((e) => {
      console.error('[API] JSON parse error (POST)', e);
      // Nếu parse JSON lỗi nhưng Apps Script vẫn ghi vào Sheet
      // → trả object rỗng, tránh popup "Lưu thất bại"
      return {} as T;
    });

  if (data && (data as any).error && (data as any).error !== 'ok') {
    throw new Error(String((data as any).error));
  }

  return data as T;
}

/* -------------------------------------------------------------------------- */
/*                              Public API cho app                            */
/* -------------------------------------------------------------------------- */

// Lấy toàn bộ bệnh nhân
export async function fetchPatients(): Promise<Patient[]> {
  const url = buildUrl('listPatients');
  console.log('[API] Calling listPatients:', url);

  const data = await getJson<{ patients?: any[] }>(url);
  const rawPatients = data.patients || [];
  return rawPatients.map(mapRawPatient);
}

// Lấy y lệnh 1 bệnh nhân
export async function fetchOrders(patientId: string): Promise<MedicalOrder[]> {
  const url = buildUrl('listOrders', { patientId });
  console.log('[API] Calling listOrders:', url);

  const data = await getJson<{ orders?: any[] }>(url);
  const rawOrders = data.orders || [];
  return rawOrders.map(mapRawOrder);
}

// Lưu / cập nhật bệnh nhân
export async function savePatient(patient: Patient): Promise<string> {
  const data = await postJson<{ id: string }>('savePatient', { patient });
  return data.id;
}

// Lưu / cập nhật y lệnh
export async function saveOrder(order: MedicalOrder | any): Promise<string> {
  const data = await postJson<{ id: string }>('saveOrder', { order });
  return data.id;
}

// Xác nhận ra viện
export async function confirmDischarge(
  patientId: string,
  actualDate: string,
): Promise<any> {
  const payload = {
    patient: {
      id: patientId,
      status: 'Đã lưu hồ sơ',
      dischargeDate: actualDate,
    },
  };

  const data = await postJson<any>('confirmDischarge', payload);
  return data;
}

/* ---------------------------- Settings / cấu hình -------------------------- */

interface SettingsResponse {
  wards?: WardConfig[];
  dropdowns?: DropdownConfig[];
}

const DOCTOR = 'DOCTOR';
const OR = 'OR';
const ANESTHESIA = 'ANESTHESIA';
const CLASS = 'CLASS';
const REQ = 'REQ';

const buildDropdownList = (
  type: DropdownType,
  values: string[],
): DropdownConfig[] =>
  values.map((value, index) => ({
    type,
    value,
    order: index,
  }));

const pickDropdownValues = (
  dropdowns: DropdownConfig[],
  type: DropdownType,
) =>
  dropdowns
    .filter((d) => d.type === type)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((d) => d.value);

export async function fetchSettings(): Promise<SettingsPayload> {
  const url = buildUrl('listSettings');
  console.debug('[API] fetchSettings', url);

  const data = (await getJson<SettingsResponse>(url)) || {};
  const wards = (data.wards || []).map(mapWardConfig);
  const dropdowns = (data.dropdowns || [])
    .map(mapDropdownConfig)
    .filter(Boolean) as DropdownConfig[];

  return {
    doctors: pickDropdownValues(dropdowns, DOCTOR as DropdownType),
    operatingRooms: pickDropdownValues(dropdowns, OR as DropdownType),
    anesthesiaMethods: pickDropdownValues(dropdowns, ANESTHESIA as DropdownType),
    surgeryClassifications: pickDropdownValues(
      dropdowns,
      CLASS as DropdownType,
    ),
    surgeryRequirements: pickDropdownValues(dropdowns, REQ as DropdownType),
    wards,
  };
}

export async function saveSettings(settings: SettingsPayload): Promise<void> {
  const payload = {
    wards: settings.wards.map(serializeWardToRaw),
    dropdowns: [
      ...buildDropdownList(DOCTOR as DropdownType, settings.doctors),
      ...buildDropdownList(OR as DropdownType, settings.operatingRooms),
      ...buildDropdownList(
        ANESTHESIA as DropdownType,
        settings.anesthesiaMethods,
      ),
      ...buildDropdownList(
        CLASS as DropdownType,
        settings.surgeryClassifications,
      ),
      ...buildDropdownList(
        REQ as DropdownType,
        settings.surgeryRequirements,
      ),
    ],
  };

  await postJson('saveSettings', payload);
}
