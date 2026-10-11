"""Model loading and prediction, following pm25_inference.py:
pipeline -> z-score -> ug/m3 (target_scaler_mean/std) -> AQI category.
"""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

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


def predict_pm25(frame):
    """Predict PM2.5 in ug/m3 for a frame holding the model feature columns."""
    predicted_zscores = pipeline.predict(frame[feature_columns])
    return predicted_zscores * target_std + target_mean
