const VN_TZ = 'Asia/Ho_Chi_Minh';

/** Auto-poll window: 08:30–18:30 Asia/Ho_Chi_Minh */
export const POLL_START_MIN = 8 * 60 + 30;
export const POLL_END_MIN = 18 * 60 + 30;

const vnClockFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TZ,
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

function vnDaySeconds(now = new Date()): number {
  const parts = vnClockFmt.formatToParts(now);
  const n = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return n('hour') * 3600 + n('minute') * 60 + n('second');
}

export function isVnPollWindow(now = new Date()): boolean {
  const mins = Math.floor(vnDaySeconds(now) / 60);
  return mins >= POLL_START_MIN && mins < POLL_END_MIN;
}

/** ms until next occurrence of HH:MM in VN (today or tomorrow). */
export function msUntilVnMinutes(targetMin: number, now = new Date()): number {
  const targetSec = targetMin * 60;
  let deltaSec = targetSec - vnDaySeconds(now);
  if (deltaSec <= 0) deltaSec += 24 * 3600;
  return deltaSec * 1000;
}
