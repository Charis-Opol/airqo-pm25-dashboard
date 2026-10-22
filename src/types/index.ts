export interface Place {
  name: string;
  device_name: string;
  site_name: string;
  has_august_actuals: boolean;
  august_observed_input_share: number;
  august_mean_predicted_pm25_ug_m3: number;
  august_mean_aqi_category: string;
  color: string;
  latitude?: number;
  longitude?: number;
}

export interface HourlyRecord {
  timestamp: string;
  predicted_pm25: number;
  actual_pm25: number | null;
  temperature: number;
  humidity: number;
  aqi_category: string;
  color: string;
  input_source: string;
}

export interface DailyRecord {
  date: string;
  predicted_pm25: number;
  actual_pm25: number | null;
  aqi_category: string;
  color: string;
  input_source: string;
}

export interface AqiCategory {
  name: string;
  lower_ug_m3: number;
  upper_ug_m3: number | null;
  color: string;
  description: string;
  health_advisory: string;
}

export interface ValidationMetrics {
  source: string;
  setup: string;
  model_name: string;
  mae_ug_m3: number;
  rmse_ug_m3: number;
  r2: number;
}

export interface ModelInfo {
  model: string;
  features: string[];
  supported_places: number;
  aqi_categories: AqiCategory[];
  missing_color: string;
  validation_metrics: ValidationMetrics;
  time_convention: string;
  limitation: string;
}

export interface PredictRowInput {
  temperature: number;
  humidity: number;
  hour_sin: number;
  hour_cos: number;
  day_of_week_sin: number;
  day_of_week_cos: number;
  month_sin: number;
  month_cos: number;
  device_name: string;
}

export interface PredictResponseItem {
  predicted_pm25_ug_m3: number;
  aqi_category: string;
}

export interface PredictResponse {
  predictions: PredictResponseItem[];
}
