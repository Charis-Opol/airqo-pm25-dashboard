"""Smoke test: POST /predict must match pm25_inference.py.

tests/pm25_inference_sample_output.json is the output of the source repo's
pm25_inference.py for 5 rows of its test feature file, run with this model.
"""
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.aqi import AQI_COLORS
from app.main import app

client = TestClient(app)
SAMPLES = json.loads(
    (Path(__file__).parent / 'pm25_inference_sample_output.json').read_text()
)
FEATURES = [
    'temperature', 'humidity', 'hour_sin', 'hour_cos', 'day_of_week_sin',
    'day_of_week_cos', 'month_sin', 'month_cos', 'device_name',
]
GOOD_ROW = {
    'device_name': SAMPLES[0]['device_name'],
    'timestamp': '2026-08-14T09:00:00',
    'temperature': 24.5,
    'humidity': 71,
}


def model_ready(sample):
    return {name: sample[name] for name in FEATURES}


def check(prediction, sample):
    assert abs(prediction['predicted_pm25_ug_m3'] - sample['predicted_pm25_ug_m3']) < 1e-3
    assert prediction['aqi_category'] == sample['aqi_category']
    assert prediction['color'] == AQI_COLORS[sample['aqi_category']]


def test_health():
    assert client.get('/health').json() == {'status': 'ok', 'model_loaded': True}


def test_single_matches_pm25_inference():
    for sample in SAMPLES:
        body = client.post('/predict', json=model_ready(sample)).json()
        assert body['count'] == 1
        check(body['predictions'][0], sample)


def test_batch_matches_pm25_inference():
    for path in ('/predict', '/api/predict'):
        response = client.post(path, json={'rows': [model_ready(s) for s in SAMPLES]})
        assert response.status_code == 200
        body = response.json()
        assert body['count'] == len(SAMPLES)
        for prediction, sample in zip(body['predictions'], SAMPLES):
            check(prediction, sample)


def test_timestamp_gives_same_result_as_time_features():
    # 2026-08-14 09:00 UTC is a Friday: hour 9, dayofweek 4, month 8.
    import math
    ready = dict(
        GOOD_ROW,
        hour_sin=math.sin(2 * math.pi * 9 / 24), hour_cos=math.cos(2 * math.pi * 9 / 24),
        day_of_week_sin=math.sin(2 * math.pi * 4 / 7), day_of_week_cos=math.cos(2 * math.pi * 4 / 7),
        month_sin=math.sin(2 * math.pi * 8 / 12), month_cos=math.cos(2 * math.pi * 8 / 12),
    )
    del ready['timestamp']
    from_timestamp = client.post('/predict', json=GOOD_ROW).json()['predictions'][0]
    from_features = client.post('/predict', json=ready).json()['predictions'][0]
    assert from_timestamp['predicted_pm25_ug_m3'] == from_features['predicted_pm25_ug_m3']
    assert from_timestamp['timestamp'] == '2026-08-14T09:00:00'


def test_bad_humidity_is_422():
    response = client.post('/predict', json=dict(GOOD_ROW, humidity=140))
    assert response.status_code == 422
    assert 'humidity' in response.json()['detail']


def test_bad_timestamp_and_text_temperature_are_422():
    assert client.post('/predict', json=dict(GOOD_ROW, timestamp='not a date')).status_code == 422
    assert client.post('/predict', json=dict(GOOD_ROW, temperature='warm')).status_code == 422


def test_unknown_place_is_400():
    response = client.post('/predict', json=dict(GOOD_ROW, device_name='Atlantis'))
    assert response.status_code == 400
    assert len(response.json()['detail']['supported_places']) > 0


def test_api_key_is_enforced_when_set(monkeypatch):
    from app import config
    monkeypatch.setattr(config, 'API_KEY', 'secret-for-test')
    assert client.get('/health').status_code == 200
    assert client.get('/api/places').status_code == 401
    assert client.post('/predict', json=GOOD_ROW).status_code == 401
    assert client.post('/predict', json=GOOD_ROW, headers={'X-API-Key': 'wrong'}).status_code == 401
    headers = {'X-API-Key': 'secret-for-test'}
    assert client.get('/api/places', headers=headers).status_code == 200
    assert client.post('/predict', json=GOOD_ROW, headers=headers).status_code == 200
