import { mount } from 'svelte';
import './app.css';
import { initAnalytics } from './lib/analytics/gtag.js';
import App from './App.svelte';

initAnalytics();

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
