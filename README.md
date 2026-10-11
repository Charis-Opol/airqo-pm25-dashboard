# AirQo PM2.5 dashboard and prediction API

A small web dashboard and JSON API around the PM2.5 model trained in
[airqo_cole_charis_assgnmnt](https://github.com/coleRodneyMigisha/airqo_cole_charis_assgnmnt)
(`train.ipynb`). One FastAPI service serves both the API and the dashboard.

- **Model:** scikit-learn pipeline, `SVR (tuned)`. Inputs: `temperature`, `humidity`,
  `hour_sin/cos`, `day_of_week_sin/cos`, `month_sin/cos`, `device_name` (149 sensors).
  It predicts a z-score that is converted back to µg/m³ and then to a PM2.5 category,
  exactly as `pm25_inference.py` does.
- **Hold-out metrics from the notebook run:** MAE 9.341 µg/m³, RMSE 15.138 µg/m³, R² 0.338
  (chronological hold-out, 2–3 June 2026).
- **Predictions are model estimates.** They rely only on temperature, humidity and calendar
  features. Every point is labelled `observed` or `assumed profile` (see *August data*).

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open <http://127.0.0.1:8000> for the dashboard and <http://127.0.0.1:8000/docs> for the API docs.
Run the smoke test with `pip install pytest httpx` then `python -m pytest tests`.

## Settings (.env)

All settings are optional. Copy `.env.example` to `.env` for local runs (the app reads it on start;
`.env` is not committed). On Render, add the same names under **Environment**.

| Name | Used by | Meaning |
| --- | --- | --- |
| `API_KEY` | API | If set, `/api/*` and `POST /predict` need the header `X-API-Key: <key>` (otherwise `401`). Empty = open API. `/health` is always open. |
| `ALLOWED_ORIGINS` | API | Sites allowed to call the API from a browser, comma separated. Default `*`. |
| `MODEL_API_URL` | API | Model service that makes the predictions, e.g. `https://airqo-cole-charis-assgnmnt.onrender.com`. Empty = use the model file in `model/`. |
| `MODEL_API_KEY` | API | Sent to the model service as `X-API-Key`. Empty if it needs no key. |
| `UI_API_BASE_URL` | Dashboard | URL of the API when it runs on another service, e.g. `https://airqo-pm25-api.onrender.com`. Empty = same service. |
| `UI_API_KEY` | Dashboard | Key the dashboard sends as `X-API-Key`. Empty = reuse `API_KEY`. |

The dashboard gets `UI_API_BASE_URL` and `UI_API_KEY` from `/config.js`, which the app fills from these
settings. If `web/` is hosted on its own as static files, put the two values in `web/config.js` instead.
The dashboard only calls routes that exist in the API: `/health`, `/api/model-info`, `/api/places`,
`/api/august` and `POST /predict`.

### Using a separate model service

With `MODEL_API_URL` set, every prediction (the August charts and `POST /predict`) is made by that
service. This app builds the model-ready rows (time features, place check), sends them to the
service's `POST /predict` as `{"rows": [...]}` and adds the colour and response shape. It only uses the
route that service has (`POST /predict`). The dashboard still talks to this app, not to the model
service directly, because browsers are not allowed to call that service from another site.
Places, August inputs, actual readings and colours are served by this app. If the model service
cannot be reached the API answers `502`; a sleeping free Render instance can take about a minute to wake.

**The dashboard key is not secret.** A browser page cannot hide a key, so anyone who can open the
dashboard can read it. Use it to keep casual callers out, not to protect anything sensitive.

With a key set, add the header to every call:

```bash
curl -X POST "<base-url>/predict"   -H "Content-Type: application/json"   -H "X-API-Key: <your-api-key>"   -d '{"device_name": "Kyarwabuganda", "timestamp": "2026-08-14T09:00:00", "temperature": 24.5, "humidity": 71}'
```

```python
requests.post(f"{base_url}/predict", json=row, headers={"X-API-Key": "<your-api-key>"})
```

## Using the API

| Endpoint | What it returns |
| --- | --- |
| `GET /health` | `{"status":"ok","model_loaded":true}` |
| `GET /api/model-info` | Model type, features, PM2.5 categories with thresholds and colours |
| `GET /api/places` | The 149 places the model supports (latitude/longitude where the source data has them) |
| `GET /api/august?place=...&start=2026-08-01&end=2026-08-31&resolution=hourly\|daily` | Predicted PM2.5 and category per point, actual values and MAE/RMSE where actuals exist, `input_source` per point |
| `POST /predict` | The prediction endpoint (`POST /api/predict` is an alias) |

### POST /predict

Replace `<base-url>` with your Render URL (or `http://127.0.0.1:8000`).

Single row:

```bash
curl -X POST "<base-url>/predict" \
  -H "Content-Type: application/json" \
  -d '{"device_name": "Kyarwabuganda", "timestamp": "2026-08-14T09:00:00", "temperature": 24.5, "humidity": 71}'
```

Batch (up to 1000 rows):

```bash
curl -X POST "<base-url>/predict" \
  -H "Content-Type: application/json" \
  -d '{"rows": [
        {"device_name": "Kyarwabuganda", "timestamp": "2026-08-14T09:00:00", "temperature": 24.5, "humidity": 71},
        {"device_name": "Kyarwabuganda", "timestamp": "2026-08-14T18:00:00", "temperature": 21.0, "humidity": 85}
      ]}'
```

Python:

```python
import requests

base_url = "<base-url>"
row = {"device_name": "Kyarwabuganda", "timestamp": "2026-08-14T09:00:00",
       "temperature": 24.5, "humidity": 71}

single = requests.post(f"{base_url}/predict", json=row).json()
batch = requests.post(f"{base_url}/predict", json={"rows": [row, row]}).json()
print(single["predictions"][0])
```

Response (always this shape):

```json
{
  "count": 1,
  "model": "SVR (tuned)",
  "predictions": [
    {
      "device_name": "Kyarwabuganda",
      "timestamp": "2026-08-14T09:00:00",
      "predicted_pm25_ug_m3": 24.078,
      "aqi_category": "Moderate",
      "color": "#f1c40f"
    }
  ]
}
```

- `device_name` is a place name or device id from `/api/places` (for example `Kyarwabuganda` or `airqo_g5559`).
- Model-ready rows also work: leave out `timestamp` and send `hour_sin`, `hour_cos`,
  `day_of_week_sin`, `day_of_week_cos`, `month_sin`, `month_cos` (the same columns as `pm25_inference.py`).
- Errors: `422` with a clear message for bad input (text instead of a number, humidity outside 0–100,
  unreadable timestamp, more than 1000 rows); `401` for a missing or wrong API key when one is set; `400` with the list of supported places for an unknown `device_name`.

### Time convention

The API follows `add_time_features` in `train.ipynb`: timestamps are **UTC**
(a timestamp with an offset is converted to UTC; one without an offset is taken as UTC, not Kampala time),
hour = 0–23, day of week = **Monday 0 … Sunday 6** (pandas `dayofweek`), month = 1–12,
each encoded as `sin`/`cos` of `2π·value/period` with periods 24, 7 and 12.

### PM2.5 categories

Names and thresholds come from `pm25_inference.py`, colours from `AQI_COLORS` in `train.ipynb`.
They live in one place, `app/aqi.py`, and reach the dashboard through `/api/model-info`.

| Category | PM2.5 (µg/m³) | Colour |
| --- | --- | --- |
| Good | 0 – 9 | `#2ca25f` |
| Moderate | > 9 – 35.49 | `#f1c40f` |
| Unhealthy for Sensitive Groups | > 35.49 – 55.49 | `#f39c12` |
| Unhealthy | > 55.49 – 125.49 | `#e74c3c` |
| Very Unhealthy | > 125.49 – 225.49 | `#8e44ad` |
| Hazardous | > 225.49 | `#5b0f14` |

## August data

`data/august_2026.csv.gz` has one row per model sensor and hour of August 2026 (UTC), built by
`scripts/build_data.py` from the source repo. Nothing in it is invented.

- **Observed:** `AirQo_August_2026_hourly_matched_partial.csv` has real hourly temperature, humidity and
  PM2.5 for 17 sensors (1–30 August). 9 of them are sensors the model was trained on; those hours are
  marked `input_source = "observed"` and carry `actual_pm25`. The other 8 sensors are unknown to the
  model and are left out.
- **Assumed:** for the other 140 sensors, and for hours where a reading is missing (a reading of 0 is a
  sensor dropout), temperature and humidity are the sensor's mean hour-of-day values from
  January–June 2026, marked `input_source = "assumed profile"`. These are not measurements.
- Coordinates come from the source data; 6 sensors have none and are not shown on the map.
- `data/place_august_means.csv` holds each sensor's mean August prediction (used to colour the map);
  `data/validation_metrics.json` is copied from the notebook's `deployment_metadata.json`.

## Deploy on Render

1. Push this repo to your GitHub account.
2. On Render choose **New > Blueprint** (uses `render.yaml`) or **New > Web Service**.
3. Connect the GitHub repo.
4. Pick the **Free** plan. Build: `pip install -r requirements.txt`. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Health check: `/health`. Env var `PYTHON_VERSION=3.13.7`.
   Optional: add `API_KEY` (and the other names in `.env.example`) under **Environment**.
5. Deploy and copy the public URL; the prediction endpoint is `<public-url>/predict`.
6. Free instances sleep when idle, so open the site a few minutes before presenting.
