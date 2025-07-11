import { parse, format as formatDateFns, isValid } from 'date-fns';

/**
 * Parses a date string (e.g., "2023-10-27") into a Date object.
 * This function is crucial for avoiding timezone issues where 'new Date("YYYY-MM-DD")'
 * can result in the previous day depending on the user's timezone.
 * It consistently interprets the date as being in the user's local timezone.
 * @param {string} dateString - The date string in "yyyy-MM-dd" format.
 * @returns {Date} A valid Date object or a new Date object for the current time if parsing fails.
 */
export const parseDate = (dateString: string): Date => {
  const parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
  return isValid(parsedDate) ? parsedDate : new Date();
};

/**
 * Parses a time string (e.g., "09:00") into a Date object, using a reference date.
 * This is useful for comparing or formatting times without date ambiguity.
 * @param {string} timeString - The time string in "HH:mm" format.
 * @param {Date} referenceDate - The date to associate the time with. Defaults to now.
 * @returns {Date} A valid Date object or a new Date object for the current time if parsing fails.
 */
export const parseTime = (timeString: string, referenceDate: Date = new Date()): Date => {
  const parsedTime = parse(timeString, 'HH:mm', referenceDate);
  return isValid(parsedTime) ? parsedTime : new Date();
};

/**
 * Formats a Date object into a string with a specified format.
 * This is a wrapper around date-fns's format function for consistent use.
 * @param {Date} date - The date object to format.
 * @param {string} formatString - The desired output format (e.g., 'PPPP', 'h:mm a').
 * @returns {string} The formatted date string, or an empty string if the date is invalid.
 */
export const formatDate = (date: Date, formatString: string): string => {
  return isValid(date) ? formatDateFns(date, formatString) : '';
};