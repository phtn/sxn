// src/core/injected.ts
(function() {
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const gameKeywords = [
    "bet",
    "spin",
    "game",
    "play",
    "result",
    "outcome",
    "win",
    "lose",
    "jackpot",
    "bonus",
    "round",
    "turn",
    "deal",
    "draw",
    "coinflip",
    "limbo",
    "dice"
  ];
  function isGameRelatedURL(url) {
    const lowerUrl = url.toLowerCase();
    return gameKeywords.some((keyword) => lowerUrl.includes(keyword));
  }
  function sendToContentScript(data) {
    console.log("INJECTED: Sending data to content script", data);
    window.postMessage({
      type: "CASINO_RESPONSE",
      data
    }, "*");
  }
  window.fetch = async function(input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return originalFetch.call(this, input, init).then(async (response) => {
      try {
        if (isGameRelatedURL(url)) {
          const clonedResponse = response.clone();
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            try {
              const responseData = await clonedResponse.json();
              sendToContentScript({
                url,
                method: init?.method || "GET",
                status: response.status,
                data: responseData,
                timestamp: Date.now()
              });
            } catch (jsonError) {
              console.log("Failed to parse JSON response:", jsonError);
            }
          }
        }
      } catch (error) {
        console.error("Error intercepting fetch response:", error);
      }
      return response;
    });
  };
  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    this._url = url.toString();
    this._method = method;
    return originalXHROpen.call(this, method, url, async = true, user, password);
  };
  XMLHttpRequest.prototype.send = function(body) {
    const xhr = this;
    const url = xhr._url;
    const method = xhr._method;
    if (isGameRelatedURL(url)) {
      const originalOnReadyStateChange = xhr.onreadystatechange;
      xhr.onreadystatechange = function(ev) {
        if (this.readyState === 4) {
          try {
            const contentType = this.getResponseHeader("content-type") || "";
            if (contentType.includes("application/json") && this.responseText) {
              try {
                const responseData = JSON.parse(this.responseText);
                sendToContentScript({
                  url,
                  method,
                  status: this.status,
                  data: responseData,
                  timestamp: Date.now()
                });
              } catch (jsonError) {
                console.log("Failed to parse XHR JSON response:", jsonError);
              }
            }
          } catch (error) {
            console.error("Error intercepting XHR response:", error);
          }
        }
        if (originalOnReadyStateChange) {
          return originalOnReadyStateChange.call(this, ev);
        }
      };
    }
    return originalXHRSend.call(this, body);
  };
  console.log("Casino game interceptor injected successfully");
})();
