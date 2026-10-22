import React, { useState, useMemo } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VerifiedIcon from '@mui/icons-material/Verified';
import ClearIcon from '@mui/icons-material/Clear';
import { Place } from '../../types';
import { getTextColorForBackground } from '../../utils/aqi';

interface SensorRosterProps {
  places: Place[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place) => void;
}

type FilterOption = 'all' | 'actuals' | 'observed' | 'good_moderate' | 'unhealthy';

export const SensorRoster: React.FC<SensorRosterProps> = ({
  places,
  selectedPlace,
  onSelectPlace,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.site_name.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (activeFilter === 'actuals') return p.has_august_actuals;
      if (activeFilter === 'observed') return p.august_observed_input_share > 0;
      if (activeFilter === 'good_moderate') {
        return p.august_mean_aqi_category === 'Good' || p.august_mean_aqi_category === 'Moderate';
      }
      if (activeFilter === 'unhealthy') {
        return (
          p.august_mean_aqi_category.includes('Unhealthy') ||
          p.august_mean_aqi_category === 'Hazardous'
        );
      }
      return true;
    });
  }, [places, searchTerm, activeFilter]);

  return (
    <div className="card sensor-roster-card">
      <div className="roster-header">
        <div className="roster-title">
          <FilterListIcon sx={{ fontSize: 20, color: '#BE123C' }} />
          <span>Select Location ({filteredPlaces.length} of {places.length})</span>
        </div>

        <div className="roster-search-box">
          <SearchIcon sx={{ fontSize: 18, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search neighborhood or sensor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <ClearIcon sx={{ fontSize: 16 }} />
            </button>
          )}
        </div>
      </div>

      <div className="filter-chips-row">
        <button
          className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All (149)
        </button>
        <button
          className={`filter-chip ${activeFilter === 'actuals' ? 'active' : ''}`}
          onClick={() => setActiveFilter('actuals')}
        >
          Ground Truth (9)
        </button>
        <button
          className={`filter-chip ${activeFilter === 'observed' ? 'active' : ''}`}
          onClick={() => setActiveFilter('observed')}
        >
          Observed Weather
        </button>
        <button
          className={`filter-chip ${activeFilter === 'good_moderate' ? 'active' : ''}`}
          onClick={() => setActiveFilter('good_moderate')}
        >
          Good / Moderate
        </button>
        <button
          className={`filter-chip ${activeFilter === 'unhealthy' ? 'active' : ''}`}
          onClick={() => setActiveFilter('unhealthy')}
        >
          Elevated / Unhealthy
        </button>
      </div>

      <div className="sensor-list-scroll">
        {filteredPlaces.length === 0 ? (
          <div className="empty-roster-message">
            No locations matched your search criteria.
          </div>
        ) : (
          filteredPlaces.map((place) => {
            const isSelected = selectedPlace?.device_name === place.device_name;
            const textColor = getTextColorForBackground(place.color);
            return (
              <div
                key={place.device_name}
                className={`sensor-list-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectPlace(place)}
              >
                <div className="item-main-info">
                  <div className="item-name">{place.name}</div>
                  <div className="item-sub">
                    <span>{place.device_name}</span>
                    {place.has_august_actuals && (
                      <span className="actuals-tag">
                        <VerifiedIcon sx={{ fontSize: 13 }} />
                        <span>Actuals</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="item-reading-badge">
                  <span className="item-pm25-num">{place.august_mean_predicted_pm25_ug_m3.toFixed(1)} ug/m3</span>
                  <span
                    className="item-category-pill"
                    style={{ backgroundColor: place.color, color: textColor }}
                  >
                    {place.august_mean_aqi_category}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
