# AirQo PM2.5 Clean Air Monitor

A modern React and TypeScript web application for exploring air quality observations and machine learning forecasts across 149 AirQo sensor nodes in Uganda.

Deployed on Vercel at [https://airqo-model.vercel.app/](https://airqo-model.vercel.app/).

The application connects to the remote prediction model service hosted at [https://airqo-cole-charis-assgnmnt.onrender.com](https://airqo-cole-charis-assgnmnt.onrender.com) ([source repository](https://github.com/coleRodneyMigisha/airqo_cole_charis_assgnmnt)).

## Features

- **Public Health First**: Prominent PM2.5 exposure readouts with official AirQo and World Health Organization (WHO) categorical ratings (Good, Moderate, Unhealthy for Sensitive Groups, Unhealthy, Very Unhealthy, Hazardous) paired with actionable citizen health recommendations.
- **Interactive Sensor Map**: Leaflet map displaying 149 sensors across Kampala and regional Uganda with color-coded air quality markers.
- **Sensor Roster & Search**: Real neighborhood place names (such as Kyarwabuganda, Bugolobi, and Kyebando) with search and status filtering.
- **August 2026 Pollution Trends**: Recharts time series comparing model predictions against ground truth sensor observations, with shaded AQI severity bands and error evaluation (MAE and RMSE).
- **Daily Calendar Matrix**: 31-day August calendar grid showing daily mean PM2.5 levels and overall category distribution.
- **Interactive Weather Simulator**: Adjust ambient temperature and humidity sliders to simulate how changing weather patterns alter particulate pollution in real time.
- **Model Transparency**: Scientific documentation of the scikit-learn Support Vector Regressor (SVR) pipeline, hold-out validation metrics (MAE 9.34 ug/m3, RMSE 15.14 ug/m3, R2 0.338), cyclic UTC feature transformations, and API documentation.

## Dual Backend Communication

The frontend supports two connectivity methods:
1. **Method A (Vercel Edge Rewrite Proxy)**: Configured in `vercel.json` to route `/api/*` requests to the remote Render service server-side, eliminating browser cross-origin friction.
2. **Method B (Direct Cross-Origin Connection)**: Configured via `VITE_API_BASE_URL` with automatic client-side fallback.

## Local Development

Ensure Node.js (v18+) is installed:

```bash
npm install
npm run dev
```

Open `http://localhost:5173` to view the application.

## Production Build

```bash
npm run build
```

The output bundle is generated in `dist/` and is ready for static deployment on Vercel.
