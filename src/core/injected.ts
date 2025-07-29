// injected.js - Intercepts fetch and XMLHttpRequest calls

(function () {
  "use strict";

  // Store original functions
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  // Keywords that might indicate bet-related requests
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
    "dice",
  ];

  function isGameRelatedURL(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    return gameKeywords.some((keyword) => lowerUrl.includes(keyword));
  }

  function sendToContentScript(data: any): void {
    console.log("[INJECT] Sending Data to Content");
    window.postMessage(
      {
        type: "CASINO_RESPONSE",
        data: data,
      },
      "*",
    );
  }

  // Intercept fetch requests
  (window as any).fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    return originalFetch
      .call(this, input, init)
      .then(async (response: Response) => {
        try {
          // Only process game-related responses
          if (isGameRelatedURL(url)) {
            const clonedResponse = response.clone();
            const contentType = response.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
              try {
                const responseData = await clonedResponse.json();
                sendToContentScript({
                  url: url,
                  method: init?.method || "GET",
                  status: response.status,
                  data: responseData,
                  timestamp: Date.now(),
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

  // Intercept XMLHttpRequest
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    user?: string | null,
    password?: string | null,
  ): void {
    (this as any)._url = url.toString();
    (this as any)._method = method;
    return originalXHROpen.call(
      this,
      method,
      url,
      (async = true),
      user,
      password,
    );
  };

  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    const xhr = this;
    const url: string = (xhr as any)._url;
    const method: string = (xhr as any)._method;

    if (isGameRelatedURL(url)) {
      const originalOnReadyStateChange = xhr.onreadystatechange;

      xhr.onreadystatechange = function (this: XMLHttpRequest, ev: Event): any {
        if (this.readyState === 4) {
          // DONE
          try {
            const contentType = this.getResponseHeader("content-type") || "";

            if (contentType.includes("application/json") && this.responseText) {
              try {
                const responseData = JSON.parse(this.responseText);
                sendToContentScript({
                  url: url,
                  method: method,
                  status: this.status,
                  data: responseData,
                  timestamp: Date.now(),
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

  console.clear();
  console.log("Interceptor Injected");
})();
