import React, { useState } from "react";
import { HttpMethod, KeyValuePair, RequestState } from "../types";

interface RequestEditorProps {
  request: RequestState;
  onChange: (updated: Partial<RequestState>) => void;
  onSend: () => void;
  isLoading: boolean;
  baseUrl: string;
}

export const RequestEditor: React.FC<RequestEditorProps> = ({
  request,
  onChange,
  onSend,
  isLoading,
  baseUrl,
}) => {
  const [activeTab, setActiveTab] = useState<
    "params" | "headers" | "body" | "auth"
  >("body");
  const [jsonFormatError, setJsonFormatError] = useState<string | null>(null);

  // Auto-detect path parameters like :id or :eventId
  const pathParamMatches = Array.from(
    request.url.matchAll(/:([a-zA-Z0-9_]+)/g),
  ).map((m) => m[1]);

  const handleUpdatePathParam = (param: string, value: string) => {
    onChange({
      pathParams: {
        ...request.pathParams,
        [param]: value,
      },
    });
  };

  const handleAddHeader = () => {
    onChange({
      headers: [...request.headers, { key: "", value: "", enabled: true }],
    });
  };

  const handleUpdateHeader = (
    index: number,
    updated: Partial<KeyValuePair>,
  ) => {
    const next = [...request.headers];
    next[index] = { ...next[index], ...updated };
    onChange({ headers: next });
  };

  const handleRemoveHeader = (index: number) => {
    onChange({
      headers: request.headers.filter((_, i) => i !== index),
    });
  };

  const handleAddIdempotencyKey = () => {
    const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );

    const existingIndex = request.headers.findIndex(
      (h) => h.key.toLowerCase() === "idempotency-key",
    );

    if (existingIndex >= 0) {
      handleUpdateHeader(existingIndex, { value: uuid, enabled: true });
    } else {
      onChange({
        headers: [
          ...request.headers,
          { key: "Idempotency-Key", value: uuid, enabled: true },
        ],
      });
    }
  };

  const handleAddQueryParam = () => {
    onChange({
      queryParams: [
        ...request.queryParams,
        { key: "", value: "", enabled: true },
      ],
    });
  };

  const handleUpdateQueryParam = (
    index: number,
    updated: Partial<KeyValuePair>,
  ) => {
    const next = [...request.queryParams];
    next[index] = { ...next[index], ...updated };
    onChange({ queryParams: next });
  };

  const handleRemoveQueryParam = (index: number) => {
    onChange({
      queryParams: request.queryParams.filter((_, i) => i !== index),
    });
  };

  const handlePrettifyBody = () => {
    try {
      if (!request.body.trim()) return;
      const parsed = JSON.parse(request.body);
      onChange({ body: JSON.stringify(parsed, null, 2) });
      setJsonFormatError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid JSON syntax";
      setJsonFormatError(msg);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800">
      {/* Top Request Bar: Method + URL + Send */}
      <div className="p-3 border-b border-slate-800 flex items-center gap-2">
        <select
          value={request.method}
          onChange={(e) => onChange({ method: e.target.value as HttpMethod })}
          className={`font-mono font-bold text-xs rounded-lg px-3 py-2 border bg-slate-900 focus:outline-none cursor-pointer ${
            request.method === "GET"
              ? "text-emerald-400 border-emerald-500/40"
              : request.method === "POST"
                ? "text-indigo-400 border-indigo-500/40"
                : request.method === "PUT"
                  ? "text-amber-400 border-amber-500/40"
                  : request.method === "PATCH"
                    ? "text-purple-400 border-purple-500/40"
                    : "text-rose-400 border-rose-500/40"
          }`}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>

        {/* URL Input with prefix */}
        <div className="flex-1 flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden focus-within:border-indigo-500">
          <span className="text-[11px] font-mono text-slate-500 bg-slate-950/60 px-2.5 py-2 border-r border-slate-800 select-none truncate max-w-[180px]">
            {baseUrl.replace(/\/+$/, "")}
          </span>
          <input
            type="text"
            value={request.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="/api/v1/health"
            className="flex-1 bg-transparent px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none placeholder-slate-600"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                onSend();
              }
            }}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={onSend}
          disabled={isLoading}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Sending...</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
              <span>Send</span>
              <span className="text-[10px] opacity-60 hidden sm:inline font-mono">
                ⌘↵
              </span>
            </>
          )}
        </button>
      </div>

      {/* Path Parameters Pill Bar (if detected in URL) */}
      {pathParamMatches.length > 0 && (
        <div className="bg-slate-900/40 border-b border-slate-800/80 px-3 py-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase font-semibold text-indigo-400">
            Path Variables:
          </span>
          {pathParamMatches.map((param) => (
            <div
              key={param}
              className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs"
            >
              <span className="font-mono text-[11px] text-indigo-300">
                :{param}
              </span>
              <span className="text-slate-600">=</span>
              <input
                type="text"
                value={request.pathParams[param] || ""}
                onChange={(e) => handleUpdatePathParam(param, e.target.value)}
                placeholder="value..."
                className="bg-transparent text-[11px] font-mono text-slate-200 focus:outline-none w-28"
              />
            </div>
          ))}
        </div>
      )}

      {/* Editor Tabs */}
      <div className="border-b border-slate-800 flex items-center px-3 bg-slate-900/30 gap-1 text-xs">
        <button
          onClick={() => setActiveTab("body")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === "body"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Body {request.body ? "•" : ""}
        </button>
        <button
          onClick={() => setActiveTab("headers")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === "headers"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Headers ({request.headers.filter((h) => h.enabled).length})
        </button>
        <button
          onClick={() => setActiveTab("params")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === "params"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Params ({request.queryParams.filter((p) => p.enabled).length})
        </button>
        <button
          onClick={() => setActiveTab("auth")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === "auth"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Auth {request.authType === "bearer" ? "•" : ""}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* BODY TAB */}
        {activeTab === "body" && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-slate-400">
                JSON Payload
              </span>
              <div className="flex items-center gap-2">
                {jsonFormatError && (
                  <span className="text-[10px] text-rose-400">
                    {jsonFormatError}
                  </span>
                )}
                <button
                  onClick={handlePrettifyBody}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded transition-colors"
                >
                  Prettify JSON
                </button>
              </div>
            </div>
            <textarea
              value={request.body}
              onChange={(e) => {
                onChange({ body: e.target.value });
                setJsonFormatError(null);
              }}
              placeholder='{\n  "key": "value"\n}'
              className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
            />
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === "headers" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                Request Headers
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddIdempotencyKey}
                  className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs rounded transition-colors flex items-center gap-1"
                >
                  <span>⚡ Add Idempotency-Key UUID</span>
                </button>
                <button
                  onClick={handleAddHeader}
                  className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs rounded transition-colors"
                >
                  + Add Header
                </button>
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-2 w-8 text-center">Use</th>
                    <th className="p-2 w-1/3">Header Key</th>
                    <th className="p-2">Header Value</th>
                    <th className="p-2 w-8 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {request.headers.map((h, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) =>
                            handleUpdateHeader(i, { enabled: e.target.checked })
                          }
                          className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={h.key}
                          onChange={(e) =>
                            handleUpdateHeader(i, { key: e.target.value })
                          }
                          placeholder="Header-Name"
                          className="w-full bg-transparent p-1 text-slate-200 focus:outline-none"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={h.value}
                          onChange={(e) =>
                            handleUpdateHeader(i, { value: e.target.value })
                          }
                          placeholder="value..."
                          className="w-full bg-transparent p-1 text-slate-300 focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleRemoveHeader(i)}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {request.headers.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-4 text-center text-slate-500 text-xs"
                      >
                        No custom headers set
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PARAMS TAB */}
        {activeTab === "params" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">
                Query Parameters
              </span>
              <button
                onClick={handleAddQueryParam}
                className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs rounded transition-colors"
              >
                + Add Parameter
              </button>
            </div>

            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-2 w-8 text-center">Use</th>
                    <th className="p-2 w-1/3">Key</th>
                    <th className="p-2">Value</th>
                    <th className="p-2 w-8 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {request.queryParams.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) =>
                            handleUpdateQueryParam(i, {
                              enabled: e.target.checked,
                            })
                          }
                          className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={p.key}
                          onChange={(e) =>
                            handleUpdateQueryParam(i, { key: e.target.value })
                          }
                          placeholder="page"
                          className="w-full bg-transparent p-1 text-slate-200 focus:outline-none"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={p.value}
                          onChange={(e) =>
                            handleUpdateQueryParam(i, { value: e.target.value })
                          }
                          placeholder="1"
                          className="w-full bg-transparent p-1 text-slate-300 focus:outline-none"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleRemoveQueryParam(i)}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {request.queryParams.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-4 text-center text-slate-500 text-xs"
                      >
                        No query parameters configured
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUTH TAB */}
        {activeTab === "auth" && (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Authorization Type
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="authType"
                    checked={request.authType === "none"}
                    onChange={() => onChange({ authType: "none" })}
                    className="text-indigo-600 focus:ring-0"
                  />
                  <span>No Auth</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="authType"
                    checked={request.authType === "bearer"}
                    onChange={() => onChange({ authType: "bearer" })}
                    className="text-indigo-600 focus:ring-0"
                  />
                  <span>Bearer Token</span>
                </label>
              </div>
            </div>

            {request.authType === "bearer" && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Bearer Token
                </label>
                <textarea
                  value={request.bearerToken}
                  onChange={(e) => onChange({ bearerToken: e.target.value })}
                  placeholder="Paste JWT accessToken..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Tip: Successful login/register requests auto-update this token
                  for you!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
