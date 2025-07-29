import { useState, useEffect, useMemo, useCallback } from "react";
import { StoredData } from "./types";
import "./index.css";
import { HyperCard } from "./components/card";
import { windows } from "./components/static";
import { ResultWindow } from "./components/result-window";
import { GameEntry } from "./components/game-entry";
import { StatCard } from "./components/stat-card";

// Interfaces based on your existing `sidepanel.ts`

const SidePanel = () => {
  const [stats, setStats] = useState<StoredData | null>(null);
  const [status, setStatus] = useState({
    connected: false,
    message: "Connecting...",
  });
  
  useEffect(() => {
    // Function to load stats from storage
    const loadStats = () => {
      chrome.storage.local.get(["casinoResults"], (data) => {
        const stored: StoredData = data.casinoResults || {
          results: [],
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
        };
        setStats(stored);
      });
    };

    // Function to get winChance from DOM
    const getWinChanceFromDOM = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id && activeTab.url?.startsWith("https://bet88.ph/")) {
          chrome.tabs.sendMessage(
            activeTab.id,
            { type: "GET_WIN_CHANCE" },
            (response) => {
              // Check for runtime errors
              if (chrome.runtime.lastError) {
                // Silently ignore connection errors - content script may not be ready
                return;
              }
              if (response && typeof response.winChance === "number") {
                console.log(response);
              }
            },
          );
        }
      });
    };

    loadStats();
    getWinChanceFromDOM();

    // Listen for storage changes: Extension
    const storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string,
    ) => {
      if (namespace === "local" && changes.casinoResults) {
        loadStats();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    // Handle messages from the background script for URL status
    const messageListener = (message: any) => {
      if (message.type === "URL_STATUS") {
        if (message.isTargetSite) {
          setStatus({ connected: true, message: "Connected to bet88.ph" });
        } else {
          setStatus({ connected: false, message: "Not on bet88.ph" });
        }
      } else if (message.type === "WIN_CHANCE_UPDATE") {
        if (typeof message.winChance === "number") {
          // Handle win chance update if needed
        }
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);

    // Request status on load
    chrome.runtime.sendMessage({ type: "REQUEST_URL_STATUS" });

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      loadStats();
      // Only try to get win chance from DOM if we're on the target site
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url?.startsWith("https://bet88.ph/")) {
          getWinChanceFromDOM();
        }
      });
    }, 5000);

    // Cleanup
    return () => {
      clearInterval(interval);
      chrome.storage.onChanged.removeListener(storageListener);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const clearData = () => {
    if (confirm("Are you sure you want to clear all data?")) {
      chrome.storage.local.remove(["casinoResults"], () => {
        setStats({
          results: [],
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
        });
      });
    }
  };

  const latest = useMemo(
    () => stats?.results[stats.results.length - 1],
    [stats?.results],
  );

  const winningChance = useMemo(() => latest?.winningChance ?? 0, [latest]); // Default value

  return (
    <div className="bg-[#14141b] text-slate-100 min-w-lg min-h-screen p-4 font-sans">
      <div className="flex items-center justify-start space-x-4 pb-6 rounded-xl">
        <div className="size-16 flex items-center justify-center">
          <img
            alt="0"
            src="icons/icon-128.png"
            className="size-12 aspect-square"
          />
        </div>
        <div className="flex w-full items-center justify-between">
          <div className="w-full">
            <h1 className="text-xl font-medium tracking-tight text-gray-200">
              Watchful Window
            </h1>
            <p
              className={`mt-1 flex items-center space-x-1 font-light tracking-tight ${status.connected ? "text-green-300" : "text-red-300"}`}
            >
              <ConnectIndicator connected={status.connected} />

              <span>{status.message}</span>
            </p>
          </div>
          <div className="flex space-x-16 font-sans">
            <div className="space-y-1 text-right">
              <p className="text-xs text-gray-400 tracking-wide font-light uppercase ">
                Dice
              </p>
              <p
                className={`text-xl font-semibold uppercase  ${latest && latest.result === "win" ? "text-green-300" : "text-red-300"}`}
              >
                {latest?.result}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-xs text-gray-400 tracking-wide font-light uppercase ">
                Amount
              </p>
              <p className="text-xl font-light font-mono text-gray-200">
                {latest?.amount?.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-5">
            <StatCard
              label="Total Games"
              value={stats.totalGames}
              className="text-teal-50"
            />

            <HyperCard>
              <div className="text-xs text-right font-light text-gray-400 uppercase">
                Wins / Losses
              </div>
              <div className="text-lg font-mono flex justify-end">
                <span className="text-teal-50">{stats.wins}</span>
                <span className="px-2 font-light">/</span>
                <span className="text-red-300">{stats.losses}</span>
              </div>
            </HyperCard>
            <StatCard
              label="chance %"
              value={winningChance}
              className="text-teal-50"
            />
            <StatCard
              label="acc win %"
              value={`${stats.winRate.toFixed(2)}`}
              className="text-teal-50"
            />
          </div>
          <div className="mb-5">
            <HyperCard>
              {windows.map((e) => (
                <ResultWindow
                  key={e.count}
                  results={stats.results.slice(-e.count)}
                  windows={e.count}
                  accWin={stats.winRate}
                  winChance={winningChance}
                />
              ))}
            </HyperCard>
          </div>
          <div className="mb-5">
            <HyperCard>
              <div className="h-20 w-fit"></div>
            </HyperCard>
          </div>

          <div className="mb-5">
            <HyperCard>
              <h3 className="tracking-tight text-lg font-medium mb-4 text-slate-300">
                Games Results
              </h3>
              <div className="h-[24.5rem] overflow-y-auto space-y-1">
                {stats.results.length > 0 ? (
                  stats.results
                    .slice(-20)
                    .reverse()
                    .map((game) => (
                      <GameEntry key={game.timestamp} game={game} />
                    ))
                ) : (
                  <div className="text-center text-slate-500 py-10">
                    No games recorded yet.
                  </div>
                )}
              </div>
            </HyperCard>
          </div>
          <div className="mb-2">
            <HyperCard>
              <div className="flex gap-4 justify-end text-gray-800">
                <button
                  onClick={() =>
                    chrome.runtime.sendMessage({ type: "REQUEST_URL_STATUS" })
                  }
                  className="bg-blue-200 h-12 font-medium py-3 px-4 rounded-lg hover:bg-blue-300 transition-all shadow-sm"
                >
                  Refresh
                </button>
                <button
                  onClick={clearData}
                  className="bg-red-400 h-12 w-fit font-medium py-3 px-4 rounded-lg"
                >
                  Clear
                </button>
              </div>
            </HyperCard>
          </div>
        </>
      )}
    </div>
  );
};

interface ConnectProps {
  connected: boolean;
}
const ConnectIndicator = ({ connected }: ConnectProps) => {
  return connected ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      className="size-4"
    >
      <path
        className="fill-win"
        d="M4 6h7v2H4v8h7v2H2V6zm16 0h-7v2h7v8h-7v2h9V6zm-3 5H7v2h10z"
      />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      className="size-4"
    >
      <path
        d="M13 4h-2v16h2zM4 6h5v2H4v8h5v2H2V6zm11 0h7v12h-7v-2h5V8h-5z"
        className="fill-red-300"
      />
    </svg>
  );
};

export default SidePanel;
