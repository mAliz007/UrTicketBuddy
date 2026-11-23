import React, { useState } from "react";

interface QRVisualizerProps {
  data: string;
  title?: string;
}

export const QRVisualizer: React.FC<QRVisualizerProps> = ({
  data,
  title = "Dynamic QR Token",
}) => {
  const [copied, setCopied] = useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data)}&margin=10`;

  const handleCopy = () => {
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-900/60 rounded-xl border border-slate-800 text-center max-w-sm mx-auto shadow-xl">
      <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
        {title}
      </div>

      <div className="p-3 bg-white rounded-lg shadow-inner mb-4">
        <img
          src={qrUrl}
          alt="QR Code"
          width={220}
          height={220}
          className="rounded object-contain"
        />
      </div>

      <div className="w-full bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 mb-3 text-left">
        <div className="text-[10px] uppercase font-mono text-slate-500 mb-1">
          Raw Token / Payload
        </div>
        <div className="text-xs font-mono text-slate-300 break-all select-all max-h-20 overflow-y-auto">
          {data}
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-1.5 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium rounded-lg border border-indigo-500/30 transition-colors flex items-center justify-center gap-1.5"
      >
        {copied ? (
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
            <span>Copied to Clipboard!</span>
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
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <span>Copy Token Payload</span>
          </>
        )}
      </button>
    </div>
  );
};
