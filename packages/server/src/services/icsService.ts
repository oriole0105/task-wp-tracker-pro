import type { Task, Timeslot } from '@tt/shared/types';
import { timeslotToVEVENT } from '@tt/shared/utils/ics';

export function generateCalendarIcs(
  tasks: Task[],
  timeslots: Timeslot[],
  fromDate?: string,
  toDate?: string,
): string {
  let filtered = timeslots;
  if (fromDate) {
    const fromMs = new Date(fromDate).getTime();
    filtered = filtered.filter(ts => (ts.endTime ?? ts.startTime) >= fromMs);
  }
  if (toDate) {
    const toMs = new Date(toDate).getTime() + 86400000; // inclusive end of day
    filtered = filtered.filter(ts => ts.startTime < toMs);
  }

  const vevents = filtered.map(ts => {
    const task = ts.taskId ? tasks.find(t => t.id === ts.taskId) : undefined;
    return timeslotToVEVENT(ts, task);
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Task Time Tracker//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n');
}
