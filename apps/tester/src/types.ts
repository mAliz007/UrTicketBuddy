export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface EndpointDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  method: HttpMethod;
  path: string;
  requiresAuth?: boolean;
  requiresIdempotency?: boolean;
  defaultHeaders?: Record<string, string>;
  defaultParams?: Record<string, string>;
  defaultBody?: string;
}

export interface EndpointCategory {
  name: string;
  description: string;
  endpoints: EndpointDefinition[];
}

export interface RequestState {
  method: HttpMethod;
  url: string;
  pathParams: Record<string, string>;
  queryParams: KeyValuePair[];
  headers: KeyValuePair[];
  body: string;
  authType: "none" | "bearer";
  bearerToken: string;
}

export interface ResponseState {
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  data: unknown;
  rawText: string;
  timestamp: string;
  isError: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  method: HttpMethod;
  url: string;
  status?: number;
  durationMs?: number;
  request: RequestState;
  response?: ResponseState;
}

export type EnvironmentType = "local" | "proxy" | "production" | "custom";

export interface EnvironmentConfig {
  type: EnvironmentType;
  name: string;
  baseUrl: string;
  description: string;
}
