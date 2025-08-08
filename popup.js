document.addEventListener('DOMContentLoaded', async function() {
  const siteNameEl = document.getElementById('siteName');
  const siteDomainEl = document.getElementById('siteDomain');
  const apiKeyEl = document.getElementById('apiKey');
  const searchBtn = document.getElementById('searchBtn');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const modelSelect = document.getElementById('modelSelect');
  const loadingEl = document.getElementById('loading');
  const resultsEl = document.getElementById('results');
  const errorEl = document.getElementById('error');
  const copyNoticeEl = document.getElementById('copyNotice');
  
  let currentSiteInfo = null;
  
  // Get current site info with simplified approach
  async function getSiteInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Manual parsing as primary method (most reliable)
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        const url = new URL(tab.url);
        const domain = url.hostname.replace('www.', '');
        const companyName = domain.split('.')[0];
        const capitalizedName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
        
        currentSiteInfo = {
          domain: domain,
          companyName: capitalizedName,
          url: tab.url,
          title: tab.title || domain
        };
        
        siteNameEl.textContent = capitalizedName;
        siteDomainEl.textContent = domain;
        return;
      }
      
      // Fallback for special pages
      siteNameEl.textContent = 'Unable to detect';
      siteDomainEl.textContent = 'Please navigate to a website';
      
    } catch (error) {
      console.error('Error getting site info:', error);
      siteNameEl.textContent = 'Error';
      siteDomainEl.textContent = 'Please refresh and try again';
    }
  }
  
  // Initialize site info
  getSiteInfo();
  
  // Simple encryption key derived from extension ID
  const getEncryptionKey = () => {
    return chrome.runtime.id + 'coupon-finder-2024';
  };
  
  // Simple XOR encryption for API key
  const encryptApiKey = (key) => {
    const encKey = getEncryptionKey();
    let result = '';
    for (let i = 0; i < key.length; i++) {
      result += String.fromCharCode(key.charCodeAt(i) ^ encKey.charCodeAt(i % encKey.length));
    }
    return btoa(result);
  };
  
  const decryptApiKey = (encrypted) => {
    try {
      const encKey = getEncryptionKey();
      const decoded = atob(encrypted);
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ encKey.charCodeAt(i % encKey.length));
      }
      return result;
    } catch (e) {
      return '';
    }
  };
  
  // Load saved API key and model selection
  chrome.storage.local.get(['encryptedApiKey', 'selectedModel'], function(result) {
    console.log('🔐 Loading saved API key...', result.encryptedApiKey ? 'Found encrypted key' : 'No saved key');
    if (result.encryptedApiKey) {
      const decrypted = decryptApiKey(result.encryptedApiKey);
      if (decrypted && decrypted.length > 10) {
        apiKeyEl.value = decrypted;
        console.log('✅ API key loaded successfully');
      } else {
        console.log('❌ Failed to decrypt API key');
      }
    }
    
    // Load selected model
    if (result.selectedModel) {
      modelSelect.value = result.selectedModel;
      console.log('📡 Loaded saved model:', result.selectedModel);
    } else {
      // Default to best model with search capabilities
      modelSelect.value = 'gemini-1.5-flash';
      console.log('📡 Using default model: gemini-1.5-flash (Fast & Reliable)');
    }
  });
  
  // Save API key on input (encrypted)
  apiKeyEl.addEventListener('input', function() {
    const apiKey = apiKeyEl.value.trim();
    if (apiKey && apiKey.length > 10) {
      const encrypted = encryptApiKey(apiKey);
      chrome.storage.local.set({ encryptedApiKey: encrypted }, () => {
        console.log('💾 API key saved and encrypted successfully');
      });
    } else if (apiKey.length === 0) {
      chrome.storage.local.remove(['encryptedApiKey'], () => {
        console.log('🗑️ API key removed from storage');
      });
    }
  });
  
  // Save model selection on change
  modelSelect.addEventListener('change', function() {
    const selectedModel = modelSelect.value;
    chrome.storage.local.set({ selectedModel: selectedModel }, () => {
      console.log('📡 Model selection saved:', selectedModel);
    });
  });
  
  // Search button click handler
  searchBtn.addEventListener('click', async function() {
    const apiKey = apiKeyEl.value.trim();
    
    if (!apiKey) {
      showError('Please enter your Google Gemini API key');
      return;
    }
    
    if (!currentSiteInfo) {
      showError('Unable to detect current website');
      return;
    }
    
    // Check cache first
    const cacheKey = `coupons_${currentSiteInfo.domain}`;
    chrome.storage.local.get([cacheKey], function(result) {
      if (result[cacheKey]) {
        const cached = result[cacheKey];
        const cacheAge = Date.now() - cached.timestamp;
        const cacheExpiry = 30 * 60 * 1000; // 30 minutes
        
        if (cacheAge < cacheExpiry) {
          console.log('📦 Using cached results for', currentSiteInfo.domain);
          console.log('Cache age:', Math.round(cacheAge / 60000), 'minutes');
          displayResults(cached.coupons);
          
          // Show cache info in loading area
          loadingEl.innerHTML = `
            <div style="text-align: center; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 8px;">
              <div style="color: #4CAF50; font-weight: 600;">📦 Cached Results</div>
              <div style="font-size: 12px; opacity: 0.8; margin-top: 5px;">
                Found ${cached.coupons.length} codes (${Math.round(cacheAge / 60000)} min ago)
              </div>
            </div>
          `;
          loadingEl.style.display = 'block';
          return;
        } else {
          console.log('🗑️ Cache expired, searching again...');
        }
      }
      
      // No cache or expired, do fresh search
      performSearch(apiKey);
    });
  });
  
  // Clear cache button click handler
  clearCacheBtn.addEventListener('click', function() {
    console.log('🗑️ Clearing all cached coupon results...');
    
    // Disable button temporarily
    clearCacheBtn.disabled = true;
    clearCacheBtn.textContent = '🔄 Clearing...';
    
    // Clear only coupon cache data, keep API key
    chrome.storage.local.get(null, (items) => {
      const keysToRemove = [];
      for (let key in items) {
        if (key.startsWith('coupons_')) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, () => {
          console.log('✅ Coupon cache cleared successfully!', keysToRemove);
        });
      } else {
        console.log('✅ No coupon cache to clear');
      }
      
      // Show success feedback
      clearCacheBtn.style.background = '#4CAF50';
      clearCacheBtn.textContent = '✅ Cache Cleared!';
      
      // Reset button after 2 seconds
      setTimeout(() => {
        clearCacheBtn.disabled = false;
        clearCacheBtn.style.background = '#ff6b6b';
        clearCacheBtn.textContent = '🗑️ Clear Cache';
      }, 2000);
      
      // Clear any displayed results
      resultsEl.style.display = 'none';
      loadingEl.style.display = 'none';
      hideError();
      
      console.log('💡 Next search will fetch fresh results from coupon sites');
    });
  });
  
  async function performSearch(apiKey) {
    showLoading(true);
    hideError();
    
    // Update loading message to show what we're searching for
    loadingEl.innerHTML = `
      <div class="loading-spinner"></div>
      <div>Running targeted search queries...</div>
      <div style="font-size: 11px; opacity: 0.8; margin-top: 5px;">
        "${currentSiteInfo.companyName} coupon codes"
      </div>
      <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">
        Checking: Wethrift, Coupert, DealDrop, SimplyCodes, RetailMeNot
      </div>
    `;
    
    try {
      const coupons = await searchForCoupons(apiKey, currentSiteInfo);
      const filteredCoupons = filterValidCoupons(coupons);
      
      // Cache the results
      const cacheKey = `coupons_${currentSiteInfo.domain}`;
      const cacheData = {
        coupons: filteredCoupons,
        timestamp: Date.now(),
        domain: currentSiteInfo.domain,
        companyName: currentSiteInfo.companyName
      };
      chrome.storage.local.set({ [cacheKey]: cacheData });
      console.log('💾 Cached results for', currentSiteInfo.domain);
      
      displayResults(filteredCoupons);
    } catch (error) {
      showError('Failed to search for coupons: ' + error.message);
    } finally {
      showLoading(false);
    }
  }
  
  function filterValidCoupons(coupons) {
    console.log('🔍 Filtering coupons - received:', coupons);
    
    if (!coupons || !Array.isArray(coupons)) {
      console.log('❌ No valid coupon array received');
      return [];
    }
    
    const filtered = coupons.filter((coupon, index) => {
      console.log(`🔍 Checking coupon ${index}:`, coupon);
      
      // Filter out null, undefined, or invalid coupons
      if (!coupon || typeof coupon !== 'object') {
        console.log(`❌ Filtered out coupon ${index}: Invalid object`);
        return false;
      }
      
      // Must have BOTH code and description
      if (!coupon.code || !coupon.description) {
        console.log(`❌ Filtered out coupon ${index}: Missing code or description`);
        return false;
      }
      
      // Filter out null or placeholder codes
      if (coupon.code === null || coupon.code === 'null') {
        console.log(`❌ Filtered out coupon ${index}: Null code`);
        return false;
      }
      
      // Filter out obvious invalid codes
      const invalidCodes = ['NULL', 'NONE', 'N/A', 'NO_CODES_FOUND', '', 'undefined', 'null', 'NO CODE NEEDED'];
      if (invalidCodes.includes(coupon.code.toUpperCase())) {
        console.log(`❌ Filtered out coupon ${index}: Invalid code name`);
        return false;
      }
      
      // Filter out very short codes (likely invalid)
      if (coupon.code.trim().length < 3) {
        console.log(`❌ Filtered out coupon ${index}: Code too short`);
        return false;
      }
      
      console.log(`✅ Coupon ${index} passed all filters:`, coupon);
      return true;
    });
    
    console.log(`🎯 Filtering result: ${filtered.length}/${coupons.length} coupons passed`);
    return filtered;
  }
  
  function showLoading(show) {
    console.log('showLoading called with:', show);
    loadingEl.style.display = show ? 'block' : 'none';
    searchBtn.disabled = show;
    if (show) {
      resultsEl.style.display = 'none';
    }
    console.log('Loading element display:', loadingEl.style.display);
    console.log('Results element display after showLoading:', resultsEl.style.display);
  }
  
  function showError(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  
  function hideError() {
    errorEl.style.display = 'none';
  }
  
  function displayResults(coupons) {
    console.log('displayResults called with:', coupons);
    console.log('resultsEl:', resultsEl);
    
    resultsEl.innerHTML = '';
    
    if (!coupons || coupons.length === 0) {
      console.log('No coupons to display');
      resultsEl.innerHTML = '<div class="coupon-item">No active coupon codes found for this website.</div>';
    } else {
      console.log(`Displaying ${coupons.length} coupons`);
      coupons.forEach((coupon, index) => {
        console.log(`Creating coupon ${index}:`, coupon);
        
        const couponEl = document.createElement('div');
        couponEl.className = 'coupon-item';
        
        const codeEl = document.createElement('div');
        codeEl.className = 'coupon-code';
        codeEl.textContent = coupon.code;
        codeEl.addEventListener('click', () => copyToClipboard(coupon.code));
        
        const descEl = document.createElement('div');
        descEl.className = 'coupon-description';
        descEl.textContent = coupon.description;
        
        couponEl.appendChild(codeEl);
        couponEl.appendChild(descEl);
        resultsEl.appendChild(couponEl);
        
        console.log(`Added coupon element ${index} to results`);
      });
    }
    
    resultsEl.style.display = 'block';
    console.log('Results element display set to block');
    console.log('Results element computed style:', window.getComputedStyle(resultsEl).display);
    console.log('Results element visibility:', window.getComputedStyle(resultsEl).visibility);
    console.log('Results element height:', window.getComputedStyle(resultsEl).height);
    console.log('Final innerHTML:', resultsEl.innerHTML);
    
    // Force a more aggressive display style - completely override everything
    resultsEl.removeAttribute('style');
    resultsEl.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; height: auto !important; overflow: visible !important;';
    
    // Also make sure loading is hidden
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    
    console.log('After aggressive styling - Results display:', resultsEl.style.display);
    console.log('After aggressive styling - Loading display:', loadingEl.style.display);
  }
  
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      copyNoticeEl.style.display = 'block';
      setTimeout(() => {
        copyNoticeEl.style.display = 'none';
      }, 2000);
    });
  }
  
  async function searchForCoupons(apiKey, siteInfo) {
    const selectedModel = modelSelect.value;
    console.log('🔍 Starting specific search queries for coupon codes...');
    console.log('📡 Using model:', selectedModel);
    console.log('Search target:', `${siteInfo.companyName} (${siteInfo.domain})`);
    console.log('Search queries:', [
      `"${siteInfo.companyName} coupon codes ${siteInfo.domain}"`,
      `"site:wethrift.com ${siteInfo.companyName} coupon codes"`,
      `"site:coupert.com ${siteInfo.companyName} coupon codes"`
    ]);
    console.log('Expected codes like:', 'BOGOWINGS, SAVE20, FREESHIP, etc.');
    
    const prompt = `You are searching for CURRENT ACTIVE COUPON CODES specifically for ${siteInfo.companyName} (${siteInfo.domain}). 

CRITICAL: Only return codes that are specifically for ${siteInfo.companyName}. Do NOT return codes for competitors like Domino's, Papa John's, or other pizza chains if this is Pizza Hut.

Search the internet using these queries:
1. "${siteInfo.companyName} coupon codes ${siteInfo.domain}"
2. "${siteInfo.companyName} promo codes 2024 2025"
3. "site:${siteInfo.domain} promo code coupon"
4. "site:wethrift.com ${siteInfo.companyName} coupon codes"
5. "site:retailmenot.com ${siteInfo.companyName} promo codes"
6. "site:coupert.com ${siteInfo.companyName} coupon codes"
7. "site:dontpayfull.com ${siteInfo.companyName} promo codes"
8. "${siteInfo.companyName} discount codes today"
9. "${siteInfo.companyName} 20% off 15% off 10% off promo codes"

Look for ANY TYPE of promo codes that customers can enter at checkout, including:

For Pizza Hut: BOGOWINGS, PIZZAHUT20, PHUT15, newsletter codes
For Regal Movies: Long numeric codes like 866864219510272, REGAL15, movie deals  
For Kohl's: SHOP20, GOSHOP20, CATCH15OFF, GET10, OME10, GET20, ARD30, RED30
For retail stores: SAVE15, FREESHIP, WELCOME20, percentage off codes, dollar off codes

INCLUDE ALL THESE CODE TYPES:
- Word codes: BOGOWINGS, SAVE15, FREESHIP, WELCOME  
- Number codes: 866864219510272, 12345, 987654321
- Mixed codes: REGAL20, TARGET15, PIZZA30
- Long numeric codes (especially for movie theaters, retail)
- Short letter codes
- Brand-specific codes from company websites

VALIDATION RULES:
1. Code MUST be specifically for ${siteInfo.companyName}
2. Code can be letters, numbers, or mixed - ANY format is valid
3. Description should be relevant to ${siteInfo.companyName}
4. Include both common word codes AND numeric codes

INCLUDE EXAMPLES:
✅ "BOGOWINGS" - Pizza Hut wings deal
✅ "866864219510272" - Regal movie discount  
✅ "SAVE20" - 20% off order
✅ "12345" - Numeric promotional code

Return JSON array with only ${siteInfo.companyName}-specific codes:`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        tools: [
          {
            googleSearchRetrieval: {}
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
          topP: 0.8,
          topK: 10
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.error?.message || 'API request failed';
      
      // Provide more helpful error messages for Gemini API
      if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('invalid API key')) {
        throw new Error('Invalid Gemini API key. Please check your key at https://aistudio.google.com/app/apikey');
      } else if (errorMessage.includes('quota') || errorMessage.includes('QUOTA_EXCEEDED')) {
        throw new Error('Gemini API quota exceeded. Check your usage at https://aistudio.google.com/');
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('RATE_LIMIT_EXCEEDED')) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (errorMessage.includes('PERMISSION_DENIED')) {
        throw new Error('Permission denied. Make sure your API key has proper permissions.');
      } else {
        throw new Error(`Gemini API Error: ${errorMessage}`);
      }
    }
    
    const data = await response.json();
    console.log('✅ Google search completed!');
    console.log('Gemini API response:', data);
    
    // Check if search grounding was used
    if (data.candidates && data.candidates[0] && data.candidates[0].groundingMetadata) {
      console.log('🌐 Google Search results found:', data.candidates[0].groundingMetadata);
      console.log('🔍 Search queries used:', data.candidates[0].groundingMetadata.webSearchQueries);
    } else {
      console.log('ℹ️ No grounding metadata - search may have used cached knowledge');
    }
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('No candidates in response:', data);
      throw new Error('No response from Gemini API');
    }
    
    const content = data.candidates[0].content.parts[0].text.trim();
    console.log('Raw Gemini response:', content);
    
    try {
      // Try to parse the JSON directly
      const parsed = JSON.parse(content);
      console.log('Parsed coupons:', parsed);
      return parsed;
    } catch (e) {
      console.log('Direct JSON parse failed, trying to extract...');
      
      // Try multiple JSON extraction patterns
      let jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        // Try with code blocks
        jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (jsonMatch) jsonMatch = [jsonMatch[1]];
      }
      if (!jsonMatch) {
        // Try finding JSON after certain keywords
        jsonMatch = content.match(/(?:codes?|array):\s*(\[[\s\S]*?\])/i);
        if (jsonMatch) jsonMatch = [jsonMatch[1]];
      }
      
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[0]);
          console.log('Successfully extracted JSON:', extracted);
          return extracted;
        } catch (parseError) {
          console.error('Extracted JSON parse error:', parseError);
        }
      }
      
      // Final fallback: only extract codes from Gemini's response, no generic ones
      console.log('Could not parse JSON, extracting codes from text only...');
      
      // Try to find coupon-like patterns in the text
      const couponPatterns = content.match(/[A-Z0-9]{3,15}/g) || [];
      const extractedCoupons = [];
      
      // Add only extracted codes from Gemini (no generic codes)
      couponPatterns.forEach((code) => {
        // Filter out common words that might be picked up
        if (code.length >= 4 && !['HTTP', 'HTTPS', 'JSON', 'CODE', 'SAVE', 'THE', 'AND', 'FOR', 'YOU'].includes(code)) {
          extractedCoupons.push({
            code: code,
            description: `Extracted from Gemini response - try this code`
          });
        }
      });
      
      // If no codes extracted, show a message
      if (extractedCoupons.length === 0) {
        return [{
          code: "NO_CODES_FOUND",
          description: "Gemini couldn't find specific coupon codes for this website"
        }];
      }
      
      return extractedCoupons;
    }
  }
});