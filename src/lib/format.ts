export function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + '₫';
}

/** 2300000 → "2.300.000" (dấu chấm hàng nghìn vi-VN) */
export function formatGroupedInt(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

/** Chỉ lấy chữ số rồi gắn dấu chấm hàng nghìn khi gõ. */
export function formatDigitGroups(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "2.300.000" / "2300000" → number; rỗng → null */
export function parseGroupedInt(raw: string): number | null {
  const cleaned = raw.replace(/[.\s,]/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatSignedVnd(n: number): string {
  const sign = n > 0 ? '+' : '';
  return sign + formatVnd(n);
}

export function formatPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

/** 0=CN … 6=T7 */
export const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

export const WEEKDAY_FULL = [
  'Chủ nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
] as const;

export function formatWeekdayFull(d: Date): string {
  return WEEKDAY_FULL[d.getDay()];
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatHistoryTooltipTime(ms: number): string {
  const d = new Date(ms);
  return `${formatWeekdayFull(d)} · ${new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)}`;
}

export function formatHistoryAxisTick(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}
