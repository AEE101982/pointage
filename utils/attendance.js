export function computeAttendance(checkIn, checkOut) {
  if (!checkIn) return {};

  const hIn = toHour(checkIn);
  const hOut = checkOut ? toHour(checkOut) : null;

  let status = "present";
  if (hIn > 9) status = "absent";
  else if (hIn > 8.5) status = "late";

  let hoursWorked = hOut ? hOut - hIn : 0;
  let overtime = hOut && hOut > 18 ? hOut - 18 : 0;

  return {
    status,
    hours_worked: Math.max(0, hoursWorked),
    overtime_hours: Math.max(0, overtime)
  };
}

function toHour(time) {
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}
