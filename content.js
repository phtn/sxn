// src/core/content.ts
var isExtensionContextValid = true;
function checkExtensionContext() {
  try {
    return !!chrome.runtime && !chrome.runtime.lastError;
  } catch (error) {
    console.warn("Extension context check failed:", error);
    isExtensionContextValid = false;
    return false;
  }
}
function injectScript() {
  try {
    if (!checkExtensionContext())
      return;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("injected.js");
    script.onload = function() {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    console.log("CONTENT: Injected script successfully");
  } catch (error) {
    console.error("CONTENT: Failed to inject script:", error);
  }
}
function initialize() {
  if (!checkExtensionContext())
    return;
  injectScript();
  console.log("CONTENT: Setting up message listener");
  window.addEventListener("message", handleMessage);
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_WIN_CHANCE") {
      const winChanceElement = document.getElementById("winChance");
      if (winChanceElement) {
        const winChanceValue = parseFloat(winChanceElement.value) || 50;
        sendResponse({ winChance: winChanceValue });
      } else {
        sendResponse({ winChance: 50 });
      }
      return true;
    }
  });
  setInterval(() => {
    if (!checkExtensionContext() && isExtensionContextValid) {
      console.warn("CONTENT: Extension context has been invalidated");
      isExtensionContextValid = false;
    }
  }, 5000);
  const monitorWinChanceInput = () => {
    const winChanceElement = document.getElementById("winChance");
    if (winChanceElement) {
      const sendWinChanceUpdate = () => {
        const winChanceValue = parseFloat(winChanceElement.value) || 50;
        chrome.runtime.sendMessage({
          type: "WIN_CHANCE_UPDATE",
          winChance: winChanceValue
        });
      };
      sendWinChanceUpdate();
      winChanceElement.addEventListener("input", sendWinChanceUpdate);
      winChanceElement.addEventListener("change", sendWinChanceUpdate);
      console.log("CONTENT: Monitoring winChance input element");
    } else {
      setTimeout(monitorWinChanceInput, 2000);
    }
  };
  setTimeout(monitorWinChanceInput, 1000);
}
async function handleMessage(event) {
  if (event.source !== window || !event.data || !event.data.type)
    return;
  if (event.data.type === "CASINO_RESPONSE") {
    console.log("CONTENT: Received message from injected script", event.data);
    if (!checkExtensionContext()) {
      console.warn("CONTENT: Cannot process message, extension context is invalid");
      return;
    }
    try {
      const { data } = event.data;
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
async function processGameResult({ data }) {
  try {
    console.log("CONTENT: Processing response data:", JSON.stringify(data, null, 2));
    const result = parseGameResult(data);
    if (result) {
      await saveGameResult(result);
      console.log("Casino game result saved:", result);
    } else {
      console.log("WARN|Could not parse game result from response data:");
      console.log("Response data structure:", JSON.stringify(data, null, 2));
      if (data) {
        console.log("Nested data structure:", JSON.stringify(data, null, 2));
        console.log("Has roundId:", !!data.roundId);
        console.log("Has win property:", typeof data.win);
        console.log("Win value:", data.profit);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Extension context")) {
      console.log("WARN|Extension context invalidated. Could not save game result.");
    } else {
      console.error("Error processing game result:", error);
    }
  }
}
function parseGameResult(data) {
  try {
    console.log("PARSE: Starting to parse response data");
    let gameData = data;
    if (!gameData) {
      console.log("PARSE: No nested data found, checking top level");
    }
    console.log("PARSE: Game data to analyze:", JSON.stringify(gameData, null, 2));
    const hasRoundId = gameData && gameData.roundId;
    const hasWinIndicator = gameData && typeof gameData.win === "boolean";
    console.log("PARSE: Has round ID:", !!hasRoundId, "Has win indicator:", !!hasWinIndicator);
    if (gameData && hasRoundId && hasWinIndicator) {
      let result;
      if (typeof gameData.win === "boolean") {
        result = gameData.win ? "win" : "loss";
      } else {
        return null;
      }
      let amount;
      let roundId;
      const custom = gameData.custom;
      roundId = gameData.roundId;
      amount = +gameData.profit;
      let gameType = "unknown";
      if ("mines" in custom && custom.mines && Array.isArray(custom.mines) && typeof custom.mineCount === "number") {
        gameType = "mines";
        console.log("PARSE: Detected Mines game from custom fields");
      } else if ("multislots" in custom && Array.isArray(custom.multislots)) {
        gameType = "plinko";
        console.log("PARSE: Detected Plinko game from custom fields");
      } else if ("drawNumbers" in custom && Array.isArray(custom.drawNumbers)) {
        gameType = "keno";
        console.log("PARSE: Detected Keno game from custom fields");
      } else if ("slot" in custom && typeof custom.slot === "number" && "multiplier" in custom && typeof custom.multiplier === "number") {
        gameType = "colorwheel";
        console.log("PARSE: Detected Color Wheel game from custom fields");
      } else if ("rounds" in custom && Array.isArray(custom.rounds) && custom.rounds.length > 0 && custom.rounds[0].result && ["HEADS", "TAILS"].includes(custom.rounds[0].result)) {
        gameType = "coinflip";
        console.log("PARSE: Detected Coin Flip game from custom fields");
      } else if ("option" in custom && "targetNumber" in custom && typeof custom.targetNumber === "number") {
        gameType = "dice";
      } else if ("multiplier" in custom && typeof custom.multiplier === "number" && "winningChance" in custom && typeof custom.winningChance === "number") {
        gameType = "limbo";
        console.log("PARSE: Detected Limbo game from custom fields");
      } else {
        console.log("PARSE: Used URL-based game type detection:", gameType);
      }
      const multiplier = "multiplier" in custom ? custom.multiplier : 0;
      const winningChance = "winningChance" in custom ? custom.winningChance : undefined;
      console.table({
        result,
        amount,
        gameType,
        roundId,
        multiplier,
        winningChance
      });
      let parsedResult = {
        timestamp: Date.now(),
        result,
        amount,
        multiplier,
        gameType,
        url: window.location.href
      };
      if (winningChance !== undefined) {
        parsedResult.winningChance = winningChance;
      }
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
async function saveGameResult(result) {
  if (!checkExtensionContext()) {
    return Promise.reject(new Error("Extension context is invalid"));
  }
  if (!result || typeof result.timestamp !== "number" || !["win", "loss"].includes(result.result)) {
    return Promise.reject(new Error("Invalid game result data"));
  }
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(["casinoResults"], (data) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(`Chrome storage error: ${chrome.runtime.lastError.message}`));
        }
        if (!checkExtensionContext()) {
          return reject(new Error("Extension context invalidated during storage operation"));
        }
        const stored = data.casinoResults || {
          results: [],
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0
        };
        stored.results.push(result);
        stored.totalGames++;
        if (result.result === "win") {
          stored.wins++;
        } else {
          stored.losses++;
        }
        stored.winRate = stored.totalGames > 0 ? stored.wins / stored.totalGames * 100 : 0;
        if (stored.results.length > 1000) {
          stored.results = stored.results.slice(-1000);
          stored.totalGames = stored.results.length;
          stored.wins = stored.results.filter((r) => r.result === "win").length;
          stored.losses = stored.results.filter((r) => r.result === "loss").length;
          stored.winRate = stored.totalGames > 0 ? stored.wins / stored.totalGames * 100 : 0;
        }
        chrome.storage.local.set({ casinoResults: stored }, () => {
          if (chrome.runtime.lastError) {
            return reject(new Error(`Chrome storage save error: ${chrome.runtime.lastError.message}`));
          }
          if (!checkExtensionContext()) {
            return reject(new Error("Extension context invalidated during storage save"));
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
initialize();
