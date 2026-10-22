import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import MapIcon from '@mui/icons-material/Map';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { Place } from '../../types';

interface SensorMapProps {
  places: Place[];
  selectedPlace: Place | null;
  onSelectPlace: (place: Place) => void;
}

export const SensorMap: React.FC<SensorMapProps> = ({
  places,
  selectedPlace,
  onSelectPlace,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.CircleMarker }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        scrollWheelZoom: false,
      }).setView([0.3476, 32.5825], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markers = markersRef.current;

    // Clear existing markers
    Object.values(markers).forEach((m) => m.remove());
    markersRef.current = {};

    const located = places.filter((p) => p.latitude != null && p.longitude != null);

    located.forEach((place) => {
      const isSelected = selectedPlace?.device_name === place.device_name;
      const marker = L.circleMarker([place.latitude!, place.longitude!], {
        radius: isSelected ? 10 : 7,
        color: isSelected ? '#111827' : '#475569',
        weight: isSelected ? 3 : 1.2,
        fillColor: place.color,
        fillOpacity: 0.9,
      }).addTo(map);

      marker.bindTooltip(
        `<strong>${place.name}</strong><br/>${place.august_mean_predicted_pm25_ug_m3} ug/m3 (${place.august_mean_aqi_category})`,
        { direction: 'top', offset: [0, -6] }
      );

      marker.on('click', () => {
        onSelectPlace(place);
      });

      markers[place.device_name] = marker;
    });

    if (located.length > 0 && !selectedPlace) {
      const group = L.latLngBounds(located.map((p) => [p.latitude!, p.longitude!]));
      map.fitBounds(group.pad(0.08));
    }
  }, [places]);

  // Highlight selected marker and center view smoothly
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedPlace) return;

    const markers = markersRef.current;
    Object.entries(markers).forEach(([deviceName, marker]) => {
      const isSelected = deviceName === selectedPlace.device_name;
      marker.setStyle({
        radius: isSelected ? 11 : 7,
        color: isSelected ? '#0F172A' : '#475569',
        weight: isSelected ? 3.5 : 1.2,
      });
      if (isSelected) {
        marker.bringToFront();
      }
    });

    if (selectedPlace.latitude != null && selectedPlace.longitude != null) {
      mapInstanceRef.current.panTo([selectedPlace.latitude, selectedPlace.longitude], {
        animate: true,
        duration: 0.6,
      });
    }
  }, [selectedPlace]);

  const handleResetView = () => {
    if (!mapInstanceRef.current) return;
    const located = places.filter((p) => p.latitude != null && p.longitude != null);
    if (located.length > 0) {
      const group = L.latLngBounds(located.map((p) => [p.latitude!, p.longitude!]));
      mapInstanceRef.current.fitBounds(group.pad(0.08));
    }
  };

  return (
    <div className="card map-card">
      <div className="map-card-header">
        <div className="map-header-title">
          <MapIcon sx={{ fontSize: 20, color: '#BE123C' }} />
          <span>Interactive Uganda Sensor Network</span>
        </div>
        <button className="reset-view-btn" onClick={handleResetView} title="Reset Map View">
          <MyLocationIcon sx={{ fontSize: 16 }} />
          <span>Fit All Sensors</span>
        </button>
      </div>

      <div className="map-container-wrapper" ref={mapContainerRef} style={{ height: '420px', width: '100%' }} />

      <div className="map-legend-bar">
        <span className="legend-label">Air Quality Index Status:</span>
        <div className="legend-chips">
          <span className="legend-chip"><i style={{ backgroundColor: '#16A34A' }}></i>Good</span>
          <span className="legend-chip"><i style={{ backgroundColor: '#D97706' }}></i>Moderate</span>
          <span className="legend-chip"><i style={{ backgroundColor: '#EA580C' }}></i>Sensitive</span>
          <span className="legend-chip"><i style={{ backgroundColor: '#DC2626' }}></i>Unhealthy</span>
          <span className="legend-chip"><i style={{ backgroundColor: '#9333EA' }}></i>Very Unhealthy</span>
          <span className="legend-chip"><i style={{ backgroundColor: '#7F1D1D' }}></i>Hazardous</span>
        </div>
      </div>
    </div>
  );
};
