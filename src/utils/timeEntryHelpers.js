const SECONDS_PER_DAY = 86400;

// Database DATE values are calendar dates, not UTC instants. Converting local
// midnight with toISOString() moves the date back a day in Vietnam.
export const getMonthDateRange = (month, year) => {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    startDate: `${prefix}-01`,
    endDate: `${prefix}-${String(lastDay).padStart(2, '0')}`,
  };
};

export const getClockRangeDates = (date, clockIn, clockOut) => {
  const clockInDate = new Date(`${date}T${clockIn}`);
  const clockOutDate = new Date(`${date}T${clockOut}`);

  if (clockOutDate <= clockInDate) {
    clockOutDate.setDate(clockOutDate.getDate() + 1);
  }

  return { clockInDate, clockOutDate };
};

export const getHoursWorked = (date, clockIn, clockOut) => {
  const { clockInDate, clockOutDate } = getClockRangeDates(date, clockIn, clockOut);
  return (clockOutDate - clockInDate) / (1000 * 60 * 60);
};

export const toExtendedInterval = (clockInSeconds, clockOutSeconds) => {
  if (clockOutSeconds <= clockInSeconds) {
    return { start: clockInSeconds, end: clockOutSeconds + SECONDS_PER_DAY };
  }
  return { start: clockInSeconds, end: clockOutSeconds };
};

export const extendedIntervalsOverlap = (intervalA, intervalB) =>
  intervalA.start < intervalB.end && intervalA.end > intervalB.start;
