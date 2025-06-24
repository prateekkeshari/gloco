// Background service worker for Gloco extension

// Action click handler - triggers when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
    // Check if we can inject scripts on this tab first
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('moz-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:')) {
        // Can't inject on browser pages, show notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Gloco Screenshot',
            message: 'Cannot capture screenshots on browser pages. Please navigate to a website first.'
        });
        return;
    }

    try {
        // Try to send message first
        await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
    } catch (messageError) {
        console.log('Content script not loaded, injecting...');
        
        try {
            // If message failed, inject content script
            // Inject CSS first
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['content.css']
            });

            // Then inject JavaScript
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // Wait a bit for initialization
            await new Promise(resolve => setTimeout(resolve, 300));

            // Try sending message again
            await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
            
        } catch (injectionError) {
            console.error('Error injecting content script:', injectionError);
            
            // Show error notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Gloco Screenshot',
                message: 'Failed to start screenshot capture. Please try again.'
            });
        }
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureTab') {
        // Capture the visible tab
        chrome.tabs.captureVisibleTab(
            null,
            { format: 'png', quality: 100 },
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
    }
});

// Extension installation/update handler and context menu setup
chrome.runtime.onInstalled.addListener((details) => {
    // Create context menu
    try {
        chrome.contextMenus.create({
            id: 'gloco-capture',
            title: 'Capture area with Gloco',
            contexts: ['page']
        });
    } catch (error) {
        console.error('Error creating context menu:', error);
    }

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
        
        // Open a welcome page (optional)
        // chrome.tabs.create({ url: 'https://your-welcome-page.com' });
    } else if (details.reason === 'update') {
        console.log('Gloco extension updated!');
    }
});

// Tab activation handler (optional for future features)
chrome.tabs.onActivated.addListener((activeInfo) => {
    // Could be used for tab-specific features in the future
});

// Context menu click handler
try {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'gloco-capture') {
            // Send message to content script to start selection
            chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
        }
    });
} catch (error) {
    console.error('Error setting up context menu click handler:', error);
}

// Keep service worker alive
const keepAlive = () => setInterval(chrome.runtime.getPlatformInfo, 20e3);
chrome.runtime.onStartup.addListener(keepAlive);
keepAlive(); 