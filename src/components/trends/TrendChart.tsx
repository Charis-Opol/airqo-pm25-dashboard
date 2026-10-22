import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
} from 'recharts';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TuneIcon from '@mui/icons-material/Tune';
import { HourlyRecord, DailyRecord, Place } from '../../types';
import { AQI_CATEGORIES, getAqiCategory } from '../../utils/aqi';

interface TrendChartProps {
  place: Place;
  hourlyData: HourlyRecord[];
  dailyData: DailyRecord[];
  loadingHourly: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  place,
  hourlyData,
  dailyData,
  loadingHourly,
}) => {
  const [resolution, setResolution] = useState<'hourly' | 'daily'>('hourly');

  const chartData = useMemo(() => {
    if (resolution === 'daily') {
      return dailyData.map((d) => ({
        time: d.date,
        predicted: d.predicted_pm25,
        actual: d.actual_pm25,
        category: d.aqi_category,
        temperature: null,
        humidity: null,
      }));
    }
    return hourlyData.map((h) => ({
      time: h.timestamp.replace('T', ' ').substring(5, 16),
      fullTimestamp: h.timestamp,
      predicted: h.predicted_pm25,
      actual: h.actual_pm25,
      category: h.aqi_category,
      temperature: h.temperature,
      humidity: h.humidity,
    }));
  }, [resolution, hourlyData, dailyData]);

  // Compute error metrics if actual readings exist
  const metrics = useMemo(() => {
    const paired = hourlyData.filter((h) => h.actual_pm25 != null);
    if (paired.length === 0) return null;

    const absErrors = paired.map((h) => Math.abs(h.predicted_pm25 - h.actual_pm25!));
    const sqErrors = paired.map((h) => Math.pow(h.predicted_pm25 - h.actual_pm25!, 2));

    const mae = absErrors.reduce((a, b) => a + b, 0) / paired.length;
    const rmse = Math.sqrt(sqErrors.reduce((a, b) => a + b, 0) / paired.length);

    return {
      hoursCompared: paired.length,
      mae: mae.toFixed(2),
      rmse: rmse.toFixed(2),
    };
  }, [hourlyData]);

  const maxY = useMemo(() => {
    let max = 45;
    chartData.forEach((d) => {
      if (d.predicted != null && d.predicted > max) max = d.predicted;
      if (d.actual != null && d.actual > max) max = d.actual;
    });
    return Math.ceil(max * 1.15);
  }, [chartData]);

  return (
    <div className="card trend-chart-card">
      <div className="chart-card-header">
        <div className="chart-title-group">
          <ShowChartIcon sx={{ fontSize: 22, color: '#BE123C' }} />
          <div>
            <h3 className="section-heading">PM2.5 Pollution Trends over Time</h3>
            <p className="section-subheading">
              Comparing model predictions with physical sensor readings for {place.name} (August 2026 UTC)
            </p>
          </div>
        </div>

        <div className="chart-controls">
          <div className="resolution-toggle">
            <TuneIcon sx={{ fontSize: 16, color: '#64748B' }} />
            <button
              className={`toggle-option ${resolution === 'hourly' ? 'active' : ''}`}
              onClick={() => setResolution('hourly')}
            >
              Hourly
            </button>
            <button
              className={`toggle-option ${resolution === 'daily' ? 'active' : ''}`}
              onClick={() => setResolution('daily')}
            >
              Daily Mean
            </button>
          </div>
        </div>
      </div>

      {metrics && (
        <div className="metrics-banner">
          <AssessmentIcon sx={{ fontSize: 20, color: '#0284C7' }} />
          <div>
            <strong>Evaluation against Physical Ground Truth:</strong> Mean Absolute Error (MAE):{' '}
            <span className="metric-pill">{metrics.mae} ug/m3</span>, Root Mean Squared Error (RMSE):{' '}
            <span className="metric-pill">{metrics.rmse} ug/m3</span> across {metrics.hoursCompared} verified hours.
          </div>
        </div>
      )}

      {loadingHourly && resolution === 'hourly' ? (
        <div className="chart-loading-placeholder">
          <span>Loading hourly time series data...</span>
        </div>
      ) : (
        <div className="recharts-wrapper" style={{ width: '100%', height: '380px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />

              {/* Shaded AQI Reference Areas */}
              <ReferenceArea y1={0} y2={Math.min(9, maxY)} fill="#16A34A" fillOpacity={0.08} />
              <ReferenceArea y1={9} y2={Math.min(35.49, maxY)} fill="#D97706" fillOpacity={0.08} />
              <ReferenceArea y1={35.49} y2={Math.min(55.49, maxY)} fill="#EA580C" fillOpacity={0.08} />
              {maxY > 55.49 && (
                <ReferenceArea y1={55.49} y2={Math.min(125.49, maxY)} fill="#DC2626" fillOpacity={0.08} />
              )}
              {maxY > 125.49 && (
                <ReferenceArea y1={125.49} y2={maxY} fill="#9333EA" fillOpacity={0.08} />
              )}

              <XAxis
                dataKey="time"
                stroke="#64748B"
                fontSize={12}
                tickLine={false}
                interval={resolution === 'hourly' ? 48 : 3}
              />
              <YAxis
                stroke="#64748B"
                fontSize={12}
                domain={[0, maxY]}
                unit=" ug"
                tickLine={false}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload;
                  const cat = getAqiCategory(d.predicted);
                  return (
                    <div className="chart-custom-tooltip">
                      <div className="tooltip-header">{d.fullTimestamp || d.time} (UTC)</div>
                      <div className="tooltip-item">
                        <span className="dot" style={{ backgroundColor: '#0F172A' }}></span>
                        <span>Predicted: <strong>{d.predicted} ug/m3</strong></span>
                      </div>
                      {d.actual != null && (
                        <div className="tooltip-item">
                          <span className="dot" style={{ backgroundColor: '#0284C7' }}></span>
                          <span>Actual Reading: <strong>{d.actual} ug/m3</strong></span>
                        </div>
                      )}
                      {d.temperature != null && (
                        <div className="tooltip-sub">
                          Temp: {d.temperature} C | Humidity: {d.humidity}%
                        </div>
                      )}
                      <div className="tooltip-cat-badge" style={{ backgroundColor: cat.color }}>
                        {cat.name}
                      </div>
                    </div>
                  );
                }}
              />

              <Legend verticalAlign="top" height={36} />

              <Line
                type="monotone"
                dataKey="predicted"
                name="Predicted PM2.5 (Model)"
                stroke="#0F172A"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 6 }}
              />

              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Sensor Reading (Physical)"
                stroke="#0284C7"
                strokeWidth={1.8}
                strokeDasharray="3 3"
                dot={{ r: 2.5, fill: '#0284C7' }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="aqi-color-reference-strip">
        <span className="strip-title">Background AQI Bands:</span>
        {AQI_CATEGORIES.slice(0, 4).map((cat) => (
          <span key={cat.name} className="strip-item">
            <span className="color-box" style={{ backgroundColor: cat.color }}></span>
            <span>{cat.name} ({cat.lower_ug_m3 === 0 ? '0' : '>' + cat.lower_ug_m3} to {cat.upper_ug_m3} ug/m3)</span>
          </span>
        ))}
      </div>
    </div>
  );
};
