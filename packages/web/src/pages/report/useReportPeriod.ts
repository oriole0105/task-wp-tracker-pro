import { useState, useMemo } from 'react';
import {
  startOfDay, endOfDay, addDays, addMonths, subMonths, subDays,
  subWeeks, addWeeks, startOfWeek, format,
} from 'date-fns';
import type { ReportType, Period, PeriodLabels } from '@tt/shared/reports/common';

export type { ReportType, Period, PeriodLabels };

export function useReportPeriod() {
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [reportAnchorDate, setReportAnchorDate] = useState<Date>(() => {
    const today = new Date();
    return today.getDay() === 1 ? subWeeks(today, 1) : today;
  });

  const ganttPeriod = useMemo((): Period => {
    if (reportType === 'weekly') {
      const weekStart = startOfWeek(reportAnchorDate, { weekStartsOn: 0 });
      return { start: startOfDay(weekStart), end: endOfDay(addDays(weekStart, 6)) };
    } else if (reportType === 'bimonthly') {
      const month = reportAnchorDate.getMonth();
      const year = reportAnchorDate.getFullYear();
      const pairStart = month % 2 === 0 ? month : month - 1;
      return {
        start: startOfDay(new Date(year, pairStart, 1)),
        end: endOfDay(new Date(year, pairStart + 2, 0)),
      };
    } else {
      const month = reportAnchorDate.getMonth();
      const year = reportAnchorDate.getFullYear();
      if (month >= 5 && month <= 10) {
        return { start: startOfDay(new Date(year, 5, 1)), end: endOfDay(new Date(year, 11, 0)) };
      } else if (month === 11) {
        return { start: startOfDay(new Date(year, 11, 1)), end: endOfDay(new Date(year + 1, 5, 0)) };
      } else {
        return { start: startOfDay(new Date(year - 1, 11, 1)), end: endOfDay(new Date(year, 5, 0)) };
      }
    }
  }, [reportType, reportAnchorDate]);

  const progressPeriod = useMemo((): Period => {
    if (reportType === 'bimonthly') {
      const month = reportAnchorDate.getMonth();
      const year = reportAnchorDate.getFullYear();
      const currPairStart = month % 2 === 0 ? month : month - 1;
      return {
        start: startOfDay(new Date(year, currPairStart - 2, 1)),
        end: endOfDay(new Date(year, currPairStart, 0)),
      };
    }
    return ganttPeriod;
  }, [reportType, reportAnchorDate, ganttPeriod]);

  const prevPeriod = useMemo((): Period => {
    if (reportType === 'weekly') {
      const prevStart = subWeeks(progressPeriod.start, 1);
      return { start: startOfDay(prevStart), end: endOfDay(addDays(prevStart, 6)) };
    } else if (reportType === 'bimonthly') {
      return {
        start: startOfDay(subMonths(progressPeriod.start, 2)),
        end: endOfDay(subDays(progressPeriod.start, 1)),
      };
    } else {
      return {
        start: startOfDay(subMonths(progressPeriod.start, 6)),
        end: endOfDay(subDays(progressPeriod.start, 1)),
      };
    }
  }, [reportType, progressPeriod]);

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    return now >= ganttPeriod.start && now <= ganttPeriod.end;
  }, [ganttPeriod]);

  const periodLabels = useMemo((): PeriodLabels => {
    const pStart = format(prevPeriod.start, 'yyyy-MM-dd');
    const pEnd = format(prevPeriod.end, 'yyyy-MM-dd');
    const cStart = format(progressPeriod.start, 'yyyy-MM-dd');
    const cEnd = format(progressPeriod.end, 'yyyy-MM-dd');
    if (reportType === 'weekly') {
      return {
        prevShort: '上週%', currShort: '本週%', deltaLabel: '週間△',
        rangeDisplay: `上週：${pStart}　→　本週：${cStart}`,
      };
    } else {
      return {
        prevShort: '前期%', currShort: '本期%', deltaLabel: '期間△',
        rangeDisplay: `前期：${pStart}～${pEnd}　→　本期：${cStart}～${cEnd}`,
      };
    }
  }, [reportType, progressPeriod, prevPeriod]);

  const navigatePeriod = (dir: 1 | -1) => {
    if (reportType === 'weekly') {
      setReportAnchorDate(d => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    } else if (reportType === 'bimonthly') {
      setReportAnchorDate(d => dir === 1 ? addMonths(d, 2) : subMonths(d, 2));
    } else {
      setReportAnchorDate(d => dir === 1 ? addMonths(d, 6) : subMonths(d, 6));
    }
  };

  return {
    reportType, setReportType,
    reportAnchorDate, setReportAnchorDate,
    ganttPeriod, progressPeriod, prevPeriod,
    periodLabels, isCurrentPeriod, navigatePeriod,
  };
}
