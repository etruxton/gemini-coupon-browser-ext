# Google Gemini Coupon Browser Extension

A Chrome extension that automatically searches for coupon codes for the current website using Google Gemini API.

## Features

- Automatically detects the current website you're visiting
- Uses Google Gemini API to search for active coupon codes
- Clean, user-friendly popup interface
- One-click copying of coupon codes to clipboard
- Secure API key storage

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this extension folder
4. The extension icon will appear in your toolbar

## Usage

1. Navigate to any e-commerce website (e.g., dominos.com, regal.com)
2. Click the Coupon Finder extension icon
3. Enter your Google Gemini API key (only needed once - it will be saved securely)
4. Click "Find Coupon Codes"
5. Click any coupon code to copy it to your clipboard

## Getting a Google Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into the extension

## Files Structure

- `manifest.json` - Extension configuration
- `popup.html` - Main UI interface
- `popup.js` - UI logic and API integration
- `content.js` - Website detection script
- `background.js` - Background service worker
- `icons/` - Extension icons (add your own icon files here)

## Privacy & Security

- Your API key is **encrypted** before being stored locally in your browser
- No data is sent to any servers except Google's Gemini API
- The extension only accesses the current tab's URL and title
- All communication with Google Gemini API uses HTTPS

### API Key Security Notes

While the extension encrypts your API key before storage, for maximum security consider:
- Creating a separate Gemini API key just for this extension
- Setting up API quotas and limits in Google Cloud Console
- Regularly rotating your API keys
- Being cautious about installing other browser extensions that might access local storage

## Troubleshooting

- Make sure you have a valid Google Gemini API key
- Ensure you have internet connection
- Try refreshing the page if the website isn't detected properly
- Check the browser console for any error messages