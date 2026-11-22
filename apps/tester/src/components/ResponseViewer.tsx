import React, { useState } from "react";
import { ResponseState } from "../types";
import { QRVisualizer } from "./QRVisualizer";

interface ResponseViewerProps {
  response: ResponseState | null;
  isLoading: boolean;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  response,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<"body" | "qr" | "headers" | "raw">(
    "body",
  );
  const [copied, setCopied] = useState(false);

  // Check if response contains dynamic QR payload
  let detectedQrData: string | null = null;
  if (response && response.data) {
    if (typeof response.data === "object" && response.data !== null) {
      const d = response.data as Record<string, unknown>;
      if (typeof d.qrPayload === "string") detectedQrData = d.qrPayload;
      else if (typeof d.qrToken === "string") detectedQrData = d.qrToken;
      else if (typeof d.token === "string" && d.window) {
        detectedQrData = d.token;
      }
    }
  }

  const handleCopyBody = () => {
    if (!response) return;
    const text =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300)
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (status >= 300 && status < 400)
      return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
    if (status >= 400 && status < 500)
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-rose-400 bg-rose-500/10 border-rose-500/30";
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
        <svg
          className="animate-spin w-8 h-8 text-indigo-500 mb-3"
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
        <p className="text-xs text-slate-400 font-medium">
          Executing HTTP Request...
        </p>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950 select-none">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-3">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <h4 className="text-sm font-semibold text-slate-300 mb-1">
          Response Inspector
        </h4>
        <p className="text-xs text-slate-500 max-w-xs">
          Select an endpoint from the catalog on the left and click Send to
          inspect live status, headers, and payload.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950">
      {/* Response Status Bar */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getStatusColor(response.status)}`}
          >
            {response.status} {response.statusText}
          </span>
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
            <span className="text-slate-600">⏱</span> {response.durationMs} ms
          </span>
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
            <span className="text-slate-600">📦</span>{" "}
            {formatBytes(response.sizeBytes)}
          </span>
        </div>

        <button
          onClick={handleCopyBody}
          className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/80 transition-colors flex items-center gap-1"
        >
          {copied ? (
            <>
              <span className="text-emerald-400">✓</span>
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Copy Response</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center px-3 bg-slate-900/20 gap-1 text-xs">
        <button
          onClick={() => setActiveTab("body")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === "body"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Pretty Body
        </button>
        {detectedQrData && (
          <button
            onClick={() => setActiveTab("qr")}
            className={`py-2 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "qr"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-emerald-400/80 hover:text-emerald-300"
            }`}
          >
            <span>📱</span>
            <span>QR Code Preview</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab("headers")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === "headers"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Headers ({Object.keys(response.headers).length})
        </button>
        <button
          onClick={() => setActiveTab("raw")}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === "raw"
              ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Raw
        </button>
      </div>

      {/* Response Content Panels */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "body" && (
          <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap break-all leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            {typeof response.data === "object"
              ? JSON.stringify(response.data, null, 2)
              : response.rawText}
          </pre>
        )}

        {activeTab === "qr" && detectedQrData && (
          <div className="py-4">
            <QRVisualizer
              data={detectedQrData}
              title="Time-Decaying Dynamic HMAC QR Code"
            />
          </div>
        )}

        {activeTab === "headers" && (
          <div className="border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-2.5 w-1/3">Header</th>
                  <th className="p-2.5">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Object.entries(response.headers).map(([k, v]) => (
                  <tr key={k} className="hover:bg-slate-900/40">
                    <td className="p-2 text-indigo-300 font-semibold">{k}</td>
                    <td className="p-2 text-slate-300 break-all">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "raw" && (
          <pre className="font-mono text-xs text-slate-400 whitespace-pre-wrap break-all leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            {response.rawText}
          </pre>
        )}
      </div>
    </div>
  );
};
