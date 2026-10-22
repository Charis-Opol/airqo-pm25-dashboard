export interface TimeFeatures {
  hour_sin: number;
  hour_cos: number;
  day_of_week_sin: number;
  day_of_week_cos: number;
  month_sin: number;
  month_cos: number;
}

/**
 * Computes cyclic time features in UTC:
 * hour: 0-23
 * day of week: Monday=0 to Sunday=6
 * month: 1-12
 * Each encoded as sin and cos with periods 24, 7, and 12.
 */
export function computeTimeFeatures(date: Date): TimeFeatures {
  const hour = date.getUTCHours();
  // In JavaScript: Sunday is 0, Monday is 1, ..., Saturday is 6
  // Python pandas dayofweek: Monday is 0, Sunday is 6
  const jsDay = date.getUTCDay();
  const dayOfWeek = (jsDay + 6) % 7;
  const month = date.getUTCMonth() + 1;

  return {
    hour_sin: Math.sin((2 * Math.PI * hour) / 24),
    hour_cos: Math.cos((2 * Math.PI * hour) / 24),
    day_of_week_sin: Math.sin((2 * Math.PI * dayOfWeek) / 7),
    day_of_week_cos: Math.cos((2 * Math.PI * dayOfWeek) / 7),
    month_sin: Math.sin((2 * Math.PI * month) / 12),
    month_cos: Math.cos((2 * Math.PI * month) / 12),
  };
}
