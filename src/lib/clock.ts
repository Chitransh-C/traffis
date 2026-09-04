import { META } from "../data/load";
import type { MetaDay } from "../types";

export type DateMode = "archive" | "live";

export function istCalendarDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function istSixStart(date = new Date()) {
  return Date.parse(`${istCalendarDay(date)}T00:30:00.000Z`);
}

export function metaDays(): MetaDay[] {
  const today = istCalendarDay();
  const all = META.days?.length ? META.days : [];
  const past = all.filter((d) => d.iso <= today);
  if (past.length) return past;
  return [
    {
      iso: istCalendarDay(new Date(META.dayStart)),
      start: META.dayStart,
      end: META.dayEnd,
      label: META.dateLabel,
      weekday: 0,
    },
  ];
}

export function opsDayStart(ts: number) {
  const days = metaDays();
  const hit = days.find((d) => ts >= d.start && ts < d.start + 24 * 60 * 60_000);
  return hit?.start ?? META.dayStart;
}

export function windowFor(mode: DateMode, dayIndex = 0) {
  const days = metaDays();
  const span = (days[0]?.end ?? META.dayEnd) - (days[0]?.start ?? META.dayStart);
  if (mode === "live") {
    const today = istCalendarDay();
    const match = days.find((d) => d.iso === today) ?? days[new Date().getDay() % days.length];
    const start = istSixStart();
    return { start, end: start + span, label: "Today", index: days.indexOf(match), archiveDay: match };
  }
  const d = days[Math.min(Math.max(0, dayIndex), days.length - 1)];
  return { start: d.start, end: d.end, label: d.label, index: days.indexOf(d), archiveDay: d };
}

export function toArchiveNow(simNow: number, mode: DateMode, dayIndex = 0) {
  if (mode === "archive") return simNow;
  const win = windowFor("live", dayIndex);
  const offset = simNow - win.start;
  return (win.archiveDay?.start ?? META.dayStart) + offset;
}

/** IST wall clock → epoch. Accepts `HH:MM` or `HH:MM:SS`. */
export function istAt(isoDate: string, hhmm: string) {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return Number.NaN;
  const hh = m[1].padStart(2, "0");
  const mm = m[2];
  const ss = m[3] ?? "00";
  return Date.parse(`${isoDate}T${hh}:${mm}:${ss}+05:30`);
}

export function istHm(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

export function formatDateLabel(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}
