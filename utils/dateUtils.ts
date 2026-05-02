
/**
 * Calculates a dateline 21 working days from a given start date.
 * Skips Saturdays, Sundays, and Putrajaya public holidays.
 */
export const calculateDateline = (startDate: string): string => {
  const holidays = [
    '2026-01-01', // New Year
    '2026-01-30', // Thaipusam
    '2026-02-01', // Federal Territory Day
    '2026-02-17', // Chinese New Year
    '2026-02-18', // Chinese New Year
    '2026-03-20', // Hari Raya Aidilfitri
    '2026-03-21', // Hari Raya Aidilfitri
    '2026-05-01', // Labor Day
    '2026-05-31', // Wesak Day
    '2026-06-06', // Agong's Birthday
    '2026-06-27', // Hari Raya Aidiladha
    '2026-07-17', // Awal Muharram
    '2026-08-31', // National Day
    '2026-09-16', // Malaysia Day
    '2026-09-25', // Maulidur Rasul
    '2026-11-08', // Deepavali
    '2026-12-25', // Christmas
  ];

  let current = new Date(startDate);
  if (isNaN(current.getTime())) {
    console.warn("Invalid startDate provided to calculateDateline:", startDate);
    return startDate; // Return original if invalid
  }
  let daysAdded = 0;

  while (daysAdded < 21) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    const dateStr = current.toISOString().split('T')[0];

    // Skip Sat (0), Sun (6) and holidays
    // Wait, getDay() returns 0 for Sunday and 6 for Saturday
    if (day !== 0 && day !== 6 && !holidays.includes(dateStr)) {
      daysAdded++;
    }
  }

  return current.toISOString().split('T')[0];
};
