// Nguồn dữ liệu dùng chung cho browser (public/) và API (api/*.js).
export const ROSTER = [
  'Huỳnh Thế Phương',
  'Văn Bá Thảo',
  'Trần Văn Thanh',
  'Đặng Văn Khải',
  'Trương Thế Duy',
  'Trương Quang Trường',
  'Cổ Quốc Trung',
  'Lê Văn Quyến',
  'Bùi Văn Phi',
  'Nguyễn Phước Khánh',
  'Lê Chung Hiếu',
  'Phạm Hữu Ngọc Tâm',
  'Lê Việt',
  'Trần Văn Khàng',
  'Lê Trọng Hoàng',
  'Lê Hữu Thắng',
  'Nguyễn Văn Hậu',
  'Nguyễn Trung Kiên',
  'Nguyễn Văn Tuấn',
  'Huỳnh Ngọc Quang Ý',
  'Trần Khánh Hưng',
  'Võ Bảo Long',
];

export const BRANCHES = ['Hoà Vang', 'Hoà Quý', 'Hoà Xuân', 'Liên Chiểu'];

export const ASPIRATIONS = {
  1: 'Ở lại Hub Đà Nẵng làm hàng nặng',
  2: 'Làm hàng xuất Hà Nội & HCM',
  3: 'Về Bưu cục Hoà Vang / Hoà Quý / Hoà Xuân / Liên Chiểu',
  4: 'Về TTKT 2',
  5: 'Khác',
};

export const NOTICE_2 =
  'Bộ phận này đang lên kế hoạch bạn có thể xuống 1 trong 4 bưu cục trên làm tạm vài tháng không.';

export function normalizeName(value) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

const ROSTER_KEYS = new Set(ROSTER.map((n) => normalizeName(n).toLowerCase()));

export function isRosterName(value) {
  return ROSTER_KEYS.has(normalizeName(value).toLowerCase());
}

export function canonicalName(value) {
  const key = normalizeName(value).toLowerCase();
  return ROSTER.find((n) => normalizeName(n).toLowerCase() === key) ?? null;
}
