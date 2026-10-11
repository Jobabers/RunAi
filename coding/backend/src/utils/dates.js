function toDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function compareDateKey(a, b) {
  return a.localeCompare(b);
}

function eachDate(startDate, endDate) {
  const dates = [];
  let cursor = startDate;

  while (compareDateKey(cursor, endDate) <= 0) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

module.exports = {
  addDays,
  compareDateKey,
  eachDate,
  toDateKey,
};
