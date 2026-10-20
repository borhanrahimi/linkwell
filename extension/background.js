// The Linkwell toolbar button. Clicking it (or pressing Alt+Shift+S) opens
// Linkwell's /share page in a new tab, next to the page you're saving.
// Saving itself happens on /share, like the bookmarklet and the iPhone Shortcut.

// Change this to "http://localhost:3000" to try the extension with `npm run dev`.
const LINKWELL = "https://linkwell-dypu.vercel.app";

chrome.action.onClicked.addListener((tab) => {
  // Browser pages like chrome://settings can't be saved.
  if (!tab.url || !/^https?:/.test(tab.url)) return;

  const params = new URLSearchParams({ url: tab.url, title: tab.title ?? "" });
  chrome.tabs.create({ url: `${LINKWELL}/share?${params}`, index: tab.index + 1 });
});
