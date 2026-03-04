/**
 * Google Analytics 4 tracking utilities
 *
 * Safe wrapper around gtag that checks if analytics is enabled
 * before sending events.
 */

import { analyticsConfig } from '../config/analytics.js';
import type { GtagEventParams, GtagConfigParams } from '../types/gtag.js';

/**
 * Safely call gtag if analytics is enabled
 */
function callGtag(command: 'config', targetId: string, config?: GtagConfigParams): void;
function callGtag(command: 'event', eventName: string, params?: GtagEventParams): void;
function callGtag(command: 'js', date: Date): void;
function callGtag(command: string, ...args: unknown[]): void {
  if (!analyticsConfig.isValid || typeof window === 'undefined') {
    return;
  }

  if (typeof window.gtag === 'function') {
    (window.gtag as (...a: unknown[]) => void)(command, ...args);
  }
}

/**
 * Track a page view
 * Call this when the route changes in an SPA
 */
export function trackPageView(path?: string, title?: string, location?: string): void {
  if (!analyticsConfig.isValid) return;

  const pagePath = path ?? window.location.pathname + window.location.hash;
  const pageTitle = title ?? document.title;
  const pageLocation = location ?? window.location.href;

  callGtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: pageLocation,
  });
}

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, params?: GtagEventParams): void {
  if (!analyticsConfig.isValid) return;

  callGtag('event', eventName, params);
}

/**
 * Inject the Google Analytics script into the page if config is valid.
 * Call this once at app startup (e.g. from main.ts) before mounting the app.
 */
export function injectGoogleAnalyticsScript(): void {
  if (!analyticsConfig.isValid || typeof document === 'undefined') return;

  const measurementId = analyticsConfig.measurementId!;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  }
  window.gtag = gtag as typeof window.gtag;
  gtag('js', new Date());
  gtag('config', measurementId, {
    send_page_view: false,
  });
}

/**
 * Initialize analytics (called once on app load).
 * Injects the GA script if enabled; page views are tracked on route changes.
 */
export function initAnalytics(): void {
  if (!analyticsConfig.isValid) {
    return;
  }

  injectGoogleAnalyticsScript();
}
