"""Smoke test: POST /predict must match pm25_inference.py.

tests/pm25_inference_sample_output.json is the output of the source repo's
pm25_inference.py for 5 rows of its test feature file, run with this model.
"""
import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.aqi import AQI_COLORS
from app import config, predictor
from app.main import app

# Tests must not depend on a local .env: no API key, and the comparison
# with pm25_inference.py uses the local model file.
config.API_KEY = ''
config.MODEL_API_URL = ''

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
    health = client.get('/health').json()
    assert health['status'] == 'ok' and health['model_loaded'] is True


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


def test_remote_model_service_is_used_when_set(monkeypatch):
    sent = {}

    def fake_post(url, body):
        sent['url'], sent['rows'] = url, body['rows']
        return {'predictions': [{'predicted_pm25_ug_m3': 60.0, 'aqi_category': 'Unhealthy'}
                                for _ in body['rows']]}

    monkeypatch.setattr(config, 'MODEL_API_URL', 'https://model.example')
    monkeypatch.setattr(predictor, '_post_json', fake_post)
    body = client.post('/predict', json={'rows': [GOOD_ROW, GOOD_ROW]}).json()
    assert sent['url'] == 'https://model.example/predict'
    assert sorted(sent['rows'][0]) == sorted(FEATURES)
    assert body['count'] == 2
    assert body['predictions'][0]['predicted_pm25_ug_m3'] == 60.0
    assert body['predictions'][0]['aqi_category'] == 'Unhealthy'
    assert body['predictions'][0]['color'] == AQI_COLORS['Unhealthy']


def test_remote_model_service_failure_is_502(monkeypatch):
    def broken_post(url, body):
        raise OSError('connection refused')

    monkeypatch.setattr(config, 'MODEL_API_URL', 'https://model.example')
    monkeypatch.setattr(predictor, '_post_json', broken_post)
    assert client.post('/predict', json=GOOD_ROW).status_code == 502


def test_model_name_comes_from_the_model_service(monkeypatch):
    monkeypatch.setattr(config, 'MODEL_API_URL', 'https://model.example')
    monkeypatch.setattr(predictor, '_remote_info', {'url': None, 'time': 0.0, 'value': None})
    monkeypatch.setattr(predictor, '_get_json', lambda url: {'status': 'ok', 'model': 'Some other model'})
    info = client.get('/api/model-info').json()
    assert info['model'] == 'Some other model'
    assert info['model_name_source'] == 'model service /health'
    # File-based details describe a different model, so they are not shown.
    assert info['estimator'] is None and info['validation_metrics'] is None


def test_model_name_is_the_file_name_without_a_model_service():
    info = client.get('/api/model-info').json()
    assert info['model'] == predictor.model_name
    assert info['model_name_source'] == 'local model file'
    assert info['validation_metrics']['model_name'] == predictor.model_name
