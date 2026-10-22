import React, { useState } from 'react';
import ScienceIcon from '@mui/icons-material/Science';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import PlaceIcon from '@mui/icons-material/Place';
import SyncIcon from '@mui/icons-material/Sync';
import { Place, PredictRowInput, PredictResponseItem } from '../../types';
import { computeTimeFeatures } from '../../utils/timeFeatures';
import { predictRows } from '../../api/client';
import { getAqiCategory, getTextColorForBackground } from '../../utils/aqi';

interface WeatherSimulatorProps {
  places: Place[];
  selectedPlace: Place;
}

export const WeatherSimulator: React.FC<WeatherSimulatorProps> = ({
  places,
  selectedPlace,
}) => {
  const [devicePlace, setDevicePlace] = useState(selectedPlace.name);
  const [dateStr, setDateStr] = useState('2026-08-14T09:00');
  const [temperature, setTemperature] = useState<number>(24.5);
  const [humidity, setHumidity] = useState<number>(71);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictResponseItem | null>(null);
  const [lastRequestPayload, setLastRequestPayload] = useState<PredictRowInput | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDevDrawer, setShowDevDrawer] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);

    try {
      const activePlace = places.find((p) => p.name === devicePlace) || selectedPlace;
      const targetDate = new Date(dateStr.endsWith(':00') ? dateStr : `${dateStr}:00Z`);
      const timeFeatures = computeTimeFeatures(targetDate);

      const rowInput: PredictRowInput = {
        temperature: Number(temperature),
        humidity: Number(humidity),
        hour_sin: Number(timeFeatures.hour_sin.toFixed(4)),
        hour_cos: Number(timeFeatures.hour_cos.toFixed(4)),
        day_of_week_sin: Number(timeFeatures.day_of_week_sin.toFixed(4)),
        day_of_week_cos: Number(timeFeatures.day_of_week_cos.toFixed(4)),
        month_sin: Number(timeFeatures.month_sin.toFixed(4)),
        month_cos: Number(timeFeatures.month_cos.toFixed(4)),
        device_name: activePlace.device_name,
      };

      setLastRequestPayload(rowInput);

      const response = await predictRows([rowInput]);
      if (response && response.predictions && response.predictions.length > 0) {
        setPrediction(response.predictions[0]);
      } else {
        throw new Error('No prediction returned from backend');
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to compute model prediction.');
      }
    } finally {
      setLoading(false);
    }
  };

  const curlCommand = lastRequestPayload
    ? `curl -X POST "https://airqo-cole-charis-assgnmnt.onrender.com/predict" \\\n  -H "Content-Type: application/json" \\\n  -d '{"rows": [${JSON.stringify(lastRequestPayload)}]}'`
    : 'Run a simulation to generate the cURL request.';

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const activeCategory = prediction ? getAqiCategory(prediction.predicted_pm25_ug_m3) : null;
  const textColor = activeCategory ? getTextColorForBackground(activeCategory.color) : '#FFFFFF';

  return (
    <div className="card weather-simulator-card">
      <div className="simulator-header">
        <ScienceIcon sx={{ fontSize: 24, color: '#BE123C' }} />
        <div>
          <h3 className="section-heading">Interactive Weather Simulator</h3>
          <p className="section-subheading">
            Adjust weather parameters to observe how ambient conditions alter particulate PM2.5 levels
          </p>
        </div>
      </div>

      <div className="simulator-body-grid">
        {/* Controls Column */}
        <div className="simulator-controls-panel">
          <div className="form-group">
            <label className="form-label">
              <PlaceIcon sx={{ fontSize: 16 }} />
              <span>Location</span>
            </label>
            <select
              className="form-select"
              value={devicePlace}
              onChange={(e) => setDevicePlace(e.target.value)}
            >
              {places.map((p) => (
                <option key={p.device_name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              <AccessTimeIcon sx={{ fontSize: 16 }} />
              <span>Date and Time (UTC)</span>
            </label>
            <input
              type="datetime-local"
              className="form-input"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>

          <div className="form-group slider-group">
            <div className="slider-label-row">
              <span className="slider-name">
                <ThermostatIcon sx={{ fontSize: 16, color: '#EA580C' }} />
                <span>Temperature</span>
              </span>
              <span className="slider-current-val">{temperature} C</span>
            </div>
            <input
              type="range"
              min="10"
              max="45"
              step="0.5"
              className="range-slider"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
            />
            <div className="slider-ticks">
              <span>10 C (Cool)</span>
              <span>25 C (Moderate)</span>
              <span>45 C (Hot)</span>
            </div>
          </div>

          <div className="form-group slider-group">
            <div className="slider-label-row">
              <span className="slider-name">
                <WaterDropIcon sx={{ fontSize: 16, color: '#0284C7' }} />
                <span>Relative Humidity</span>
              </span>
              <span className="slider-current-val">{humidity}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="1"
              className="range-slider"
              value={humidity}
              onChange={(e) => setHumidity(parseInt(e.target.value, 10))}
            />
            <div className="slider-ticks">
              <span>10% (Dry)</span>
              <span>55% (Normal)</span>
              <span>100% (Rain / Fog)</span>
            </div>
          </div>

          <button
            className="simulate-submit-btn"
            onClick={handleSimulate}
            disabled={loading}
          >
            {loading ? (
              <>
                <SyncIcon className="spin-icon" sx={{ fontSize: 18 }} />
                <span>Computing Forecast...</span>
              </>
            ) : (
              <>
                <PlayArrowIcon sx={{ fontSize: 18 }} />
                <span>Calculate PM2.5 Forecast</span>
              </>
            )}
          </button>

          {error && <div className="simulator-error-banner">{error}</div>}
        </div>

        {/* Prediction Display Column */}
        <div className="simulator-result-panel">
          {prediction && activeCategory ? (
            <div className="result-display-box" style={{ borderLeftColor: activeCategory.color }}>
              <span className="result-caption">Model Forecast Verdict</span>
              <div className="result-big-number">
                <span className="number-val">{prediction.predicted_pm25_ug_m3.toFixed(1)}</span>
                <span className="number-unit">ug/m3</span>
              </div>
              <div
                className="result-category-chip"
                style={{ backgroundColor: activeCategory.color, color: textColor }}
              >
                {activeCategory.name}
              </div>

              <div className="result-advisory-card">
                <h4>Health Recommendation:</h4>
                <p>{activeCategory.health_advisory}</p>
              </div>

              <div className="result-context-notes">
                <span>Model: SVR (Support Vector Regressor)</span>
                <span>Location: {devicePlace}</span>
                <span>Parameters: {temperature} C at {humidity}% relative humidity</span>
              </div>
            </div>
          ) : (
            <div className="result-placeholder-box">
              <ScienceIcon sx={{ fontSize: 48, color: '#CBD5E1' }} />
              <h4>Ready for Simulation</h4>
              <p>
                Select ambient weather settings on the left and click Calculate PM2.5 Forecast to evaluate particulate levels.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Developer and Reviewer Inspector */}
      <div className="dev-inspector-section">
        <button
          className="dev-toggle-btn"
          onClick={() => setShowDevDrawer(!showDevDrawer)}
        >
          <CodeIcon sx={{ fontSize: 16 }} />
          <span>{showDevDrawer ? 'Hide Technical Request Payload' : 'For Developers: View API Payload & cURL'}</span>
        </button>

        {showDevDrawer && (
          <div className="dev-drawer-content">
            <div className="code-block-header">
              <span>cURL Command</span>
              <button className="copy-btn" onClick={handleCopyCurl}>
                {copied ? (
                  <>
                    <CheckIcon sx={{ fontSize: 14 }} />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="code-pre">{curlCommand}</pre>

            {lastRequestPayload && (
              <>
                <div className="code-block-header" style={{ marginTop: '12px' }}>
                  <span>Synthesized Model Features (UTC cyclic)</span>
                </div>
                <pre className="code-pre">{JSON.stringify(lastRequestPayload, null, 2)}</pre>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
