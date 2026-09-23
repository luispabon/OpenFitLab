import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { mount } from 'svelte';
import './app.css';
import { initAnalytics } from './lib/analytics/gtag.js';
import App from './App.svelte';

// Register the MapLibre worker URL before any map component mounts.
setWorkerUrl(workerUrl);

initAnalytics();

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
