"""Model loading and prediction, following pm25_inference.py:
pipeline -> z-score -> ug/m3 (target_scaler_mean/std) -> AQI category.
"""
import json
import urllib.error
import urllib.request
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app import config

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / 'model' / 'best_pm25_model.joblib'

TIME_FEATURES = [
    'hour_sin', 'hour_cos',
    'day_of_week_sin', 'day_of_week_cos',
    'month_sin', 'month_cos',
]

artifact = joblib.load(MODEL_PATH)
pipeline = artifact['pipeline']
target_mean = artifact['target_scaler_mean']
target_std = artifact['target_scaler_std']
numeric_features = list(artifact['numeric_feature_columns'])
categorical_features = list(artifact['categorical_feature_columns'])
feature_columns = numeric_features + categorical_features
model_name = artifact.get('model_name', type(pipeline.steps[-1][1]).__name__)

_encoder = (
    pipeline.named_steps['preprocessor']
    .named_transformers_['categorical']
    .named_steps['one_hot_encoder']
)
known_devices = [str(device) for device in _encoder.categories_[0]]


def time_features(timestamps):
    """Cyclical time features exactly as add_time_features in train.ipynb:
    UTC hour (0-23), pandas dayofweek (Monday=0 .. Sunday=6), month (1-12).
    """
    index = pd.DatetimeIndex(timestamps)
    hour = index.hour
    day_of_week = index.dayofweek
    month = index.month
    return pd.DataFrame({
        'hour_sin': np.sin(2 * np.pi * hour / 24),
        'hour_cos': np.cos(2 * np.pi * hour / 24),
        'day_of_week_sin': np.sin(2 * np.pi * day_of_week / 7),
        'day_of_week_cos': np.cos(2 * np.pi * day_of_week / 7),
        'month_sin': np.sin(2 * np.pi * month / 12),
        'month_cos': np.cos(2 * np.pi * month / 12),
    })


class ModelServiceError(RuntimeError):
    """The remote model service could not be reached or gave a bad answer."""


REMOTE_BATCH_ROWS = 1000


def _post_json(url, body):
    headers = {'Content-Type': 'application/json'}
    if config.MODEL_API_KEY:
        headers['X-API-Key'] = config.MODEL_API_KEY
    request = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(request, timeout=config.MODEL_API_TIMEOUT) as response:
        return json.loads(response.read())


def _predict_remote(frame):
    """Send model-ready rows to the model service's POST /predict.

    That service takes {"rows": [{feature: value, ...}]} and returns
    {"predictions": [{"predicted_pm25_ug_m3": ..., "aqi_category": ...}]}.
    """
    url = config.MODEL_API_URL + '/predict'
    rows = frame[feature_columns].to_dict('records')
    values = []
    for start in range(0, len(rows), REMOTE_BATCH_ROWS):
        batch = rows[start:start + REMOTE_BATCH_ROWS]
        try:
            answer = _post_json(url, {'rows': batch})
            values.extend(float(item['predicted_pm25_ug_m3']) for item in answer['predictions'])
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors='replace')[:200]
            raise ModelServiceError(f'Model service answered {error.code}: {detail}')
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise ModelServiceError(f'Model service could not be reached: {error}')
        except (KeyError, TypeError, ValueError) as error:
            raise ModelServiceError(f'Model service gave an unexpected answer: {error!r}')
    if len(values) != len(rows):
        raise ModelServiceError(
            f'Model service returned {len(values)} predictions for {len(rows)} rows.')
    return np.array(values)


def model_source():
    return 'remote model service' if config.MODEL_API_URL else 'local model file'


def predict_pm25(frame):
    """Predict PM2.5 in ug/m3 for a frame holding the model feature columns.

    Uses the model service at MODEL_API_URL when it is set; otherwise the
    local model file, as pm25_inference.py does.
    """
    if config.MODEL_API_URL:
        return _predict_remote(frame)
    predicted_zscores = pipeline.predict(frame[feature_columns])
    return predicted_zscores * target_std + target_mean
