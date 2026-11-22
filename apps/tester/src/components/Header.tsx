import React, { useState, useEffect } from "react";
import { EnvironmentConfig } from "../types";
import { DEFAULT_ENVIRONMENTS } from "../utils/storage";

interface HeaderProps {
  environment: EnvironmentConfig;
  onSelectEnvironment: (env: EnvironmentConfig) => void;
  bearerToken: string;
  onUpdateToken: (token: string) => void;
  onCopyCurl: () => void;
  onApplyRolePreset: (
    role: "customer" | "organizer" | "admin" | "gate_staff",
  ) => void;
}

export const Header: React.FC<HeaderProps> = ({
  environment,
  onSelectEnvironment,
  bearerToken,
  onUpdateToken,
  onCopyCurl,
  onApplyRolePreset,
}) => {
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState(bearerToken);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [connStatus, setConnStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  useEffect(() => {
    let active = true;
    setConnStatus("checking");
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(
          `${environment.baseUrl.replace(/\/+$/, "")}/api/v1/health`,
          {
            method: "GET",
            signal: controller.signal,
          },
        );
        clearTimeout(timer);
        if (active) {
          setConnStatus(res.ok ? "online" : "offline");
        }
      } catch {
        if (active) setConnStatus("offline");
      }
    };
    checkHealth();
    return () => {
      active = false;
    };
  }, [environment.baseUrl]);

  const handleSaveToken = () => {
    onUpdateToken(tokenInput.trim());
    setShowTokenModal(false);
  };

  const handleTriggerCopyCurl = () => {
    onCopyCurl();
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">
              UrTicketBuddy
            </span>
            <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
              API Workbench
            </span>
            <span className="text-[10px] font-mono text-slate-400">UTB-22</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-none">
            Interactive Microservice & Ingress Endpoint Tester
          </p>
        </div>
      </div>

      {/* Center Actions: Environment Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
          <span className="text-slate-400 pl-2 text-[11px] font-medium">
            Environment:
          </span>
          <select
            value={environment.baseUrl}
            onChange={(e) => {
              const selected = DEFAULT_ENVIRONMENTS.find(
                (env) => env.baseUrl === e.target.value,
              );
              if (selected) {
                onSelectEnvironment(selected);
              } else {
                onSelectEnvironment({
                  type: "custom",
                  name: "Custom Base URL",
                  baseUrl: e.target.value,
                  description: "User configured target endpoint",
                });
              }
            }}
            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {DEFAULT_ENVIRONMENTS.map((env) => (
              <option key={env.baseUrl} value={env.baseUrl}>
                {env.name} ({env.baseUrl})
              </option>
            ))}
          </select>
          {connStatus === "online" && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Online
            </span>
          )}
          {connStatus === "offline" && (
            <span
              onClick={() => {
                const prod = DEFAULT_ENVIRONMENTS.find(
                  (e) => e.type === "production",
                );
                if (prod) onSelectEnvironment(prod);
              }}
              className="flex items-center gap-1 text-[10px] text-amber-400 font-medium px-2 py-0.5 bg-amber-500/10 rounded border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-colors"
              title="Target server unreachable. Click to switch to Live OCI Production."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Offline{" "}
              {environment.baseUrl.includes("localhost")
                ? "(Switch to Live)"
                : ""}
            </span>
          )}
          {connStatus === "checking" && (
            <span className="text-[10px] text-slate-500 px-1.5">
              Checking...
            </span>
          )}
        </div>

        {/* Role Presets Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700/80 transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>Auth Presets</span>
            <svg
              className="w-3 h-3 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showRoleDropdown && (
            <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 text-xs">
              <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-800">
                Quick Login Presets
              </div>
              <button
                onClick={() => {
                  onApplyRolePreset("customer");
                  setShowRoleDropdown(false);
                }}
                className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-slate-800 flex items-center justify-between"
              >
                <span>Customer User</span>
                <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-400">
                  fan@...
                </span>
              </button>
              <button
                onClick={() => {
                  onApplyRolePreset("organizer");
                  setShowRoleDropdown(false);
                }}
                className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-slate-800 flex items-center justify-between"
              >
                <span>Event Organizer</span>
                <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-400">
                  host@...
                </span>
              </button>
              <button
                onClick={() => {
                  onApplyRolePreset("admin");
                  setShowRoleDropdown(false);
                }}
                className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-slate-800 flex items-center justify-between"
              >
                <span>Platform Admin</span>
                <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-400">
                  admin@...
                </span>
              </button>
              <button
                onClick={() => {
                  onApplyRolePreset("gate_staff");
                  setShowRoleDropdown(false);
                }}
                className="w-full text-left px-3 py-1.5 text-slate-300 hover:bg-slate-800 flex items-center justify-between"
              >
                <span>Gate Scanner Staff</span>
                <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-400">
                  gate@...
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Token Pill & cURL Copy */}
      <div className="flex items-center gap-2">
        {/* Token status button */}
        <button
          onClick={() => {
            setTokenInput(bearerToken);
            setShowTokenModal(true);
          }}
          className={`px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1.5 transition-colors ${
            bearerToken
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
              : "bg-slate-800 text-slate-400 border-slate-700/80 hover:bg-slate-700"
          }`}
        >
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
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
          <span>{bearerToken ? "Token Attached" : "Attach Token"}</span>
        </button>

        {/* Copy as cURL */}
        <button
          onClick={handleTriggerCopyCurl}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700/80 transition-colors flex items-center gap-1.5"
          title="Copy full command as cURL"
        >
          {copiedCurl ? (
            <>
              <svg
                className="w-3.5 h-3.5 text-emerald-400"
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
              <span className="text-emerald-400">Copied!</span>
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
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              <span>cURL</span>
            </>
          )}
        </button>
      </div>

      {/* Bearer Token Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-indigo-400">🔑</span> Active Bearer Token
              </h3>
              <button
                onClick={() => setShowTokenModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              This token is automatically sent in the{" "}
              <code className="text-indigo-300">Authorization: Bearer ...</code>{" "}
              header for authenticated requests. It auto-updates when you
              execute a successful Login or Register request!
            </p>
            <textarea
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste JWT accessToken here (eyJhbGciOi...)"
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 mb-4"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => setTokenInput("")}
                className="text-xs text-rose-400 hover:underline"
              >
                Clear Token
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTokenModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveToken}
                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow"
                >
                  Save Active Token
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
