import React from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SyncIcon from '@mui/icons-material/Sync';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ScienceIcon from '@mui/icons-material/Science';
import InfoIcon from '@mui/icons-material/Info';
import AirIcon from '@mui/icons-material/Air';
import { BackendHealthResponse } from '../../api/client';

export type TabType = 'explorer' | 'trends' | 'simulator' | 'about';

interface HeaderProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  health: BackendHealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  onRetryHealth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  health,
  healthLoading,
  healthError,
  onRetryHealth,
}) => {
  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand">
          <div className="brand-icon">
            <AirIcon sx={{ fontSize: 28, color: '#BE123C' }} />
          </div>
          <div>
            <h1 className="brand-title">AirQo PM2.5 Clean Air Monitor</h1>
            <p className="brand-subtitle">
              Public Air Quality Information and Model Forecasts for Uganda
            </p>
          </div>
        </div>

        <div className="service-status">
          {healthLoading ? (
            <div className="status-badge connecting">
              <SyncIcon className="spin-icon" sx={{ fontSize: 18 }} />
              <span>Connecting to Model API...</span>
            </div>
          ) : health ? (
            <div className="status-badge connected">
              <CheckCircleIcon sx={{ fontSize: 18, color: '#16A34A' }} />
              <span>
                {health.model} Active ({health.modeUsed || 'Online'})
              </span>
            </div>
          ) : (
            <div className="status-badge error" onClick={onRetryHealth} title={healthError || 'Retry connection'}>
              <WarningAmberIcon sx={{ fontSize: 18, color: '#DC2626' }} />
              <span>Model Waking Up (Click to Retry)</span>
            </div>
          )}
        </div>
      </div>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
          onClick={() => onSelectTab('explorer')}
        >
          <LocationOnIcon sx={{ fontSize: 18 }} />
          <span>Sensor Explorer</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => onSelectTab('trends')}
        >
          <CalendarMonthIcon sx={{ fontSize: 18 }} />
          <span>August Trends & Calendar</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => onSelectTab('simulator')}
        >
          <ScienceIcon sx={{ fontSize: 18 }} />
          <span>Weather Simulator</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => onSelectTab('about')}
        >
          <InfoIcon sx={{ fontSize: 18 }} />
          <span>About & Science</span>
        </button>
      </nav>
    </header>
  );
};
