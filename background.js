chrome.runtime.onInstalled.addListener(() => {
  console.log('Coupon Finder extension installed');
  
  // Create context menu item
  chrome.contextMenus.create({
    id: 'findCoupons',
    title: 'Find coupon codes for this site',
    contexts: ['page']
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'siteChanged') {
    // Store current site info for easy access
    chrome.storage.local.set({ currentSite: request.siteInfo });
  }
});

// Tab updates are handled by content script automatically

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'findCoupons') {
    // Note: chrome.action.openPopup() doesn't work in service workers
    // User will need to click the extension icon manually
    console.log('Context menu clicked - please click the extension icon');
  }
});