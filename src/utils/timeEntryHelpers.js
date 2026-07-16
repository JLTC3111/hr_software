const SECONDS_PER_DAY = 86400;

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
