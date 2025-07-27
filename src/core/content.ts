// content.js - Inject the interceptor and handle communication

import { GameResult, MinesCustom, ResponseGameData, StoredData } from "@/types";

// interface GameResult {
//   timestamp: number;
//   result: "win" | "loss";
//   amount?: number;
//   gameType?: string;
//   url: string;
// }

// interface StoredData {
//   results: GameResult[];
//   totalGames: number;
//   wins: number;
//   losses: number;
//   winRate: number;
// }

// Flag to track if the extension context is valid
let isExtensionContextValid = true;

// Check if the extension context is valid
function checkExtensionContext(): boolean {
  try {
    // If we can access chrome.runtime without errors, the context is valid
    return !!chrome.runtime && !chrome.runtime.lastError;
  } catch (error) {
    console.warn("Extension context check failed:", error);
    isExtensionContextValid = false;
    return false;
  }
}

// Inject the script that will intercept fetch/XHR
function injectScript() {
  try {
    if (!checkExtensionContext()) return;

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("injected.js");
    script.onload = function () {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    console.log("CONTENT: Injected script successfully");
  } catch (error) {
    console.error("CONTENT: Failed to inject script:", error);
  }
}

// Initialize the content script
function initialize() {
  // Only proceed if the extension context is valid
  if (!checkExtensionContext()) return;

  // Inject the interceptor script
  injectScript();

  // Listen for messages from the injected script
  console.log("CONTENT: Setting up message listener");
  window.addEventListener("message", handleMessage);

  // Listen for messages from the extension (sidepanel)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_WIN_CHANCE") {
      const winChanceElement = document.getElementById(
        "winChance",
      ) as HTMLInputElement;
      if (winChanceElement) {
        const winChanceValue = parseFloat(winChanceElement.value) || 50;
        sendResponse({ winChance: winChanceValue });
      } else {
        sendResponse({ winChance: 50 }); // Default value if element not found
      }
      return true; // Keep the message channel open for async response
    }
  });

  // console.table
  // Set up a periodic check for extension context validity
  setInterval(() => {
    if (!checkExtensionContext() && isExtensionContextValid) {
      console.warn("CONTENT: Extension context has been invalidated");
      isExtensionContextValid = false;
    }
  }, 5000);

  // Monitor winChance input for changes
  const monitorWinChanceInput = () => {
    const winChanceElement = document.getElementById(
      "winChance",
    ) as HTMLInputElement;
    if (winChanceElement) {
      const sendWinChanceUpdate = () => {
        const winChanceValue = parseFloat(winChanceElement.value) || 50;
        chrome.runtime.sendMessage({
          type: "WIN_CHANCE_UPDATE",
          winChance: winChanceValue,
        });
      };

      // Send initial value
      sendWinChanceUpdate();

      // Listen for changes
      winChanceElement.addEventListener("input", sendWinChanceUpdate);
      winChanceElement.addEventListener("change", sendWinChanceUpdate);

      console.log("CONTENT: Monitoring winChance input element");
    } else {
      // Retry after a delay if element not found
      setTimeout(monitorWinChanceInput, 2000);
    }
  };

  // Start monitoring after a short delay to allow page to load
  setTimeout(monitorWinChanceInput, 1000);
}

// Handle messages from the injected script
async function handleMessage(event: MessageEvent) {
  // Ignore messages that aren't from our window or don't have the expected type
  if (event.source !== window || !event.data || !event.data.type) return;

  // Only process CASINO_RESPONSE messages
  if (event.data.type === "CASINO_RESPONSE") {
    console.log("CONTENT: Received message from injected script", event.data);

    // Only process if the extension context is still valid
    if (!checkExtensionContext()) {
      console.warn(
        "CONTENT: Cannot process message, extension context is invalid",
      );
      return;
    }

    try {
      const { data } = event.data;

      // Validate that we have the expected data structure
      if (!data || typeof data !== "object") {
        console.warn("CONTENT: Invalid data structure in message:", data);
        return;
      }

      await processGameResult(data);
    } catch (error) {
      console.error("CONTENT: Error handling message:", error);
    }
  }
}

async function processGameResult({ data }: { data: ResponseGameData }) {
  try {
    console.log(
      "CONTENT: Processing response data:",
      JSON.stringify(data, null, 2),
    );

    const result = parseGameResult(data);
    if (result) {
      await saveGameResult(result);
      console.log("Casino game result saved:", result);
    } else {
      console.warn("Could not parse game result from response data:");
      console.log("Response data structure:", JSON.stringify(data, null, 2));

      // Additional debugging - check what's in the nested data
      if (data) {
        console.log("Nested data structure:", JSON.stringify(data, null, 2));
        console.log("Has roundId:", !!data.roundId);
        console.log("Has win property:", typeof data.win);
        console.log("Win value:", data.profit);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Extension context")) {
      console.warn(
        "Extension context invalidated. Could not save game result.",
      );
      // Optionally, perform cleanup or stop further processing
    } else {
      console.error("Error processing game result:", error);
    }
  }
}

function parseGameResult(data: ResponseGameData): GameResult | null {
  try {
    console.log("PARSE: Starting to parse response data");

    // Check if we have the expected nested structure
    let gameData = data as ResponseGameData;

    // If no nested data, maybe the data is at the top level
    if (!gameData) {
      console.log("PARSE: No nested data found, checking top level");
    }

    console.log(
      "PARSE: Game data to analyze:",
      JSON.stringify(gameData, null, 2),
    );

    // More flexible parsing - check for various indicators of a game result
    const hasRoundId = gameData && gameData.roundId;
    const hasWinIndicator = gameData && typeof gameData.win === "boolean";

    console.log(
      "PARSE: Has round ID:",
      !!hasRoundId,
      "Has win indicator:",
      !!hasWinIndicator,
    );

    if (gameData && hasRoundId && hasWinIndicator) {
      // Determine win/loss from various possible fields
      let result: "win" | "loss";
      if (typeof gameData.win === "boolean") {
        result = gameData.win ? "win" : "loss";
      } else {
        return null;
      }

      // Parse amount from multiple possible sources
      let amount: number | undefined;
      let roundId: number | undefined;
      const custom = gameData.custom;

      roundId = gameData.roundId;
      amount = +gameData.profit;

      // Determine game type from custom fields first, then fallback to URL
      let gameType = "unknown";

      // Check for game-specific custom fields to determine game type
      if (
        "mines" in custom &&
        custom.mines &&
        Array.isArray(custom.mines) &&
        typeof custom.mineCount === "number"
      ) {
        gameType = "mines";
        console.log("PARSE: Detected Mines game from custom fields");
      } else if ("multislots" in custom && Array.isArray(custom.multislots)) {
        gameType = "plinko";
        console.log("PARSE: Detected Plinko game from custom fields");
      } else if ("drawNumbers" in custom && Array.isArray(custom.drawNumbers)) {
        gameType = "keno";
        console.log("PARSE: Detected Keno game from custom fields");
      } else if (
        "slot" in custom &&
        typeof custom.slot === "number" &&
        "multiplier" in custom &&
        typeof custom.multiplier === "number"
      ) {
        gameType = "colorwheel";
        console.log("PARSE: Detected Color Wheel game from custom fields");
      } else if (
        "rounds" in custom &&
        Array.isArray(custom.rounds) &&
        custom.rounds.length > 0 &&
        custom.rounds[0].result &&
        ["HEADS", "TAILS"].includes(custom.rounds[0].result)
      ) {
        gameType = "coinflip";
        console.log("PARSE: Detected Coin Flip game from custom fields");
      } else if (
        "result" in custom &&
        typeof custom.result === "number" &&
        "winningChance" in custom &&
        typeof custom.winningChance === "number"
      ) {
        // Check if it's dice (result should be between 1-100 for dice roll)
        if (custom.result >= 1 && custom.result <= 100) {
          gameType = "dice";
          console.log("PARSE: Detected Dice game from custom fields");
        } else {
          gameType = "limbo";
          console.log("PARSE: Detected Limbo game from custom fields");
        }
      } else if (
        "multiplier" in custom &&
        typeof custom.multiplier === "number" &&
        "winningChance" in custom &&
        typeof custom.winningChance === "number"
      ) {
        gameType = "limbo";
        console.log("PARSE: Detected Limbo game from custom fields");
      } else {
        console.log("PARSE: Used URL-based game type detection:", gameType);
      }

      const multiplier = "multiplier" in custom && custom.multiplier;
      const winningChance = "winningChance" in custom && custom.winningChance;

      console.table({
        result,
        amount,
        gameType,
        roundId,
        multiplier,
        winningChance,
      });

      const parsedResult = {
        timestamp: Date.now(),
        result,
        amount,
        multiplier,
        winningChance,
        gameType,
        url: window.location.href,
      } as GameResult;

      console.log("PARSE: Successfully parsed result:", parsedResult);
      return parsedResult;
    } else {
      console.log("PARSE: Missing required fields - roundId or win indicator");
    }
  } catch (error) {
    console.error("Error parsing game result:", error);
  }

  return null;
}

async function saveGameResult(result: GameResult): Promise<void> {
  // Skip saving if extension context is invalid
  if (!checkExtensionContext()) {
    return Promise.reject(new Error("Extension context is invalid"));
  }

  // Validate the result object
  if (
    !result ||
    typeof result.timestamp !== "number" ||
    !["win", "loss"].includes(result.result)
  ) {
    return Promise.reject(new Error("Invalid game result data"));
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(["casinoResults"], (data) => {
        // Check for Chrome runtime errors
        if (chrome.runtime.lastError) {
          return reject(
            new Error(
              `Chrome storage error: ${chrome.runtime.lastError.message}`,
            ),
          );
        }

        // Check for runtime errors after async operation
        if (!checkExtensionContext()) {
          return reject(
            new Error("Extension context invalidated during storage operation"),
          );
        }

        const stored: StoredData = data.casinoResults || {
          results: [],
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
        };

        stored.results.push(result);
        stored.totalGames++;

        if (result.result === "win") {
          stored.wins++;
        } else {
          stored.losses++;
        }

        stored.winRate =
          stored.totalGames > 0 ? (stored.wins / stored.totalGames) * 100 : 0;

        // Keep only last 1000 results to prevent storage bloat
        if (stored.results.length > 1000) {
          stored.results = stored.results.slice(-1000);
          // Recalculate stats after trimming
          stored.totalGames = stored.results.length;
          stored.wins = stored.results.filter((r) => r.result === "win").length;
          stored.losses = stored.results.filter(
            (r) => r.result === "loss",
          ).length;
          stored.winRate =
            stored.totalGames > 0 ? (stored.wins / stored.totalGames) * 100 : 0;
        }

        chrome.storage.local.set({ casinoResults: stored }, () => {
          // Check for Chrome runtime errors
          if (chrome.runtime.lastError) {
            return reject(
              new Error(
                `Chrome storage save error: ${chrome.runtime.lastError.message}`,
              ),
            );
          }

          // Check for runtime errors after set operation
          if (!checkExtensionContext()) {
            return reject(
              new Error("Extension context invalidated during storage save"),
            );
          }
          resolve();
        });
      });
    } catch (error) {
      console.error("Error in saveGameResult:", error);
      reject(error);
    }
  });
}

// Start the content script
initialize();
