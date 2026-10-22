"""PM2.5 categories: names, thresholds and colours (single shared definition).

Names and thresholds are the ones in pm25_inference.py; colours are AQI_COLORS
from train.ipynb. The API serves this to the UI through /api/model-info, so the
chart, cards, calendar, map and form all use the same values.
"""
import math

AQI_CATEGORIES = [
    'Good',
    'Moderate',
    'Unhealthy for Sensitive Groups',
    'Unhealthy',
    'Very Unhealthy',
    'Hazardous',
]

AQI_COLORS = {
    'Good': '#2ca25f',
    'Moderate': '#f1c40f',
    'Unhealthy for Sensitive Groups': '#f39c12',
    'Unhealthy': '#e74c3c',
    'Very Unhealthy': '#8e44ad',
    'Hazardous': '#5b0f14',
}

AQI_UPPER_LIMITS = [9, 35.49, 55.49, 125.49, 225.49, math.inf]

# MISSING_COLOR in train.ipynb; used for missing days and invalid values.
MISSING_COLOR = '#d0cfc9'


def pm25_aqi_category(pm25_value):
    """Same thresholds as pm25_inference.py."""
    if pm25_value is None or math.isnan(pm25_value):
        return None

    if pm25_value < 0:
        return 'Invalid'

    if pm25_value <= 9:
        return 'Good'
    elif pm25_value <= 35.49:
        return 'Moderate'
    elif pm25_value <= 55.49:
        return 'Unhealthy for Sensitive Groups'
    elif pm25_value <= 125.49:
        return 'Unhealthy'
    elif pm25_value <= 225.49:
        return 'Very Unhealthy'
    else:
        return 'Hazardous'


def category_color(category):
    return AQI_COLORS.get(category, MISSING_COLOR)


def categories_table():
    """Categories with thresholds and colours, for /api/model-info."""
    table = []
    lower = 0.0
    for name, upper in zip(AQI_CATEGORIES, AQI_UPPER_LIMITS):
        table.append({
            'name': name,
            'lower_ug_m3': lower,
            'upper_ug_m3': None if math.isinf(upper) else upper,
            'color': AQI_COLORS[name],
        })
        lower = upper
    return table
