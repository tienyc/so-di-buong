// CRITICAL: This is the SINGLE SOURCE OF TRUTH for room-ward mapping
// DO NOT allow any other room/ward combinations to exist in the system

export const ROOM_WARD_MAPPING: Record<string, string> = {
    // B1-B4
    'B1': 'B1-B4',
    'B2': 'B1-B4',
    'B3': 'B1-B4',
    'B4': 'B1-B4',

    // Hậu Phẫu
    'Hậu phẫu': 'Hậu Phẫu',
    'Cao tuổi': 'Hậu Phẫu',
    'Trung cao': 'Hậu Phẫu',
    'Dịch vụ 1': 'Hậu Phẫu',
    'Dịch vụ 2': 'Hậu Phẫu',
    'Dịch vụ 3': 'Hậu Phẫu',
    'Dịch vụ 4': 'Hậu Phẫu',

    // Tiền Phẫu
    'B5': 'Tiền Phẫu',
    'B6': 'Tiền Phẫu',
    'B7': 'Tiền Phẫu',
    'B8': 'Tiền Phẫu',
    'Cấp cứu 2': 'Tiền Phẫu',

    // Cấp Cứu 1
    'Cấp cứu 1': 'Cấp Cứu 1',

    // Tầng 3
    'Bỏng': 'Tầng 3',
    'Nhiễm trùng': 'Tầng 3',
    'Dịch vụ 5 (B9)': 'Tầng 3',
    'Dịch vụ 6 (B10)': 'Tầng 3',
    'B13': 'Tầng 3',
};

// Get ward name from room number
export const getWardFromRoom = (roomNumber: string): string => {
    // Normalize input
    const normalized = roomNumber.trim();

    // Direct lookup
    if (ROOM_WARD_MAPPING[normalized]) {
        return ROOM_WARD_MAPPING[normalized];
    }

    // Fallback to Cấp Cứu 1
    return 'Cấp Cứu 1';
};

// Validate if a room-ward combination is valid
export const isValidRoomWardCombination = (roomNumber: string, ward: string): boolean => {
    const expectedWard = getWardFromRoom(roomNumber);
    return expectedWard === ward;
};

// Get all valid rooms as array for Gemini prompt
export const getAllValidRooms = (): string[] => {
    return Object.keys(ROOM_WARD_MAPPING);
};

// Get all valid wards
export const getAllValidWards = (): string[] => {
    return Array.from(new Set(Object.values(ROOM_WARD_MAPPING)));
};

// Generate prompt-friendly mapping string
export const getRoomWardMappingForPrompt = (): string => {
    const wardToRooms = new Map<string, string[]>();

    Object.entries(ROOM_WARD_MAPPING).forEach(([room, ward]) => {
        if (!wardToRooms.has(ward)) {
            wardToRooms.set(ward, []);
        }
        wardToRooms.get(ward)!.push(room);
    });

    let result = '';
    wardToRooms.forEach((rooms, ward) => {
        result += `   **${ward}**: ${rooms.join(', ')}\n`;
    });

    return result;
};
