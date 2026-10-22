import React from 'react';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PieChartIcon from '@mui/icons-material/PieChart';
import { DailyRecord, Place } from '../../types';
import { AQI_CATEGORIES, getTextColorForBackground } from '../../utils/aqi';

interface CalendarViewProps {
  place: Place;
  dailyRecords: DailyRecord[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  place,
  dailyRecords,
}) => {
  // Map records by day number
  const recordMap: { [day: number]: DailyRecord } = {};
  dailyRecords.forEach((rec) => {
    const parts = rec.date.split('-');
    if (parts.length === 3) {
      const dayNum = parseInt(parts[2], 10);
      recordMap[dayNum] = rec;
    }
  });

  // August 1, 2026 is Saturday (in JS: 0=Sun, 1=Mon, ..., 6=Sat)
  // For Monday-first grid: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  // Saturday has index 5, so 5 blank cells before August 1.
  const blankCells = 5;

  // Category counts and distribution
  const totalDays = dailyRecords.length;
  const categoryStats = AQI_CATEGORIES.map((cat) => {
    const count = dailyRecords.filter((r) => r.aqi_category === cat.name).length;
    const share = totalDays > 0 ? (count / totalDays) * 100 : 0;
    return {
      ...cat,
      count,
      share: share.toFixed(1),
    };
  });

  const weekDayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="card calendar-view-card">
      <div className="calendar-header-row">
        <div className="header-title-box">
          <CalendarMonthIcon sx={{ fontSize: 22, color: '#BE123C' }} />
          <div>
            <h3 className="section-heading">August 2026 Daily Clean Air Calendar</h3>
            <p className="section-subheading">
              Daily average PM2.5 severity levels for {place.name}
            </p>
          </div>
        </div>

        <div className="calendar-place-pill">
          <span>{place.name}</span>
        </div>
      </div>

      {/* Share of Time / Days Breakdown */}
      <div className="category-distribution-section">
        <div className="dist-title-row">
          <PieChartIcon sx={{ fontSize: 18, color: '#64748B' }} />
          <span>August Category Distribution (31 Days)</span>
        </div>

        <div className="distribution-stacked-bar">
          {categoryStats
            .filter((c) => parseFloat(c.share) > 0)
            .map((c) => (
              <div
                key={c.name}
                className="bar-segment"
                style={{
                  width: `${c.share}%`,
                  backgroundColor: c.color,
                }}
                title={`${c.name}: ${c.count} days (${c.share}%)`}
              />
            ))}
        </div>

        <div className="distribution-legend-chips">
          {categoryStats.map((c) => (
            <div key={c.name} className="dist-chip">
              <span className="chip-dot" style={{ backgroundColor: c.color }} />
              <span className="chip-label">
                {c.name}: <strong>{c.share}%</strong> ({c.count} days)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-matrix-wrapper">
        <div className="calendar-weekday-headers">
          {weekDayHeaders.map((dow) => (
            <div key={dow} className="dow-cell">
              {dow}
            </div>
          ))}
        </div>

        <div className="calendar-days-grid">
          {/* Blank cells for padding */}
          {Array.from({ length: blankCells }).map((_, i) => (
            <div key={`blank-${i}`} className="calendar-day-tile empty" />
          ))}

          {/* 31 Days of August */}
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
            const record = recordMap[day];
            const color = record ? record.color : '#E2E8F0';
            const textColor = record ? getTextColorForBackground(color) : '#64748B';

            return (
              <div
                key={`day-${day}`}
                className="calendar-day-tile"
                style={{ backgroundColor: color, color: textColor }}
                title={
                  record
                    ? `August ${day}, 2026: ${record.predicted_pm25} ug/m3 (${record.aqi_category})`
                    : `August ${day}, 2026: No data`
                }
              >
                <span className="day-number">{day}</span>
                {record && (
                  <span className="day-reading">
                    {record.predicted_pm25.toFixed(1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
