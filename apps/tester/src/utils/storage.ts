import { EnvironmentConfig, HistoryItem } from "../types";

const STORAGE_KEYS = {
  TOKEN: "utb_tester_token",
  ENV: "utb_tester_env",
  CUSTOM_URL: "utb_tester_custom_url",
  HISTORY: "utb_tester_history",
};

export const DEFAULT_ENVIRONMENTS: EnvironmentConfig[] = [
  {
    type: "production",
    name: "Live OCI Production",
    baseUrl: "http://129.221.182.252",
    description:
      "Live production cluster deployed on Oracle Cloud Always Free VM",
  },
  {
    type: "local",
    name: "Local API Direct",
    baseUrl: "http://localhost:3000",
    description: "Connects directly to NestJS core API on port 3000",
  },
  {
    type: "proxy",
    name: "Local Edge Proxy",
    baseUrl: "http://localhost:80",
    description: "Routes through local Nginx reverse proxy on port 80",
  },
];

export function getStoredToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.TOKEN) || "";
  } catch {
    return "";
  }
}

export function saveStoredToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
    }
  } catch {}
}

export function getStoredEnvironment(): EnvironmentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ENV);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return DEFAULT_ENVIRONMENTS[0];
}

export function saveStoredEnvironment(env: EnvironmentConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ENV, JSON.stringify(env));
  } catch {}
}

export function getStoredHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

export function saveStoredHistory(history: HistoryItem[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.HISTORY,
      JSON.stringify(history.slice(0, 50)),
    );
  } catch {}
}
