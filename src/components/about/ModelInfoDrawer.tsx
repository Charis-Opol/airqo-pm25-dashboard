import React from 'react';
import InfoIcon from '@mui/icons-material/Info';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HubIcon from '@mui/icons-material/Hub';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { ModelInfo } from '../../types';
import { AQI_CATEGORIES } from '../../utils/aqi';

interface ModelInfoDrawerProps {
  modelInfo: ModelInfo | null;
}

export const ModelInfoDrawer: React.FC<ModelInfoDrawerProps> = ({ modelInfo }) => {
  return (
    <div className="card model-info-card">
      <div className="info-card-header">
        <MenuBookIcon sx={{ fontSize: 24, color: '#BE123C' }} />
        <div>
          <h3 className="section-heading">Model Architecture and Scientific Methodology</h3>
          <p className="section-subheading">
            Deployment and validation specifications for the AirQo PM2.5 estimation system
          </p>
        </div>
      </div>

      <div className="info-grid-two-col">
        {/* Architecture & Deployment */}
        <div className="info-sub-card">
          <div className="sub-card-title">
            <HubIcon sx={{ fontSize: 18, color: '#BE123C' }} />
            <span>Inference Pipeline</span>
          </div>
          <table className="info-table">
            <tbody>
              <tr>
                <th>Estimator Type</th>
                <td>{modelInfo?.model || 'SVR (tuned)'} - Support Vector Regressor with RBF kernel</td>
              </tr>
              <tr>
                <th>Remote Model Service</th>
                <td>
                  <a
                    href="https://airqo-cole-charis-assgnmnt.onrender.com/health"
                    target="_blank"
                    rel="noreferrer"
                    className="service-link"
                  >
                    airqo-cole-charis-assgnmnt.onrender.com
                  </a>
                </td>
              </tr>
              <tr>
                <th>Supported Locations</th>
                <td>149 AirQo sensor nodes across Kampala and regional Uganda</td>
              </tr>
              <tr>
                <th>Feature Engineering</th>
                <td>
                  Ambient Temperature (C), Relative Humidity (%), Cyclic UTC time harmonics (hour, day of week, month), and one-hot categorical sensor encodings.
                </td>
              </tr>
              <tr>
                <th>Time Convention</th>
                <td>All time variables are computed in UTC to ensure global reproducibility.</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Validation & Holdout Metrics */}
        <div className="info-sub-card">
          <div className="sub-card-title">
            <AssessmentIcon sx={{ fontSize: 18, color: '#0284C7' }} />
            <span>Chronological Holdout Validation</span>
          </div>
          <p className="validation-lead">
            Validation evaluated on a chronological holdout period (2-3 June 2026) to prevent temporal data leakage:
          </p>

          <div className="metrics-kpi-grid">
            <div className="kpi-box">
              <span className="kpi-title">Mean Absolute Error (MAE)</span>
              <span className="kpi-number">
                {modelInfo?.validation_metrics.mae_ug_m3 || '9.34'} <small>ug/m3</small>
              </span>
              <span className="kpi-note">Average absolute deviation</span>
            </div>

            <div className="kpi-box">
              <span className="kpi-title">Root Mean Squared Error (RMSE)</span>
              <span className="kpi-number">
                {modelInfo?.validation_metrics.rmse_ug_m3 || '15.14'} <small>ug/m3</small>
              </span>
              <span className="kpi-note">Penalizes large outlier errors</span>
            </div>

            <div className="kpi-box">
              <span className="kpi-title">Coefficient of Determination (R2)</span>
              <span className="kpi-number">
                {modelInfo?.validation_metrics.r2 || '0.338'}
              </span>
              <span className="kpi-note">Holdout correlation score</span>
            </div>
          </div>
        </div>
      </div>

      {/* AQI Standards Table */}
      <div className="aqi-standards-section">
        <div className="sub-card-title" style={{ marginBottom: '12px' }}>
          <InfoIcon sx={{ fontSize: 18, color: '#16A34A' }} />
          <span>Air Quality Index (AQI) Thresholds and Health Criteria</span>
        </div>

        <div className="table-responsive">
          <table className="aqi-full-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>PM2.5 Range (ug/m3)</th>
                <th>Public Health Impact</th>
              </tr>
            </thead>
            <tbody>
              {AQI_CATEGORIES.map((cat) => (
                <tr key={cat.name}>
                  <td>
                    <span className="cat-badge-cell" style={{ backgroundColor: cat.color }}>
                      {cat.name}
                    </span>
                  </td>
                  <td>
                    {cat.lower_ug_m3 === 0 ? '0' : '>' + cat.lower_ug_m3}{' '}
                    {cat.upper_ug_m3 == null ? 'and above' : `to ${cat.upper_ug_m3}`}
                  </td>
                  <td>{cat.health_advisory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
