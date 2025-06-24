document.addEventListener('DOMContentLoaded', function() {
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

    // --- Event Listeners ---

    // Start capture
    captureBtn.addEventListener('click', async function() {
        // Disable button to prevent multiple clicks
        captureBtn.disabled = true;
        captureBtn.style.opacity = '0.6';
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Check if we can inject scripts on this tab first
            if (tab.url.startsWith('chrome://') || 
                tab.url.startsWith('chrome-extension://') || 
                tab.url.startsWith('moz-extension://') ||
                tab.url.startsWith('edge://') ||
                tab.url.startsWith('about:')) {
                alert('Screenshots cannot be taken on browser internal pages. Please navigate to a regular webpage.');
                captureBtn.disabled = false;
                captureBtn.style.opacity = '1';
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

                // Wait a bit longer for initialization
                await new Promise(resolve => setTimeout(resolve, 500));

                // Try sending message again
                await chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
                window.close();
                
            } catch (injectionError) {
                console.error('Error injecting content script:', injectionError);
                
                // More specific error messages
                if (injectionError.message.includes('cannot be scripted')) {
                    alert('Cannot capture screenshots on this page. Please try on a regular webpage (not a browser settings or extension page).');
                } else if (injectionError.message.includes('No tab')) {
                    alert('Tab not found. Please try again.');
                } else {
                    alert('Failed to initialize screenshot capture. Please refresh the page and try again.');
                }
            }
            
        } catch (error) {
            console.error('General error:', error);
            alert('An unexpected error occurred. Please try again.');
        } finally {
            // Re-enable button
            captureBtn.disabled = false;
            captureBtn.style.opacity = '1';
        }
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
            chrome.storage.local.set({ gloco_settings: currentSettings }, () => {
                console.log('Gloco settings saved:', currentSettings);
            });
        }, 100);
    }

    // Settings management
    function initializeSettings() {
        chrome.storage.local.get('gloco_settings', (data) => {
            const settings = data.gloco_settings || { color: '#ff5533', padding: 30 };
            
            const colorPicker = document.getElementById('color-picker');
            const paddingSlider = document.getElementById('padding-slider');
            const paddingValue = document.getElementById('padding-value');
            
            colorPicker.value = settings.color;
            paddingSlider.value = settings.padding;
            paddingValue.textContent = settings.padding;
            
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