import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { RequestEditor } from "./components/RequestEditor";
import { ResponseViewer } from "./components/ResponseViewer";
import { ENDPOINT_CATEGORIES } from "./data/endpoints";
import {
  EndpointDefinition,
  EnvironmentConfig,
  HistoryItem,
  RequestState,
  ResponseState,
  KeyValuePair,
} from "./types";
import {
  getStoredEnvironment,
  getStoredHistory,
  getStoredToken,
  saveStoredEnvironment,
  saveStoredHistory,
  saveStoredToken,
} from "./utils/storage";
import { generateCurlCommand } from "./utils/curl";

export default function App() {
  const [environment, setEnvironment] =
    useState<EnvironmentConfig>(getStoredEnvironment);
  const [bearerToken, setBearerToken] = useState<string>(getStoredToken);
  const [history, setHistory] = useState<HistoryItem[]>(getStoredHistory);
  const [activeEndpoint, setActiveEndpoint] =
    useState<EndpointDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenNotification, setTokenNotification] = useState<string | null>(
    null,
  );

  // Initialize request state with default endpoint
  const [requestState, setRequestState] = useState<RequestState>(() => {
    const defaultEndpoint =
      ENDPOINT_CATEGORIES[0]?.endpoints[1] ||
      ENDPOINT_CATEGORIES[0]?.endpoints[0];
    return {
      method: defaultEndpoint?.method || "POST",
      url: defaultEndpoint?.path || "/api/v1/auth/login",
      pathParams: {},
      queryParams: [],
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true },
        { key: "Accept", value: "application/json", enabled: true },
      ],
      body: defaultEndpoint?.defaultBody || "",
      authType: defaultEndpoint?.requiresAuth ? "bearer" : "none",
      bearerToken: getStoredToken(),
    };
  });

  const [responseState, setResponseState] = useState<ResponseState | null>(
    null,
  );

  useEffect(() => {
    if (!activeEndpoint && ENDPOINT_CATEGORIES[0]?.endpoints[1]) {
      setActiveEndpoint(ENDPOINT_CATEGORIES[0].endpoints[1]);
    }
  }, [activeEndpoint]);

  const handleSelectEnvironment = (env: EnvironmentConfig) => {
    setEnvironment(env);
    saveStoredEnvironment(env);
  };

  const handleUpdateToken = (token: string) => {
    setBearerToken(token);
    saveStoredToken(token);
    setRequestState((prev) => ({
      ...prev,
      bearerToken: token,
    }));
    setTokenNotification("JWT Bearer token updated successfully");
    setTimeout(() => setTokenNotification(null), 3000);
  };

  const handleSelectEndpoint = (endpoint: EndpointDefinition) => {
    setActiveEndpoint(endpoint);

    // Build headers from endpoint defaults
    const headersList: KeyValuePair[] = [
      { key: "Content-Type", value: "application/json", enabled: true },
      { key: "Accept", value: "application/json", enabled: true },
    ];

    if (endpoint.requiresIdempotency) {
      headersList.push({
        key: "Idempotency-Key",
        value:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "test-idempotency-key",
        enabled: true,
        description: "Enforces single execution for mutating money/orders",
      });
    }

    if (endpoint.defaultHeaders) {
      Object.entries(endpoint.defaultHeaders).forEach(([k, v]) => {
        if (!headersList.some((h) => h.key.toLowerCase() === k.toLowerCase())) {
          headersList.push({ key: k, value: v, enabled: true });
        }
      });
    }

    // Build query params from defaultParams
    const queryParamsList: KeyValuePair[] = [];
    if (endpoint.defaultParams) {
      Object.entries(endpoint.defaultParams).forEach(([k, v]) => {
        queryParamsList.push({ key: k, value: v, enabled: true });
      });
    }

    // Extract path params from :param
    const pathParamsMap: Record<string, string> = {};
    const matches = Array.from(endpoint.path.matchAll(/:([a-zA-Z0-9_]+)/g));
    matches.forEach((m) => {
      pathParamsMap[m[1]] = "";
    });

    setRequestState({
      method: endpoint.method,
      url: endpoint.path,
      pathParams: pathParamsMap,
      queryParams: queryParamsList,
      headers: headersList,
      body: endpoint.defaultBody || "",
      authType: endpoint.requiresAuth ? "bearer" : "none",
      bearerToken: bearerToken,
    });
  };

  const handleUpdateRequest = (updated: Partial<RequestState>) => {
    setRequestState((prev) => ({
      ...prev,
      ...updated,
    }));
  };

  const handleApplyRolePreset = (
    role: "customer" | "organizer" | "admin" | "gate_staff",
  ) => {
    const credentials = {
      customer: { email: "fan@example.com", password: "Password123!" },
      organizer: { email: "organizer@example.com", password: "Password123!" },
      admin: { email: "admin@example.com", password: "Password123!" },
      gate_staff: { email: "gatekeeper@example.com", password: "Password123!" },
    };

    const targetCreds = credentials[role];

    // Find login endpoint
    const loginEndpoint = ENDPOINT_CATEGORIES.flatMap((c) => c.endpoints).find(
      (e) => e.id === "auth-login",
    );
    if (loginEndpoint) {
      handleSelectEndpoint(loginEndpoint);
      setRequestState((prev) => ({
        ...prev,
        body: JSON.stringify(targetCreds, null, 2),
      }));
      setTokenNotification(
        `Preset credentials applied for [${role.toUpperCase()}]. Click "Send Request" to login and capture token.`,
      );
      setTimeout(() => setTokenNotification(null), 4000);
    }
  };

  const handleSendRequest = async () => {
    setIsLoading(true);
    setResponseState(null);

    // Compute final URL by replacing path parameters
    let finalPath = requestState.url;
    for (const [param, val] of Object.entries(requestState.pathParams)) {
      if (val) {
        finalPath = finalPath.replace(`:${param}`, encodeURIComponent(val));
      }
    }

    // Append query params
    const activeParams = requestState.queryParams.filter(
      (p) => p.enabled && p.key,
    );
    if (activeParams.length > 0) {
      const qs = new URLSearchParams();
      activeParams.forEach((p) => qs.append(p.key, p.value));
      finalPath += (finalPath.includes("?") ? "&" : "?") + qs.toString();
    }

    const fullUrl = finalPath.startsWith("http")
      ? finalPath
      : `${environment.baseUrl.replace(/\/+$/, "")}${finalPath}`;

    // Prepare headers
    const reqHeaders: Record<string, string> = {};
    requestState.headers
      .filter((h) => h.enabled && h.key)
      .forEach((h) => {
        reqHeaders[h.key] = h.value;
      });

    // Add authorization header if bearer mode and token provided
    if (
      requestState.authType === "bearer" &&
      (requestState.bearerToken || bearerToken)
    ) {
      const token = requestState.bearerToken || bearerToken;
      const hasAuth = Object.keys(reqHeaders).some(
        (k) => k.toLowerCase() === "authorization",
      );
      if (!hasAuth) {
        reqHeaders["Authorization"] = `Bearer ${token}`;
      }
    }

    const startTime = performance.now();

    try {
      const options: RequestInit = {
        method: requestState.method,
        headers: reqHeaders,
      };

      if (
        requestState.method !== "GET" &&
        requestState.body &&
        requestState.body.trim()
      ) {
        options.body = requestState.body;
      }

      const res = await fetch(fullUrl, options);
      const durationMs = Math.round(performance.now() - startTime);

      // Collect headers
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        resHeaders[k] = v;
      });

      const rawText = await res.text();
      let parsedData: unknown = rawText;
      try {
        parsedData = JSON.parse(rawText);
      } catch {
        // Not JSON
      }

      const resObj: ResponseState = {
        status: res.status,
        statusText: res.statusText || (res.ok ? "OK" : "Error"),
        durationMs,
        sizeBytes: new Blob([rawText]).size,
        headers: resHeaders,
        data: parsedData,
        rawText,
        timestamp: new Date().toLocaleTimeString(),
        isError: !res.ok,
      };

      setResponseState(resObj);

      // Automatic token capture from login or registration response
      if (
        res.ok &&
        parsedData &&
        typeof parsedData === "object" &&
        parsedData !== null
      ) {
        const obj = parsedData as Record<string, unknown>;
        const nestedData =
          obj.data && typeof obj.data === "object"
            ? (obj.data as Record<string, unknown>)
            : null;
        const detectedToken =
          (typeof obj.accessToken === "string" ? obj.accessToken : null) ||
          (typeof obj.token === "string" ? obj.token : null) ||
          (nestedData && typeof nestedData.accessToken === "string"
            ? nestedData.accessToken
            : null) ||
          (nestedData && typeof nestedData.token === "string"
            ? nestedData.token
            : null);

        if (detectedToken) {
          setBearerToken(detectedToken);
          saveStoredToken(detectedToken);
          setRequestState((prev) => ({ ...prev, bearerToken: detectedToken }));
          setTokenNotification(
            "🔑 Success! JWT Access Token auto-captured & activated for all requests.",
          );
          setTimeout(() => setTokenNotification(null), 4000);
        }
      }

      // Add to history
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        method: requestState.method,
        url: finalPath,
        status: res.status,
        durationMs,
        request: { ...requestState },
        response: resObj,
      };

      setHistory((prev) => {
        const updated = [newHistoryItem, ...prev.slice(0, 49)];
        saveStoredHistory(updated);
        return updated;
      });
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Network request failed. Is the API server or CORS enabled?";

      const isLocal =
        environment.baseUrl.includes("localhost") ||
        environment.baseUrl.includes("127.0.0.1");

      const diagnosticDetails = isLocal
        ? `Target ${environment.baseUrl} is unreachable. The local backend API server is not running on port 3000.\n\nQuick Fixes:\n1. Switch Environment in the top bar to 'Live OCI Production (http://129.221.182.252)' to test against the 24/7 cloud cluster.\n2. Or start your local backend with: 'pnpm dev' or 'pnpm --filter @urticketbuddy/api dev'.`
        : `Could not reach ${environment.baseUrl}. Check your internet connection or verify the remote server status.`;

      const resObj: ResponseState = {
        status: 0,
        statusText: isLocal
          ? "Connection Refused (Local API Offline)"
          : "Network / CORS Error",
        durationMs,
        sizeBytes: 0,
        headers: {},
        data: {
          error: {
            code: "NETWORK_ERROR",
            message: errorMsg,
            targetUrl: fullUrl,
            details: diagnosticDetails,
            recommendation: isLocal
              ? "Switch environment in the top header to 'Live OCI Production' (http://129.221.182.252) which is running live 24/7."
              : "Verify remote host connectivity and CORS configuration.",
          },
        },
        rawText: `${errorMsg}\n\n${diagnosticDetails}`,
        timestamp: new Date().toLocaleTimeString(),
        isError: true,
      };

      setResponseState(resObj);

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        method: requestState.method,
        url: finalPath,
        status: 0,
        durationMs,
        request: { ...requestState },
        response: resObj,
      };

      setHistory((prev) => {
        const updated = [newHistoryItem, ...prev.slice(0, 49)];
        saveStoredHistory(updated);
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistoryItem = (item: HistoryItem) => {
    setRequestState({ ...item.request });
    if (item.response) {
      setResponseState(item.response);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    saveStoredHistory([]);
  };

  const handleCopyCurl = () => {
    const cmd = generateCurlCommand(environment.baseUrl, {
      ...requestState,
      bearerToken: requestState.bearerToken || bearerToken,
    });
    navigator.clipboard.writeText(cmd);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header */}
      <Header
        environment={environment}
        onSelectEnvironment={handleSelectEnvironment}
        bearerToken={bearerToken}
        onUpdateToken={handleUpdateToken}
        onCopyCurl={handleCopyCurl}
        onApplyRolePreset={handleApplyRolePreset}
      />

      {/* Dynamic Notification Banner */}
      {tokenNotification && (
        <div className="bg-indigo-600/90 text-white text-xs px-4 py-2 flex items-center justify-between border-b border-indigo-400/30 transition-all animate-fadeIn">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-emerald-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-medium">{tokenNotification}</span>
          </div>
          <button
            onClick={() => setTokenNotification(null)}
            className="text-indigo-200 hover:text-white text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workbench Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          categories={ENDPOINT_CATEGORIES}
          activeEndpointId={activeEndpoint?.id || null}
          onSelectEndpoint={handleSelectEndpoint}
          history={history}
          onSelectHistoryItem={handleSelectHistoryItem}
          onClearHistory={handleClearHistory}
        />

        {/* Center Request Editor & Right/Bottom Response Viewer */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden">
          <RequestEditor
            request={requestState}
            onChange={handleUpdateRequest}
            onSend={handleSendRequest}
            isLoading={isLoading}
            baseUrl={environment.baseUrl}
          />

          <ResponseViewer response={responseState} isLoading={isLoading} />
        </main>
      </div>
    </div>
  );
}
