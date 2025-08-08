function getCurrentDomain() {
  const hostname = window.location.hostname;
  const domain = hostname.replace('www.', '');
  return domain;
}

function getCompanyName() {
  const domain = getCurrentDomain();
  const parts = domain.split('.');
  const mainDomain = parts[0];
  
  const companyName = mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
  return companyName;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentSite') {
    const siteInfo = {
      domain: getCurrentDomain(),
      companyName: getCompanyName(),
      url: window.location.href,
      title: document.title
    };
    sendResponse(siteInfo);
  }
});

// Send site info to background script with error handling
try {
  chrome.runtime.sendMessage({
    action: 'siteChanged',
    siteInfo: {
      domain: getCurrentDomain(),
      companyName: getCompanyName(),
      url: window.location.href,
      title: document.title
    }
  });
} catch (error) {
  console.log('Background script not ready:', error);
}