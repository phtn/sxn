// content.js - Inject the interceptor and handle communication

import {
  DiceCustom,
  GameResult,
  MinesCustom,
  LimboCustom,
  KenoCustom,
  PlinkoCustom,
  ColorWheelCustom,
  CoinFlipCustom,
  ResponseGameData,
  StoredData,
} from "@/types";

function isLimboCustom(obj: any): obj is LimboCustom {
  return (
    typeof obj === "object" &&
    typeof obj.multiplier === "number" &&
    typeof obj.winningChance === "number"
  );
}

function isDiceCustom(obj: any): obj is DiceCustom {
  return (
    typeof obj === "object" &&
    (obj.option === "OVER" || obj.option === "UNDER") &&
    typeof obj.targetNumber === "number"
  );
}

function isMinesCustom(obj: any): obj is MinesCustom {
  return (
    typeof obj === "object" &&
    Array.isArray(obj.mines) &&
    obj.mines.every((n: any) => typeof n === "number") &&
    typeof obj.mineCount === "number"
  );
}

function isPlinkoCustom(obj: any): obj is PlinkoCustom {
  return (
    typeof obj === "object" &&
    Array.isArray(obj.multislots) &&
    obj.multislots.every((n: any) => typeof n === "number") &&
    Array.isArray(obj.multipath) &&
    obj.multipath.every((n: any) => typeof n === "number") &&
    Array.isArray(obj.multiplierList) &&
    obj.multiplierList.every((n: any) => typeof n === "number")
  );
}

function isKenoCustom(obj: any): obj is KenoCustom {
  return (
    typeof obj === "object" &&
    Array.isArray(obj.drawNumbers) &&
    obj.drawNumbers.every((n: any) => typeof n === "number") &&
    typeof obj.numberOfMatches === "number"
  );
}

function isColorWheelCustom(obj: any): obj is ColorWheelCustom {
  return (
    typeof obj === "object" &&
    typeof obj.multiplier === "number" &&
    typeof obj.slot === "number"
  );
}

function isCoinFlipCustom(obj: any): obj is CoinFlipCustom {
  return (
    typeof obj === "object" &&
    Array.isArray(obj.rounds) &&
    obj.rounds.every(
      (round: any) =>
        typeof round === "object" &&
        (round.targetFace === undefined ||
          round.targetFace === "HEADS" ||
          round.targetFace === "TAILS") &&
        (round.result === "HEADS" || round.result === "TAILS"),
    )
  );
}
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
    console.clear();
    console.log("[CONTENT] -| Bet Response Received");

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
        console.log("WARN|CONTENT: Invalid data structure in message:", data);
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
    const result = parseGameResult(data);
    if (result) {
      await saveGameResult(result);
      console.log("[CONTENT] Game Result Saved");
    } else {
      console.log("[CONTENT] Couldn't Parse Game Result");
      if (data) {
        console.log("[CONTENT] With Data");
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Extension context")) {
      console.log(
        "WARN|Extension context invalidated. Could not save game result.",
      );
      // Optionally, perform cleanup or stop further processing
    } else {
      console.error("Error processing game result:", error);
    }
  }
}

function parseGameResult(data: ResponseGameData): GameResult | null {
  try {
    console.log("[CONTENT] Parsing Data");

    // Check if we have the expected nested structure
    let gameData = data as ResponseGameData;

    // If no nested data, maybe the data is at the top level
    if (!gameData) {
      console.log("PARSE: No nested data found, checking top level");
    }

    // More flexible parsing - check for various indicators of a game result
    const hasRoundId = gameData && gameData.roundId;
    const hasWinIndicator = gameData && typeof gameData.win === "boolean";

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

      if (isMinesCustom(custom)) {
        gameType = "mines";
      } else if (isPlinkoCustom(custom)) {
        gameType = "plinko";
      } else if (isKenoCustom(custom)) {
        gameType = "keno";
      } else if (isColorWheelCustom(custom)) {
        gameType = "colorwheel";
      } else if (isCoinFlipCustom(custom)) {
        gameType = "coinflip";
      } else if (isDiceCustom(custom)) {
        gameType = "dice";
      } else if (isLimboCustom(custom)) {
        gameType = "limbo";
      } else {
        gameType = "dice";
      }

      const multiplier = "multiplier" in custom ? custom.multiplier : 0;
      const winningChance =
        "winningChance" in custom ? custom.winningChance : undefined;

      let parsedResult: GameResult = {
        timestamp: Date.now(),
        roundId,
        result,
        amount,
        multiplier,
        gameType,
        url: window.location.href,
      };

      if (winningChance !== undefined) {
        parsedResult.winningChance = winningChance;
      }

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
