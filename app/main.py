"""AirQo PM2.5 dashboard and prediction API.

Run locally:  uvicorn app.main:app --reload
"""
import json
import math
from typing import List, Optional, Union

import numpy as np
import pandas as pd
from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import predictor
from app.aqi import MISSING_COLOR, categories_table, category_color, pm25_aqi_category
from app.predictor import ROOT, TIME_FEATURES

MAX_ROWS = 1000
TIME_CONVENTION = (
    'Timestamps are read as UTC (a timestamp with an offset is converted to UTC; '
    'one without an offset is taken as UTC). hour = UTC hour 0-23, '
    'day of week = Monday 0 .. Sunday 6, month = 1-12, each encoded as '
    'sin/cos of 2*pi*value/period (24, 7, 12), as in train.ipynb.'
)

app = FastAPI(
    title='AirQo PM2.5 prediction API',
    description='Predicts hourly PM2.5 (ug/m3) for AirQo sensors from temperature, '
                'humidity and calendar features. ' + TIME_CONVENTION,
    version='1.0.0',
)
app.add_middleware(
    CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*']
)

# --------------------------------------------------------------------------
# Data: August 2026 inputs and the places the model supports
# --------------------------------------------------------------------------
august = pd.read_csv(ROOT / 'data' / 'august_2026.csv.gz')
august['timestamp'] = pd.to_datetime(august['timestamp'], utc=True)
august_means = pd.read_csv(ROOT / 'data' / 'place_august_means.csv', index_col='device_name')
validation_metrics = json.loads((ROOT / 'data' / 'validation_metrics.json').read_text())


def _clean(value, digits=3):
    """Round a number for JSON; NaN becomes null."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return round(float(value), digits)


def _build_places():
    first_rows = august.groupby('device_name').first()
    actual_hours = august.groupby('device_name')['actual_pm25'].count()
    site_counts = first_rows['site_name'].value_counts()
    places = []
    for device in predictor.known_devices:
        row = first_rows.loc[device]
        site = row['site_name']
        # A few sites host more than one sensor; keep every label unique.
        label = site if site_counts[site] == 1 else f'{site} ({device})'
        mean = float(august_means.loc[device, 'mean_predicted_pm25'])
        category = pm25_aqi_category(mean)
        place = {
            'name': label,
            'device_name': device,
            'site_name': site,
            'has_august_actuals': bool(actual_hours[device] > 0),
            'august_observed_input_share': float(august_means.loc[device, 'observed_share']),
            'august_mean_predicted_pm25_ug_m3': round(mean, 2),
            'august_mean_aqi_category': category,
            'color': category_color(category),
        }
        if pd.notna(row['latitude']) and pd.notna(row['longitude']):
            place['latitude'] = float(row['latitude'])
            place['longitude'] = float(row['longitude'])
        places.append(place)
    return sorted(places, key=lambda place: place['name'].lower())


PLACES = _build_places()
_place_lookup = {}
for _place in PLACES:
    # Site name first, so the exact label and device id always win.
    _place_lookup.setdefault(_place['site_name'].strip().lower(), _place)
for _place in PLACES:
    _place_lookup[_place['name'].strip().lower()] = _place
    _place_lookup[_place['device_name'].lower()] = _place


def resolve_place(name):
    place = _place_lookup.get(str(name).strip().lower())
    if place is None:
        raise HTTPException(status_code=400, detail={
            'message': f"Unknown device_name '{name}'. Use a place name or device id "
                       'from /api/places.',
            'supported_places': [place['name'] for place in PLACES],
        })
    return place


# --------------------------------------------------------------------------
# Request / response schema
# --------------------------------------------------------------------------
class PredictRow(BaseModel):
    device_name: str = Field(..., description='Place name or device id as listed in /api/places')
    timestamp: Optional[str] = Field(
        None, description='ISO 8601 date and time, read as UTC. Leave out only when '
                          'the six sin/cos time features are given instead.')
    temperature: float = Field(..., description='Temperature in degrees Celsius')
    humidity: float = Field(..., ge=0, le=100, description='Relative humidity, 0-100 %')
    hour_sin: Optional[float] = None
    hour_cos: Optional[float] = None
    day_of_week_sin: Optional[float] = None
    day_of_week_cos: Optional[float] = None
    month_sin: Optional[float] = None
    month_cos: Optional[float] = None


class PredictBatch(BaseModel):
    rows: List[PredictRow]


class Prediction(BaseModel):
    device_name: str
    timestamp: Optional[str] = None
    predicted_pm25_ug_m3: float
    aqi_category: str
    color: str


class PredictResponse(BaseModel):
    count: int
    model: str
    predictions: List[Prediction]


EXAMPLE_PLACE = next(place['name'] for place in PLACES if place['has_august_actuals'])
EXAMPLE_ROW = {
    'device_name': EXAMPLE_PLACE,
    'timestamp': '2026-08-14T09:00:00',
    'temperature': 24.5,
    'humidity': 71,
}
PREDICT_EXAMPLES = {
    'single': {'summary': 'Single row', 'value': EXAMPLE_ROW},
    'batch': {'summary': 'Batch', 'value': {'rows': [
        EXAMPLE_ROW, dict(EXAMPLE_ROW, timestamp='2026-08-14T18:00:00', temperature=21.0, humidity=85),
    ]}},
    'model_ready': {'summary': 'Model-ready row (same input as pm25_inference.py)', 'value': {
        'device_name': EXAMPLE_PLACE, 'temperature': 24.5, 'humidity': 71,
        'hour_sin': 0.7071, 'hour_cos': -0.7071,
        'day_of_week_sin': -0.4339, 'day_of_week_cos': -0.9010,
        'month_sin': -0.8660, 'month_cos': -0.5,
    }},
}


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    messages = []
    for item in error.errors():
        where = '.'.join(str(part) for part in item['loc'] if part not in ('body', 'query'))
        messages.append(f"{where or 'request'}: {item['msg']}")
    # A single object is tried as a batch first, so drop that noise.
    specific = [m for m in messages if not m.startswith(('PredictBatch.rows:', 'rows:')) or len(messages) == 1]
    return JSONResponse(status_code=422, content={
        'detail': 'Invalid input. ' + '; '.join(specific or messages),
        'expected': 'device_name (text), timestamp (ISO 8601), temperature (number), '
                    'humidity (number, 0-100). See /predict or /docs.',
    })


def _row_features(row, position):
    """Turn one request row into the model's feature values (or raise 422)."""
    where = f'rows[{position}]'
    if not math.isfinite(row.temperature) or not math.isfinite(row.humidity):
        raise HTTPException(422, f'{where}: temperature and humidity must be finite numbers.')

    if row.timestamp is not None:
        try:
            timestamp = pd.Timestamp(row.timestamp)
            if timestamp is pd.NaT:
                raise ValueError('empty timestamp')
        except (ValueError, TypeError):
            raise HTTPException(
                422, f"{where}: timestamp '{row.timestamp}' could not be read. "
                     "Use ISO 8601, e.g. '2026-08-14T09:00:00'.")
        timestamp = timestamp.tz_localize('UTC') if timestamp.tzinfo is None else timestamp.tz_convert('UTC')
        time_values = predictor.time_features([timestamp]).iloc[0].to_dict()
    else:
        time_values = {name: getattr(row, name) for name in TIME_FEATURES}
        missing = [name for name, value in time_values.items() if value is None]
        if missing:
            raise HTTPException(
                422, f"{where}: give a 'timestamp', or all six time features "
                     f'(missing: {", ".join(missing)}).')

    place = resolve_place(row.device_name)
    return dict(time_values, temperature=row.temperature, humidity=row.humidity,
                device_name=place['device_name'])


# --------------------------------------------------------------------------
# Endpoints
# --------------------------------------------------------------------------
@app.get('/health')
def health():
    return {'status': 'ok', 'model_loaded': predictor.pipeline is not None}


@app.get('/api/model-info')
def model_info():
    return {
        'model': predictor.model_name,
        'estimator': repr(predictor.pipeline.steps[-1][1]),
        'numeric_features': predictor.numeric_features,
        'categorical_features': predictor.categorical_features,
        'features': predictor.feature_columns,
        'supported_places': len(PLACES),
        'unseen_device_handling': 'The pipeline one-hot encodes device_name with '
                                  "handle_unknown='ignore'; this API rejects unknown places with 400 instead.",
        'target': 'PM2.5 in ug/m3 (model predicts a z-score; converted back with the saved mean and std)',
        'time_convention': TIME_CONVENTION,
        'aqi_categories': categories_table(),
        'missing_color': MISSING_COLOR,
        'validation_metrics': validation_metrics,
        'limitation': 'Predictions are model estimates that rely on temperature, humidity and '
                      'calendar features only; any assumed inputs are labelled.',
        'max_rows_per_request': MAX_ROWS,
    }


@app.get('/api/places')
def places():
    return {'count': len(PLACES), 'places': PLACES}


_august_cache = {}


def _august_predictions(device):
    """Hourly August rows for one sensor, with the model prediction."""
    if device not in _august_cache:
        rows = august[august['device_name'] == device].reset_index(drop=True)
        features = pd.concat(
            [rows[['temperature', 'humidity', 'device_name']],
             predictor.time_features(rows['timestamp'])], axis=1)
        _august_cache[device] = rows.assign(predicted=predictor.predict_pm25(features))
    return _august_cache[device]


def _parse_bound(value, name, end_of_day=False):
    try:
        bound = pd.Timestamp(value)
        if bound is pd.NaT:
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(422, f"{name} '{value}' could not be read. Use e.g. 2026-08-01.")
    bound = bound.tz_localize('UTC') if bound.tzinfo is None else bound.tz_convert('UTC')
    if end_of_day and len(str(value).strip()) <= 10:
        bound = bound + pd.Timedelta(hours=23)
    return bound


@app.get('/api/august')
def august_series(
    place: str = Query(..., description='Place name or device id from /api/places'),
    start: str = Query('2026-08-01', description='First day (UTC)'),
    end: str = Query('2026-08-31', description='Last day (UTC), inclusive'),
    resolution: str = Query('hourly', description='hourly or daily'),
):
    if resolution not in ('hourly', 'daily'):
        raise HTTPException(422, "resolution must be 'hourly' or 'daily'.")
    info = resolve_place(place)
    start_time = _parse_bound(start, 'start')
    end_time = _parse_bound(end, 'end', end_of_day=True)
    if end_time < start_time:
        raise HTTPException(422, 'end must not be before start.')

    rows = _august_predictions(info['device_name'])
    rows = rows[(rows['timestamp'] >= start_time) & (rows['timestamp'] <= end_time)]

    paired = rows.dropna(subset=['actual_pm25'])
    metrics = None
    if len(paired):
        errors = paired['predicted'] - paired['actual_pm25']
        metrics = {
            'mae_ug_m3': _clean(errors.abs().mean()),
            'rmse_ug_m3': _clean(np.sqrt((errors ** 2).mean())),
            'hours_compared': int(len(paired)),
            'note': 'Computed on the hourly points in the range that have an actual PM2.5 reading.',
        }

    points = []
    if resolution == 'hourly':
        for row in rows.itertuples():
            category = pm25_aqi_category(row.predicted)
            points.append({
                'timestamp': row.timestamp.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'predicted_pm25_ug_m3': _clean(row.predicted),
                'aqi_category': category,
                'color': category_color(category),
                'actual_pm25_ug_m3': _clean(row.actual_pm25),
                'temperature': _clean(row.temperature, 2),
                'humidity': _clean(row.humidity, 2),
                'input_source': row.input_source,
            })
    else:
        for day, group in rows.groupby(rows['timestamp'].dt.strftime('%Y-%m-%d')):
            mean = float(group['predicted'].mean())
            category = pm25_aqi_category(mean)
            observed_share = float((group['input_source'] == 'observed').mean())
            source = ('observed' if observed_share == 1
                      else 'assumed profile' if observed_share == 0 else 'mixed')
            points.append({
                'timestamp': day,
                'predicted_pm25_ug_m3': _clean(mean),
                'aqi_category': category,
                'color': category_color(category),
                'actual_pm25_ug_m3': _clean(group['actual_pm25'].mean()),
                'actual_hours': int(group['actual_pm25'].notna().sum()),
                'temperature': _clean(group['temperature'].mean(), 2),
                'humidity': _clean(group['humidity'].mean(), 2),
                'input_source': source,
                'observed_input_share': round(observed_share, 3),
            })

    observed_share = float((rows['input_source'] == 'observed').mean()) if len(rows) else 0.0
    return {
        'place': info,
        'start': start_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'end': end_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'resolution': resolution,
        'count': len(points),
        'model': predictor.model_name,
        'input_source_summary': {
            'observed_share': round(observed_share, 3),
            'assumed_profile_share': round(1 - observed_share, 3),
            'label': ('observed inputs' if observed_share == 1
                      else 'assumed inputs' if observed_share == 0
                      else 'observed + assumed inputs'),
        },
        'metrics': metrics,
        'points': points,
    }


PREDICT_USAGE = {
    'message': 'Send a JSON POST to this URL to get a PM2.5 prediction.',
    'method': 'POST',
    'content_type': 'application/json',
    'example_request': EXAMPLE_ROW,
    'example_batch_request': {'rows': [EXAMPLE_ROW]},
    'response_shape': {
        'count': 1, 'model': predictor.model_name,
        'predictions': [{
            'device_name': EXAMPLE_PLACE, 'timestamp': '2026-08-14T09:00:00',
            'predicted_pm25_ug_m3': 0.0, 'aqi_category': '...', 'color': '#......',
        }],
    },
    'time_convention': TIME_CONVENTION,
    'places': '/api/places',
    'docs': '/docs',
}


@app.get('/predict', include_in_schema=False)
@app.get('/api/predict', include_in_schema=False)
def predict_usage():
    return PREDICT_USAGE


def predict(body: Union[PredictBatch, PredictRow] = Body(..., openapi_examples=PREDICT_EXAMPLES)):
    """Predict PM2.5 for one row or a batch (`{"rows": [...]}`, up to 1000 rows).

    Each row needs `device_name`, `temperature`, `humidity` and either a
    `timestamp` or the six model-ready sin/cos time features.
    """
    rows = body.rows if isinstance(body, PredictBatch) else [body]
    if not rows:
        raise HTTPException(422, 'rows must contain at least one row.')
    if len(rows) > MAX_ROWS:
        raise HTTPException(422, f'Too many rows: {len(rows)}. The limit is {MAX_ROWS} per request.')

    features = pd.DataFrame([_row_features(row, position) for position, row in enumerate(rows)])
    values = predictor.predict_pm25(features)

    predictions = []
    for row, value in zip(rows, values):
        category = pm25_aqi_category(float(value))
        predictions.append({
            'device_name': row.device_name,
            'timestamp': row.timestamp,
            'predicted_pm25_ug_m3': round(float(value), 3),
            'aqi_category': category,
            'color': category_color(category),
        })
    return {'count': len(predictions), 'model': predictor.model_name, 'predictions': predictions}


app.post('/predict', response_model=PredictResponse, summary='Predict PM2.5')(predict)
app.post('/api/predict', response_model=PredictResponse, summary='Predict PM2.5 (alias of /predict)')(predict)

# The dashboard (web/) is served from the same service; keep this last.
app.mount('/', StaticFiles(directory=ROOT / 'web', html=True), name='web')
