import React, { useState, useEffect, useCallback } from 'react';
import { Header, TabType } from './components/layout/Header';
import { SensorCard } from './components/explorer/SensorCard';
import { SensorMap } from './components/explorer/SensorMap';
import { SensorRoster } from './components/explorer/SensorRoster';
import { TrendChart } from './components/trends/TrendChart';
import { CalendarView } from './components/calendar/CalendarView';
import { WeatherSimulator } from './components/simulator/WeatherSimulator';
import { ModelInfoDrawer } from './components/about/ModelInfoDrawer';
import { Place, DailyRecord, HourlyRecord, ModelInfo } from './types';
import {
  checkBackendHealth,
  fetchPlaces,
  fetchModelInfo,
  fetchDailyData,
  fetchHourlyData,
  BackendHealthResponse,
} from './api/client';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('explorer');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const [dailyDataMap, setDailyDataMap] = useState<Record<string, DailyRecord[]>>({});
  const [hourlyData, setHourlyData] = useState<HourlyRecord[]>([]);
  const [loadingHourly, setLoadingHourly] = useState<boolean>(false);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  const [health, setHealth] = useState<BackendHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  // Sync state with URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as TabType;
    if (tabParam && ['explorer', 'trends', 'simulator', 'about'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  const updateUrl = useCallback((placeName?: string, tab?: TabType) => {
    const params = new URLSearchParams(window.location.search);
    if (placeName) params.set('place', placeName);
    if (tab) params.set('tab', tab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    updateUrl(selectedPlace?.name, tab);
  };

  const handleSelectPlace = (place: Place) => {
    setSelectedPlace(place);
    updateUrl(place.name, activeTab);
  };

  // Poll or check model backend health
  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const h = await checkBackendHealth();
      setHealth(h);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setHealthError(err.message);
      } else {
        setHealthError('Model service unreachable');
      }
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    async function loadInitial() {
      try {
        const [loadedPlaces, loadedModelInfo, loadedDaily] = await Promise.all([
          fetchPlaces(),
          fetchModelInfo(),
          fetchDailyData(),
        ]);

        setPlaces(loadedPlaces);
        setModelInfo(loadedModelInfo);
        setDailyDataMap(loadedDaily);

        // Check if place is specified in URL
        const params = new URLSearchParams(window.location.search);
        const urlPlace = params.get('place');
        let initial: Place | undefined;
        if (urlPlace) {
          initial = loadedPlaces.find(
            (p) =>
              p.name.toLowerCase() === urlPlace.toLowerCase() ||
              p.device_name.toLowerCase() === urlPlace.toLowerCase()
          );
        }

        if (!initial) {
          // Default to first sensor with actual readings
          initial = loadedPlaces.find((p) => p.has_august_actuals) || loadedPlaces[0];
        }

        setSelectedPlace(initial || null);
      } catch (err) {
        console.error('Failed to load initial application data:', err);
      } finally {
        setInitialLoading(false);
      }
    }

    loadInitial();
    checkHealth();
  }, [checkHealth]);

  // Load hourly dataset when selectedPlace changes
  useEffect(() => {
    if (!selectedPlace) return;

    let isMounted = true;
    setLoadingHourly(true);

    fetchHourlyData(selectedPlace.device_name)
      .then((records) => {
        if (isMounted) {
          setHourlyData(records);
        }
      })
      .catch((err) => {
        console.error(`Error loading hourly records for ${selectedPlace.device_name}:`, err);
      })
      .finally(() => {
        if (isMounted) {
          setLoadingHourly(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPlace]);

  if (initialLoading) {
    return (
      <div className="initial-loading-screen" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A' }}>
          AirQo PM2.5 Clean Air Monitor
        </h2>
        <p style={{ color: '#64748B', marginTop: '8px' }}>
          Loading sensor data and air quality observations...
        </p>
      </div>
    );
  }

  const currentDailyRecords = selectedPlace ? dailyDataMap[selectedPlace.device_name] || [] : [];

  return (
    <div>
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        health={health}
        healthLoading={healthLoading}
        healthError={healthError}
        onRetryHealth={checkHealth}
      />

      <main className="app-wrapper">
        {selectedPlace && (
          <SensorCard place={selectedPlace} />
        )}

        {/* Tab 1: Sensor Explorer */}
        {activeTab === 'explorer' && selectedPlace && (
          <section className="tab-section">
            <div className="explorer-grid">
              <SensorMap
                places={places}
                selectedPlace={selectedPlace}
                onSelectPlace={handleSelectPlace}
              />
              <SensorRoster
                places={places}
                selectedPlace={selectedPlace}
                onSelectPlace={handleSelectPlace}
              />
            </div>
          </section>
        )}

        {/* Tab 2: Trends and Calendar */}
        {activeTab === 'trends' && selectedPlace && (
          <section className="tab-section">
            <TrendChart
              place={selectedPlace}
              hourlyData={hourlyData}
              dailyData={currentDailyRecords}
              loadingHourly={loadingHourly}
            />

            <CalendarView
              place={selectedPlace}
              dailyRecords={currentDailyRecords}
            />
          </section>
        )}

        {/* Tab 3: Weather Simulator */}
        {activeTab === 'simulator' && selectedPlace && (
          <section className="tab-section">
            <WeatherSimulator
              places={places}
              selectedPlace={selectedPlace}
            />
          </section>
        )}

        {/* Tab 4: About & Science */}
        {activeTab === 'about' && (
          <section className="tab-section">
            <ModelInfoDrawer modelInfo={modelInfo} />
          </section>
        )}
      </main>
    </div>
  );
};
