function pad(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
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
