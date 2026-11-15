import React from "react";

export function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <header className="text-center max-w-xl">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
          UrTicketBuddy
        </h1>
        <p className="text-slate-400 text-lg mb-6">
          High-concurrency event ticketing platform.
        </p>
        <div className="flex justify-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-seat-available"></span>
            <span className="text-sm">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-seat-held"></span>
            <span className="text-sm">Held</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-seat-sold"></span>
            <span className="text-sm">Sold</span>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
