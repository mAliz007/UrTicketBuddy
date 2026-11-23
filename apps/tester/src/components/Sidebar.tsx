import React, { useState } from "react";
import {
  EndpointDefinition,
  EndpointCategory,
  HistoryItem,
  HttpMethod,
} from "../types";

interface SidebarProps {
  categories: EndpointCategory[];
  activeEndpointId: string | null;
  onSelectEndpoint: (endpoint: EndpointDefinition) => void;
  history: HistoryItem[];
  onSelectHistoryItem: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  POST: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
  PUT: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  PATCH: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  DELETE: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

export const Sidebar: React.FC<SidebarProps> = ({
  categories,
  activeEndpointId,
  onSelectEndpoint,
  history,
  onSelectHistoryItem,
  onClearHistory,
}) => {
  const [activeTab, setActiveTab] = useState<"collections" | "history">(
    "collections",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});

  const toggleCategory = (catName: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      endpoints: cat.endpoints.filter((ep) => {
        const q = searchTerm.toLowerCase();
        return (
          ep.name.toLowerCase().includes(q) ||
          ep.path.toLowerCase().includes(q) ||
          ep.method.toLowerCase().includes(q) ||
          ep.description.toLowerCase().includes(q)
        );
      }),
    }))
    .filter((cat) => cat.endpoints.length > 0);

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col h-[calc(100vh-3.5rem)] select-none">
      {/* Tabs: Collections vs History */}
      <div className="flex border-b border-slate-800 p-1.5 gap-1 bg-slate-950/40">
        <button
          onClick={() => setActiveTab("collections")}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "collections"
              ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span>Endpoints</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === "history"
              ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>History</span>
          {history.length > 0 && (
            <span className="text-[10px] bg-slate-800 px-1 rounded-full text-slate-300">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* Search Input */}
      {activeTab === "collections" && (
        <div className="p-2.5 border-b border-slate-800/60">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter endpoints (e.g. login, seats, qr)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {activeTab === "collections" ? (
          filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No matching endpoints found
            </div>
          ) : (
            filteredCategories.map((category) => {
              const isCollapsed = !!collapsedCategories[category.name];
              return (
                <div key={category.name} className="space-y-1">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.name)}
                    className="w-full flex items-center justify-between text-left px-2 py-1 text-slate-400 hover:text-slate-200 rounded text-xs font-semibold uppercase tracking-wider transition-colors"
                  >
                    <span className="truncate">{category.name}</span>
                    <span className="text-slate-600 text-[10px]">
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                  </button>

                  {/* Endpoints List */}
                  {!isCollapsed && (
                    <div className="space-y-0.5 pl-1">
                      {category.endpoints.map((ep) => {
                        const isSelected = activeEndpointId === ep.id;
                        return (
                          <button
                            key={ep.id}
                            onClick={() => onSelectEndpoint(ep)}
                            className={`w-full text-left p-1.5 rounded-lg text-xs flex items-center gap-2 transition-all ${
                              isSelected
                                ? "bg-indigo-600/20 text-white font-medium border border-indigo-500/40 shadow-sm"
                                : "text-slate-300 hover:bg-slate-800/60 border border-transparent"
                            }`}
                          >
                            <span
                              className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded border ${
                                METHOD_COLORS[ep.method]
                              }`}
                            >
                              {ep.method}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="truncate text-[11px]">
                                {ep.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                {ep.path}
                              </div>
                            </div>
                            {ep.requiresAuth && (
                              <span
                                className="text-[10px] text-amber-400/80"
                                title="Requires Authentication"
                              >
                                🔒
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          /* History View */
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] uppercase font-semibold text-slate-500">
                Recent Requests
              </span>
              {history.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="text-[10px] text-rose-400 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No recent requests yet. Hit Send to start testing!
              </div>
            ) : (
              <div className="space-y-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectHistoryItem(item)}
                    className="w-full text-left p-2 rounded-lg text-xs bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/80 transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[9px] font-mono font-bold px-1 rounded border ${
                          METHOD_COLORS[item.method]
                        }`}
                      >
                        {item.method}
                      </span>
                      {item.status && (
                        <span
                          className={`text-[10px] font-mono px-1 rounded ${
                            item.status >= 200 && item.status < 300
                              ? "text-emerald-400 bg-emerald-500/10"
                              : "text-rose-400 bg-rose-500/10"
                          }`}
                        >
                          {item.status} ({item.durationMs}ms)
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-slate-300 truncate">
                      {item.url}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
