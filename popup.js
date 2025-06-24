document.addEventListener('DOMContentLoaded', function() {
    // Auto-start capture when popup opens
    autoStartCapture();
    
    // Main elements
    const captureBtn = document.getElementById('captureBtn');
    const popupContainer = document.querySelector('.popup-container');

    // Settings elements
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsView = document.querySelector('.settings-view');
    const backBtn = document.getElementById('backBtn');
    const colorPicker = document.getElementById('color-picker');
    const paddingSlider = document.getElementById('padding-slider');
    const paddingValue = document.getElementById('padding-value');

    let currentSettings = {};

    // Load settings from storage
    initializeSettings();

    // Auto-start capture function
    async function autoStartCapture() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Check if we can inject scripts on this tab first
            if (tab.url.startsWith('chrome://') || 
                tab.url.startsWith('chrome-extension://') || 
                tab.url.startsWith('moz-extension://') ||
                tab.url.startsWith('edge://') ||
                tab.url.startsWith('about:')) {
                // Show settings instead for browser pages
                return;
            }

            // Try to send message first
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
                window.close();
                return;
            } catch (messageError) {
                console.log('Content script not loaded, injecting...');
            }

            // If message failed, inject content script
            try {
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
                window.close();
                
            } catch (injectionError) {
                console.error('Error injecting content script:', injectionError);
                // Silently fail and show normal popup
            }
            
        } catch (error) {
            console.error('Auto-capture error:', error);
            // Silently fail and show normal popup
        }
    }

    // --- Event Listeners ---

    // Manual capture (fallback)
    captureBtn.addEventListener('click', async function() {
        autoStartCapture();
    });
    
    // Show settings panel
    settingsBtn.addEventListener('click', () => {
        settingsView.classList.remove('hidden');
        settingsView.classList.add('visible');
    });

    // Hide settings panel
    backBtn.addEventListener('click', () => {
        settingsView.classList.remove('visible');
        // Use timeout to allow animation to complete before hiding
        setTimeout(() => {
            if (!settingsView.classList.contains('visible')) {
                settingsView.classList.add('hidden');
            }
        }, 300);
    });

    // Handle color change
    colorPicker.addEventListener('input', () => {
        swatches.forEach(s => s.classList.remove('active'));
        saveSettings();
    });

    // Handle padding change
    paddingSlider.addEventListener('input', (e) => {
        paddingValue.textContent = e.target.value;
        saveSettings();
    });

    // --- Helper Functions ---
    
    // Debounce saving to prevent too many writes
    let saveTimeout;
    function saveSettings() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const color = document.getElementById('color-picker').value;
            const padding = parseInt(document.getElementById('padding-slider').value);
            const innerRadius = parseInt(document.getElementById('radius-slider').value);
            
            const settings = { 
                color, 
                padding, 
                outerRadius: 16, // Default outer radius
                innerRadius 
            };
            chrome.storage.local.set({ gloco_settings: settings }, () => {
                console.log('Gloco settings saved:', settings);
            });
        }, 100);
    }

    // Settings management
    function initializeSettings() {
        chrome.storage.local.get('gloco_settings', (data) => {
            const settings = data.gloco_settings || { 
                color: '#ff5533', 
                padding: 30, 
                outerRadius: 16, 
                innerRadius: 12 
            };
            
            const colorPicker = document.getElementById('color-picker');
            const paddingSlider = document.getElementById('padding-slider');
            const paddingValue = document.getElementById('padding-value');
            const radiusSlider = document.getElementById('radius-slider');
            const radiusValue = document.getElementById('radius-value');
            
            colorPicker.value = settings.color;
            paddingSlider.value = settings.padding;
            paddingValue.textContent = settings.padding;
            radiusSlider.value = settings.innerRadius || 12;
            radiusValue.textContent = settings.innerRadius || 12;
            
            // Set active swatch
            setActiveSwatch(settings.color);
            
            // Update settings in real-time
            const swatches = document.querySelectorAll('.color-swatch');
            swatches.forEach(swatch => {
                swatch.addEventListener('click', () => {
                    swatches.forEach(s => s.classList.remove('active'));
                    swatch.classList.add('active');
                    
                    const color = swatch.dataset.color;
                    colorPicker.value = color;
                    saveSettings();
                });
            });
            
            colorPicker.addEventListener('input', () => {
                swatches.forEach(s => s.classList.remove('active'));
                saveSettings();
            });
            
            paddingSlider.addEventListener('input', (e) => {
                paddingValue.textContent = e.target.value;
                saveSettings();
            });
            
            radiusSlider.addEventListener('input', (e) => {
                radiusValue.textContent = e.target.value;
                saveSettings();
            });
        });
    }

    function setActiveSwatch(color) {
        const swatches = document.querySelectorAll('.color-swatch');
        swatches.forEach(swatch => {
            swatch.classList.remove('active');
            if (swatch.dataset.color === color) {
                swatch.classList.add('active');
            }
        });
    }
}); 