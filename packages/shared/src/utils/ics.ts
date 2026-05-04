import type { Timeslot, Task } from '../types';

// ─── 日期格式轉換 ──────────────────────────────────────────────────────────────

/** Unix ms → '20260310T090000Z' */
export function toICSDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** '20260310T090000Z' 或本地格式 → Unix ms */
export function fromICSDate(s: string): number {
  // 去除可能附帶的 TZID 前綴（如 DTSTART;TZID=Asia/Taipei:20260310T170000）
  const raw = s.includes(':') ? s.split(':').pop()! : s;
  const clean = raw.trim();

  if (clean.endsWith('Z')) {
    // UTC 格式
    const y = parseInt(clean.slice(0, 4));
    const mo = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    const h = parseInt(clean.slice(9, 11));
    const mi = parseInt(clean.slice(11, 13));
    const se = parseInt(clean.slice(13, 15));
    return Date.UTC(y, mo, d, h, mi, se);
  } else if (clean.length === 15 && clean[8] === 'T') {
    // 本地時間格式（無 Z）→ 當作本地時間
    const y = parseInt(clean.slice(0, 4));
    const mo = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    const h = parseInt(clean.slice(9, 11));
    const mi = parseInt(clean.slice(11, 13));
    const se = parseInt(clean.slice(13, 15));
    return new Date(y, mo, d, h, mi, se).getTime();
  } else if (clean.length === 8) {
    // 全天事件格式 YYYYMMDD → 本地午夜
    const y = parseInt(clean.slice(0, 4));
    const mo = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    return new Date(y, mo, d, 0, 0, 0).getTime();
  }
  return NaN;
}

// ─── 生成 ──────────────────────────────────────────────────────────────────────

/** 將 ICS 特殊字元跳脫（逗號、分號、反斜線） */
function escapeICS(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

/** 單一 VEVENT 字串 */
export function timeslotToVEVENT(timeslot: Timeslot, task?: Task): string {
  const dtStart = toICSDate(timeslot.startTime);
  const dtEnd = toICSDate(timeslot.endTime ?? timeslot.startTime + 30 * 60 * 1000);
  const summary = task?.title ? escapeICS(task.title) : escapeICS(timeslot.subCategory || '未分類');
  const created = toICSDate(Date.now());

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${timeslot.id}@task-time-tracker`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
  ];

  if (timeslot.note) {
    lines.push(`DESCRIPTION:${escapeICS(timeslot.note)}`);
  }
  if (timeslot.subCategory) {
    lines.push(`X-TT-SUBCATEGORY:${escapeICS(timeslot.subCategory)}`);
  }
  if (timeslot.taskId) {
    lines.push(`X-TT-TASKID:${timeslot.taskId}`);
  }
  lines.push(`CREATED:${created}`);
  lines.push('END:VEVENT');

  return lines.join('\r\n');
}

/**
 * 包裝成完整 VCALENDAR，觸發瀏覽器下載。
 * filenameHint: 'single' 或 'YYYY-MM-DD_to_YYYY-MM-DD'
 */
export function exportTimeslotsToICS(timeslots: Timeslot[], tasks: Task[], filenameHint: string): void {
  const vevents = timeslots.map(ts => {
    const task = ts.taskId ? tasks.find(t => t.id === ts.taskId) : undefined;
    return timeslotToVEVENT(ts, task);
  });

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Task Time Tracker//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');

  const filename = filenameHint === 'single'
    ? 'timeslot.ics'
    : `timeslots_${filenameHint}.ics`;

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 解析 ──────────────────────────────────────────────────────────────────────

export interface ParsedICSEvent {
  startTime: number;
  endTime?: number;
  subCategory: string;  // X-TT-SUBCATEGORY → 若無則空字串
  note?: string;        // DESCRIPTION
}

/** ICS Line folding 還原：CRLF + 空白/Tab 開頭的下一行 = 折行續接 */
export function unfoldICS(content: string): string {
  return content.replace(/\r\n([ \t])/g, '$1').replace(/\n([ \t])/g, '$1');
}

/** 解析 DESCRIPTION 的跳脫字元 */
function unescapeDescription(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/** 解析 ICS 檔案內容，回傳 ParsedICSEvent[] */
export function parseICS(content: string): ParsedICSEvent[] {
  const unfolded = unfoldICS(content);
  const events: ParsedICSEvent[] = [];

  // 切分所有 VEVENT 區塊
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match: RegExpExecArray | null;

  while ((match = veventRegex.exec(unfolded)) !== null) {
    const block = match[1];
    const props: Record<string, string> = {};

    // 解析每一行 KEY:VALUE 或 KEY;PARAM=VAL:VALUE
    for (const line of block.split(/\r?\n/)) {
      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) continue;
      const keyPart = line.slice(0, colonIdx).toUpperCase();
      const value = line.slice(colonIdx + 1).trim();
      // 取 key 基礎名稱（去除參數 ;TZID=...）
      const baseKey = keyPart.split(';')[0];
      props[baseKey] = value;
    }

    const dtStart = props['DTSTART'];
    if (!dtStart) continue;

    const startTime = fromICSDate(dtStart);
    if (isNaN(startTime)) continue;

    const endTime = props['DTEND'] ? fromICSDate(props['DTEND']) : undefined;
    const subCategory = props['X-TT-SUBCATEGORY']
      ? unescapeDescription(props['X-TT-SUBCATEGORY'])
      : '';
    const note = props['DESCRIPTION']
      ? unescapeDescription(props['DESCRIPTION'])
      : undefined;

    events.push({
      startTime,
      endTime: endTime && !isNaN(endTime) ? endTime : undefined,
      subCategory,
      note,
    });
  }

  return events;
}
