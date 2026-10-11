"""Build the small derived files in data/ from the source repo (read-only).

    python scripts/build_data.py <path-to-airqo_cole_charis_assgnmnt>

Writes:
  data/august_2026.csv.gz        one row per model sensor and hour of August 2026
  data/place_august_means.csv    mean model prediction per sensor (for the map)
  data/validation_metrics.json   hold-out metrics copied from deployment_metadata.json

Rules: nothing is invented. Temperature/humidity are the August readings where
they exist ("observed"); otherwise the sensor's mean hour-of-day reading from
January-June 2026 ("assumed profile", with an all-sensor fallback, the same
method as the forecast section of train.ipynb). A reading of 0 is a sensor
dropout (the notebook treats 0 as missing) and so are 0 coordinates.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import predictor  # noqa: E402

source = Path(sys.argv[1])
weather = ['temperature', 'humidity']
coordinates = ['latitude', 'longitude']


def load(name):
    frame = pd.read_csv(source / name)
    frame['timestamp'] = pd.to_datetime(frame['datetime'], format='ISO8601', utc=True)
    columns = weather + ['pm2_5_calibrated_value'] + coordinates
    frame[columns] = frame[columns].replace(0, np.nan)
    return frame


history = load('Sensor Data Jan - July 2026.csv')
august = load('AirQo_August_2026_hourly_matched_partial.csv')

devices = predictor.known_devices
history = history[history['device_name'].isin(devices)]
august_all_devices = august['device_name'].nunique()
august = august[august['device_name'].isin(devices)]

# Hour-of-day profile per sensor, with the all-sensor profile as fallback.
history['hour'] = history['timestamp'].dt.hour
device_profile = history.groupby(['device_name', 'hour'])[weather].mean()
overall_profile = history.groupby('hour')[weather].mean()

attributes = (
    pd.concat([history, august])
    .groupby('device_name')
    .agg(site_name=('site_name', 'first'),
         latitude=('latitude', 'median'),
         longitude=('longitude', 'median'))
)

hours = pd.date_range('2026-08-01 00:00', '2026-08-31 23:00', freq='h', tz='UTC')
grid = pd.MultiIndex.from_product(
    [devices, hours], names=['device_name', 'timestamp']
).to_frame(index=False)
grid['hour'] = grid['timestamp'].dt.hour

observed = august[['device_name', 'timestamp'] + weather + ['pm2_5_calibrated_value']]
grid = grid.merge(observed, on=['device_name', 'timestamp'], how='left')
grid = grid.rename(columns={'pm2_5_calibrated_value': 'actual_pm25'})

is_observed = grid[weather].notna().all(axis=1)
grid['input_source'] = np.where(is_observed, 'observed', 'assumed profile')

grid = grid.merge(
    device_profile.add_suffix('_profile'),
    left_on=['device_name', 'hour'], right_index=True, how='left'
)
grid = grid.merge(
    overall_profile.add_suffix('_overall'),
    left_on='hour', right_index=True, how='left'
)
for column in weather:
    profile = grid[f'{column}_profile'].fillna(grid[f'{column}_overall'])
    # A row is "observed" only when both readings exist; otherwise both
    # inputs come from the profile, so the label is never half true.
    grid[column] = np.where(is_observed, grid[column], profile).round(2)

grid = grid.merge(attributes, left_on='device_name', right_index=True, how='left')
grid['timestamp'] = grid['timestamp'].dt.strftime('%Y-%m-%dT%H:%M:%SZ')

output = grid[[
    'device_name', 'site_name', 'timestamp', 'temperature', 'humidity',
    'actual_pm25', 'latitude', 'longitude', 'input_source',
]]
output.to_csv(ROOT / 'data' / 'august_2026.csv.gz', index=False)

# Mean prediction per sensor over August, computed with the API's own code.
features = pd.concat(
    [output[['device_name'] + weather], predictor.time_features(hours.repeat(1)[
        np.tile(np.arange(len(hours)), len(devices))])],
    axis=1,
)
output = output.assign(predicted=predictor.predict_pm25(features))
means = (
    output.groupby('device_name')
    .agg(mean_predicted_pm25=('predicted', 'mean'),
         observed_share=('input_source', lambda s: (s == 'observed').mean()))
    .round(3)
)
means.to_csv(ROOT / 'data' / 'place_august_means.csv')

metadata = json.loads((source / 'deployment_outputs' / 'deployment_metadata.json').read_text())
(ROOT / 'data' / 'validation_metrics.json').write_text(json.dumps({
    'source': 'deployment_outputs/deployment_metadata.json (train.ipynb run)',
    'setup': 'Chronological hold-out (test period 2-3 June 2026)',
    'model_name': metadata['model_name'],
    'mae_ug_m3': round(metadata['test_mae_ug_m3'], 3),
    'rmse_ug_m3': round(metadata['test_rmse_ug_m3'], 3),
    'r2': round(metadata['test_r2'], 3),
}, indent=2))

print('rows', len(output), 'sensors', len(devices))
print('august sensors in file:', august_all_devices, '| in model:', august['device_name'].nunique())
print(output['input_source'].value_counts())
print('actual rows', output['actual_pm25'].notna().sum())
print('sensors without coordinates', attributes['latitude'].isna().sum())
print(output.groupby('device_name')['actual_pm25'].count().loc[lambda s: s > 0])
