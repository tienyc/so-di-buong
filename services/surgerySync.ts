import { Patient } from '../types';

const API_SECRET = 'so-di-buong-4.0-2025-quang-tri-xyz';

/**
 * Sync single patient's surgery info to department sheet
 * ✅ NHẬN URL TRỰC TIẾP
 */
export const syncSurgeryToKhoa = async (surgerySheetUrl: string, patient: Patient): Promise<{ success: boolean; message?: string; error?: string }> => {
  // Check if URL is configured
  if (!surgerySheetUrl) {
    return {
      success: false,
      error: 'Chưa cấu hình URL sheet lịch mổ khoa'
    };
  }
  
  // Validate patient has required surgery info - CHỈ CẦN NGÀY MỔ
  if (!patient.surgeryDate) {
    return {
      success: false,
      error: 'Thiếu thông tin ngày mổ'
    };
  }

  // NOTE: Logic isAutoSyncEnabled (tự động đồng bộ) đã được chuyển sang App.tsx để kiểm tra trước khi gọi hàm này.

  try {
    const response = await fetch(surgerySheetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // CORS workaround
      },
      body: JSON.stringify({
        action: 'SYNC_SURGERY',
        secret: API_SECRET,
        data: {
          id: patient.id,
          fullName: patient.fullName,
          surgeryDate: patient.surgeryDate,
          surgeryTime: patient.surgeryTime,
          diagnosis: patient.diagnosis,
          surgeryMethod: patient.surgeryMethod,
          surgeonName: patient.surgeonName,
          operatingRoom: patient.operatingRoom,
          anesthesiaMethod: patient.anesthesiaMethod,
          surgeryClassification: patient.surgeryClassification,
          surgeryRequirements: patient.surgeryRequirements,
          surgeryNotes: patient.surgeryNotes,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: `Đã đồng bộ ${result.action === 'updated' ? 'cập nhật' : 'thêm mới'} ca mổ của ${patient.fullName}`
      };
    } else {
      return {
        success: false,
        error: result.error || 'Lỗi không xác định'
      };
    }

  } catch (error) {
    console.error('Error syncing surgery to khoa:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể kết nối đến sheet lịch mổ khoa'
    };
  }
};

/**
 * Sync multiple patients' surgery info in batch
 * ✅ NHẬN URL TRỰC TIẾP
 */
export const syncBatchSurgeries = async (surgerySheetUrl: string, patients: Patient[]): Promise<{ success: boolean; total: number; successCount: number; message?: string; error?: string }> => {
  if (!surgerySheetUrl) {
    return {
      success: false,
      total: patients.length,
      successCount: 0,
      error: 'Chưa cấu hình URL sheet lịch mổ khoa'
    };
  }

  // Filter patients with surgery date - CHỈ CẦN NGÀY MỔ
  const validPatients = patients.filter(p => p.surgeryDate);

  if (validPatients.length === 0) {
    return {
      success: false,
      total: 0,
      successCount: 0,
      error: 'Không có ca mổ nào có đầy đủ thông tin để đồng bộ'
    };
  }

  try {
    const response = await fetch(surgerySheetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'SYNC_BATCH',
        secret: API_SECRET,
        data: {
          patients: validPatients.map(p => ({
            id: p.id,
            fullName: p.fullName,
            surgeryDate: p.surgeryDate,
            surgeryTime: p.surgeryTime,
            diagnosis: p.diagnosis,
            surgeryMethod: p.surgeryMethod,
            surgeonName: p.surgeonName,
            operatingRoom: p.operatingRoom,
            anesthesiaMethod: p.anesthesiaMethod,
            surgeryClassification: p.surgeryClassification,
            surgeryRequirements: p.surgeryRequirements,
            surgeryNotes: p.surgeryNotes,
          }))
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        total: result.total,
        successCount: result.successCount,
        message: `Đã đồng bộ ${result.successCount}/${result.total} ca mổ lên lịch khoa`
      };
    } else {
      return {
        success: false,
        total: validPatients.length,
        successCount: 0,
        error: result.error || 'Lỗi không xác định'
      };
    }

  } catch (error) {
    console.error('Error batch syncing surgeries:', error);
    return {
      success: false,
      total: validPatients.length,
      successCount: 0,
      error: error instanceof Error ? error.message : 'Không thể kết nối đến sheet lịch mổ khoa'
    };
  }
};

/**
 * Test connection to surgery sheet
 * ✅ NHẬN URL TRỰC TIẾP
 */
export const testSurgerySheetConnection = async (surgerySheetUrl: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  if (!surgerySheetUrl) {
    return {
      success: false,
      error: 'Chưa cấu hình URL sheet lịch mổ khoa'
    };
  }

  try {
    // Try a simple test with minimal data
    const testPatient = {
      fullName: 'TEST CONNECTION',
      surgeryDate: new Date().toISOString().split('T')[0],
      surgeryTime: '00:00',
      diagnosis: 'Test',
      surgeryMethod: 'Test',
    };

    const response = await fetch(surgerySheetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'TEST_CONNECTION', // Đã đổi action thành TEST_CONNECTION
        secret: API_SECRET,
        data: testPatient
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: 'Kết nối thành công với sheet lịch mổ khoa'
      };
    } else {
      return {
        success: false,
        error: result.error || 'Lỗi không xác định'
      };
    }

  } catch (error) {
    console.error('Error testing surgery sheet connection:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể kết nối đến sheet lịch mổ khoa'
    };
  }
};

/**
 * Trigger hospital approval sheet sync from client button
 */
export const triggerHospitalSync = async (hospitalSyncUrl: string): Promise<{ success: boolean; message?: string; error?: string }> => {
  if (!hospitalSyncUrl) {
    return {
      success: false,
      error: 'Chưa cấu hình URL đồng bộ BV'
    };
  }

  try {
    const response = await fetch(hospitalSyncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({
        action: 'SYNC_TO_HOSPITAL',
        secret: API_SECRET,
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        message: result.message || 'Đã gửi yêu cầu đồng bộ lên BV'
      };
    }

    return {
      success: false,
      error: result.error || 'Không nhận được kết quả từ Apps Script'
    };

  } catch (error) {
    console.error('Error triggering hospital sync:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Không thể kết nối Web App đồng bộ BV'
    };
  }
};
