// src/core/background.ts
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id)
    return;
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error("Failed to open side panel:", error);
  }
});
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url)
    return;
  const isTargetSite = tab.url.startsWith("https://bet88.ph/");
  try {
    await chrome.sidePanel.setOptions({
      tabId,
      path: "sidepanel.html",
      enabled: isTargetSite
    });
  } catch (err) {
    console.error(err);
  }
  if (info.status === "complete") {
    chrome.runtime.sendMessage({
      type: "URL_STATUS",
      isTargetSite,
      url: tab.url
    });
  }
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REQUEST_URL_STATUS") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const isTargetSite = tabs[0].url.startsWith("https://bet88.ph/");
        chrome.runtime.sendMessage({
          type: "URL_STATUS",
          isTargetSite,
          url: tabs[0].url
        });
      }
    });
  }
});
