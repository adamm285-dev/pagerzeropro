const DEFAULT_MS = 5 * 60 * 1000;
const MAX_MS = 30 * 60 * 1000;

export function parseSnoozeMs(text: string): number | null {
  const t = text.toLowerCase();
  const looks =
    /snooze|later|not now|call back|callback|give me|hold on|few minutes|redial/.test(t) ||
    /\d+\s*(seconds?|secs?|minutes?|mins?)/.test(t);
  if (!looks) return null;

  const sec = t.match(/(\d+)\s*(seconds?|secs?)/);
  if (sec) return Math.min(MAX_MS, Math.max(1000, Number(sec[1]) * 1000));

  const min = t.match(/(\d+)\s*(minutes?|mins?)/);
  if (min) return Math.min(MAX_MS, Math.max(60_000, Number(min[1]) * 60_000));

  return DEFAULT_MS;
}

export function formatSnooze(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}
