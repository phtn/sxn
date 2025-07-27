// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  if (!tab.id) return;

  try {
    // Open the side panel for the current tab
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error("Failed to open side panel:", error);
  }
});

// Enable side panel and notify it of the URL
chrome.tabs.onUpdated.addListener(
  async (
    tabId: number,
    info: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ) => {
    if (!tab.url) return;

    const isTargetSite = tab.url.startsWith("https://bet88.ph/");

    // Enable the side panel on the target site
    try {
      await chrome.sidePanel.setOptions({
        tabId,
        path: "sidepanel.html",
        enabled: isTargetSite,
      });
    } catch (err) {
      console.error(err);
    }

    // Send a message to the side panel script
    if (info.status === "complete") {
      chrome.runtime.sendMessage({
        type: "URL_STATUS",
        isTargetSite: isTargetSite,
        url: tab.url,
      });
    }
  },
);

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle the request for URL status from the side panel
  if (message.type === "REQUEST_URL_STATUS") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const isTargetSite = tabs[0].url.startsWith("https://bet88.ph/");
        chrome.runtime.sendMessage({
          type: "URL_STATUS",
          isTargetSite: isTargetSite,
          url: tabs[0].url,
        });
      }
    });
  }
});
