/**
 * Type definitions for Google Analytics gtag API
 */

export type GtagCommand = 'config' | 'event' | 'js' | 'consent';

export interface GtagEventParams {
  [key: string]: unknown;
  event_category?: string;
  event_label?: string;
  value?: number;
}

export interface GtagConfigParams {
  [key: string]: unknown;
  page_title?: string;
  page_location?: string;
  page_path?: string;
  send_page_view?: boolean;
}

export type GtagFunction = (
  command: GtagCommand,
  targetId: string | Date,
  config?: GtagConfigParams | GtagEventParams
) => void;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: GtagFunction;
  }
}

export {};
