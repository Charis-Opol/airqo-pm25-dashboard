import { AqiCategory } from '../types';

export const AQI_CATEGORIES: AqiCategory[] = [
  {
    name: 'Good',
    lower_ug_m3: 0,
    upper_ug_m3: 9.0,
    color: '#16A34A',
    description: 'Clean air',
    health_advisory: 'Air quality is satisfactory and poses little or no risk to health. Ideal for outdoor activities.',
  },
  {
    name: 'Moderate',
    lower_ug_m3: 9.01,
    upper_ug_m3: 35.49,
    color: '#D97706',
    description: 'Acceptable air',
    health_advisory: 'Air quality is acceptable. Unusually sensitive individuals should consider reducing prolonged outdoor exertion.',
  },
  {
    name: 'Unhealthy for Sensitive Groups',
    lower_ug_m3: 35.5,
    upper_ug_m3: 55.49,
    color: '#EA580C',
    description: 'Elevated pollution',
    health_advisory: 'Members of sensitive groups (children, elderly, and people with respiratory illness) may experience health effects. General public is less likely to be affected.',
  },
  {
    name: 'Unhealthy',
    lower_ug_m3: 55.5,
    upper_ug_m3: 125.49,
    color: '#DC2626',
    description: 'Harmful pollution',
    health_advisory: 'Everyone may begin to experience health effects. Members of sensitive groups may experience more serious health effects. Reduce heavy outdoor activity.',
  },
  {
    name: 'Very Unhealthy',
    lower_ug_m3: 125.5,
    upper_ug_m3: 225.49,
    color: '#9333EA',
    description: 'Serious health alert',
    health_advisory: 'Health alert: The risk of health effects is increased for everyone. Avoid strenuous outdoor activities and consider wearing protective filtration masks.',
  },
  {
    name: 'Hazardous',
    lower_ug_m3: 225.5,
    upper_ug_m3: null,
    color: '#7F1D1D',
    description: 'Emergency warning',
    health_advisory: 'Health warning of emergency conditions: Everyone is more likely to be affected. Avoid all outdoor physical activity and keep windows closed.',
  },
];

export function getAqiCategory(pm25: number): AqiCategory {
  if (pm25 <= 9.0) return AQI_CATEGORIES[0];
  if (pm25 <= 35.49) return AQI_CATEGORIES[1];
  if (pm25 <= 55.49) return AQI_CATEGORIES[2];
  if (pm25 <= 125.49) return AQI_CATEGORIES[3];
  if (pm25 <= 225.49) return AQI_CATEGORIES[4];
  return AQI_CATEGORIES[5];
}

export function getTextColorForBackground(hexColor: string): string {
  const cleanHex = hexColor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
  return brightness > 150 ? '#111827' : '#FFFFFF';
}
