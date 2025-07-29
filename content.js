// src/core/content.ts
function isLimboCustom(obj) {
  return typeof obj === "object" && typeof obj.multiplier === "number" && typeof obj.winningChance === "number";
}
function isDiceCustom(obj) {
  return typeof obj === "object" && (obj.option === "OVER" || obj.option === "UNDER") && typeof obj.targetNumber === "number";
}
function isMinesCustom(obj) {
  return typeof obj === "object" && Array.isArray(obj.mines) && obj.mines.every((n) => typeof n === "number") && typeof obj.mineCount === "number";
}
function isPlinkoCustom(obj) {
  return typeof obj === "object" && Array.isArray(obj.multislots) && obj.multislots.every((n) => typeof n === "number") && Array.isArray(obj.multipath) && obj.multipath.every((n) => typeof n === "number") && Array.isArray(obj.multiplierList) && obj.multiplierList.every((n) => typeof n === "number");
}
function isKenoCustom(obj) {
  return typeof obj === "object" && Array.isArray(obj.drawNumbers) && obj.drawNumbers.every((n) => typeof n === "number") && typeof obj.numberOfMatches === "number";
}
function isColorWheelCustom(obj) {
  return typeof obj === "object" && typeof obj.multiplier === "number" && typeof obj.slot === "number";
}
function isCoinFlipCustom(obj) {
  return typeof obj === "object" && Array.isArray(obj.rounds) && obj.rounds.every((round) => typeof round === "object" && (round.targetFace === undefined || round.targetFace === "HEADS" || round.targetFace === "TAILS") && (round.result === "HEADS" || round.result === "TAILS"));
}
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
  } catch (error) {
    console.error("CONTENT: Failed to inject script:", error);
  }
}
function initialize() {
  if (!checkExtensionContext())
    return;
  injectScript();
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
    console.clear();
    console.log("[CONTENT] -| Bet Response Received");
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
      console.log("WARN|Extension context invalidated. Could not save game result.");
    } else {
      console.error("Error processing game result:", error);
    }
  }
}
function parseGameResult(data) {
  try {
    console.log("[CONTENT] Parsing Data");
    let gameData = data;
    if (!gameData) {
      console.log("PARSE: No nested data found, checking top level");
    }
    const hasRoundId = gameData && gameData.roundId;
    const hasWinIndicator = gameData && typeof gameData.win === "boolean";
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
      const winningChance = "winningChance" in custom ? custom.winningChance : undefined;
      let parsedResult = {
        timestamp: Date.now(),
        roundId,
        result,
        amount,
        multiplier,
        gameType,
        url: window.location.href
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
