// Background service worker for Gloco extension

// Action click handler - triggers when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    // Check if we can inject scripts on this tab
    const isProtectedUrl = tab.url.startsWith('chrome://') || 
                           tab.url.startsWith('chrome-extension://') || 
                           tab.url.startsWith('https://chrome.google.com/webstore') ||
                           tab.url.startsWith('https://chromewebstore.google.com/');

    if (isProtectedUrl) {
        // Can't inject on protected pages, show notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Gloco Screenshot',
            message: 'Cannot capture screenshots on this page. Please try another page.'
        });
        return;
    }

    try {
        // First, try to send a message to see if content script is already loaded
        try {
            await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
            return; // Content script already loaded and working
        } catch (messageError) {
            // Content script not loaded, need to inject it
            console.log('Content script not loaded, injecting...');
        }

        // Inject CSS first
        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ["css/base.css", "css/editor.css"]
        });

        // Then inject JavaScript
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [
                "js/gloco-selector.js",
                "js/gloco-helpers.js",
                "js/gloco-image.js",
                "js/gloco-editor.js",
                "js/content.js"
            ]
        });

        // Wait a moment for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

    } catch (injectionError) {
        console.error('Error injecting content script:', injectionError);
        // Show error notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Gloco Screenshot',
            message: 'Failed to start screenshot capture. Please refresh the page and try again.'
        });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureTab') {
        // Get quality setting from message or default to highest
        const quality = message.quality === 'highest' ? 100 : 100;
        
        // Capture the visible tab with maximum quality
        chrome.tabs.captureVisibleTab(
            null,
            { format: 'png', quality: quality },
            (dataUrl) => {
                if (chrome.runtime.lastError) {
                    console.error('Capture error:', chrome.runtime.lastError);
                    sendResponse({ error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ dataUrl: dataUrl });
                }
            }
        );
        
        // Return true to indicate we'll respond asynchronously
        return true;
    } else if (message.action === 'startSelectionFromContent') {
        // This message is sent from the content script after it has loaded
        chrome.tabs.sendMessage(sender.tab.id, { action: 'startSelection' });
    }
});

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Gloco extension installed successfully!');
        
        // Set default settings
        chrome.storage.local.set({
            'gloco_settings': {
                version: '1.0.0',
                installed: Date.now(),
                color: '#ff5533',
                padding: 30,
                radius: 12
            }
        });
        
    } else if (details.reason === 'update') {
        console.log('Gloco extension updated!');
    }
}); 