import React from 'react';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import VerifiedIcon from '@mui/icons-material/Verified';
import PlaceIcon from '@mui/icons-material/Place';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { Place } from '../../types';
import { getAqiCategory, getTextColorForBackground } from '../../utils/aqi';

interface SensorCardProps {
  place: Place;
}

export const SensorCard: React.FC<SensorCardProps> = ({ place }) => {
  const category = getAqiCategory(place.august_mean_predicted_pm25_ug_m3);
  const textColor = getTextColorForBackground(category.color);
  const observedPct = Math.round(place.august_observed_input_share * 100);

  return (
    <div className="card sensor-summary-card">
      <div className="sensor-card-header">
        <div>
          <span className="location-pill">
            <PlaceIcon sx={{ fontSize: 16 }} />
            {place.site_name}
          </span>
          <h2 className="place-display-title">{place.name}</h2>
          <p className="sensor-device-id">Sensor ID: {place.device_name}</p>
        </div>

        <div className="sensor-badges">
          {place.has_august_actuals && (
            <span className="badge-chip verified-chip" title="Actual physical sensor readings recorded for August">
              <VerifiedIcon sx={{ fontSize: 14 }} />
              <span>Ground Truth Available</span>
            </span>
          )}
          <span className="badge-chip input-chip">
            {observedPct > 0 ? `${observedPct}% Observed Weather` : 'Baseline Historical Profile'}
          </span>
        </div>
      </div>

      <div className="aqi-stat-box" style={{ borderLeftColor: category.color }}>
        <div className="reading-column">
          <span className="stat-caption">August Mean PM2.5 Exposure</span>
          <div className="big-reading">
            <span className="numeric-value">{place.august_mean_predicted_pm25_ug_m3.toFixed(1)}</span>
            <span className="unit-label">ug/m3</span>
          </div>
          <div
            className="category-pill-large"
            style={{ backgroundColor: category.color, color: textColor }}
          >
            {category.name}
          </div>
        </div>

        <div className="health-advice-column">
          <div className="advisory-title">
            <HealthAndSafetyIcon sx={{ fontSize: 20, color: category.color }} />
            <span>Health Guidance for Residents</span>
          </div>
          <p className="advisory-body">{category.health_advisory}</p>
          <div className="advisory-footer">
            <ShowChartIcon sx={{ fontSize: 16, color: '#64748B' }} />
            <span>Classification Standard: AirQo / World Health Organization Air Quality Guidelines</span>
          </div>
        </div>
      </div>
    </div>
  );
};
