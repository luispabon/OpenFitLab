export interface PrivacyInfo {
  email: string | null;
  region: string;
  lastUpdated: string;
  hasAnalytics: boolean;
  analyticsConfig: {
    anonymizeIp: boolean;
    dataRetention: string;
    advertisingFeatures: boolean;
  } | null;
}
