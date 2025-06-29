// Send a message to the background script that the content script has loaded
// But only if this is the first time
if (!window.glocoSelector) {
    chrome.runtime.sendMessage({ action: 'startSelectionFromContent' });
}

class GlocoSelector {
    constructor() {
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        this.overlay = null;
        this.selectionBox = null;
        this.instructions = null;
        this.coordinates = null;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'startSelection') {
                this.startSelection();
                sendResponse({ success: true });
            }
        });
    }
    
    startSelection() {
        if (this.isSelecting) {
            // If already selecting, cancel current selection first
            this.cancelSelection();
        }
        
        this.isSelecting = true;
        this.createOverlay();
        this.showInstructions();
        
        // Prevent page scrolling during selection
        document.documentElement.style.overflow = 'hidden';
    }
    
    createOverlay() {
        // Remove existing overlay if any
        this.removeOverlay();
        
        // Store current scroll position to preserve it
        const currentScrollX = window.scrollX || window.pageXOffset;
        const currentScrollY = window.scrollY || window.pageYOffset;
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'gloco-overlay';
        
        this.overlay.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.overlay.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.overlay.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.overlay.addEventListener('keydown', this.onKeyDown.bind(this));
        
        // Make overlay focusable for escape key
        this.overlay.tabIndex = -1;
        
        document.body.appendChild(this.overlay);
        
        // Focus without scrolling to preserve scroll position
        this.overlay.focus({ preventScroll: true });
        
        // Restore scroll position if it changed
        if (window.scrollX !== currentScrollX || window.scrollY !== currentScrollY) {
            window.scrollTo(currentScrollX, currentScrollY);
        }
    }
    
    showInstructions() {
        this.instructions = document.createElement('div');
        this.instructions.className = 'gloco-instructions';
        this.instructions.textContent = 'Click and drag to select an area • Press ESC to cancel';
        
        document.body.appendChild(this.instructions);
        
        // Auto-hide instructions after 3 seconds
        setTimeout(() => {
            if (this.instructions) {
                this.instructions.style.opacity = '0';
                setTimeout(() => {
                    if (this.instructions && this.instructions.parentNode) {
                        this.instructions.parentNode.removeChild(this.instructions);
                    }
                }, 300);
            }
        }, 3000);
    }
    
    onMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        // Create selection box
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'gloco-selection-box';
        this.selectionBox.style.left = this.startX + 'px';
        this.selectionBox.style.top = this.startY + 'px';
        this.selectionBox.style.width = '0px';
        this.selectionBox.style.height = '0px';
        
        this.overlay.appendChild(this.selectionBox);
        
        // Create coordinates display
        this.coordinates = document.createElement('div');
        this.coordinates.className = 'gloco-coordinates';
        this.updateCoordinates(this.startX, this.startY, 0, 0);
        document.body.appendChild(this.coordinates);
    }
    
    onMouseMove(e) {
        if (!this.selectionBox) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        const left = Math.min(this.startX, currentX);
        const top = Math.min(this.startY, currentY);
        const width = Math.abs(currentX - this.startX);
        const height = Math.abs(currentY - this.startY);
        
        this.selectionBox.style.left = left + 'px';
        this.selectionBox.style.top = top + 'px';
        this.selectionBox.style.width = width + 'px';
        this.selectionBox.style.height = height + 'px';
        
        this.updateCoordinates(left, top, width, height);
    }
    
    updateCoordinates(x, y, width, height) {
        if (!this.coordinates) return;
        
        this.coordinates.textContent = `${Math.round(x)}, ${Math.round(y)} • ${Math.round(width)} × ${Math.round(height)}`;
        this.coordinates.style.left = (x + 10) + 'px';
        this.coordinates.style.top = (y - 30) + 'px';
    }
    
    onMouseUp(e) {
        if (!this.selectionBox) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const currentX = e.clientX;
        const currentY = e.clientY;
        
        const left = Math.min(this.startX, currentX);
        const top = Math.min(this.startY, currentY);
        const width = Math.abs(currentX - this.startX);
        const height = Math.abs(currentY - this.startY);
        
        // Only capture if selection is large enough
        if (width > 10 && height > 10) {
            this.captureSelection(left, top, width, height);
        } else {
            this.cancelSelection();
        }
    }
    
    onKeyDown(e) {
        if (e.key === 'Escape') {
            this.cancelSelection();
        }
    }
    
    async captureSelection(x, y, width, height) {
        try {
            this.overlay.style.display = 'none';
            await new Promise(resolve => setTimeout(resolve, 50));

            // Capture the visible tab
            const screenshotData = await this.captureTabScreenshot();
            
            // Generate final screenshot with current settings (including corner radius)
            // This now returns an object with the final composite image AND the cropped-only image
            const screenshotResult = await this.generateFinalScreenshot(screenshotData, { x, y, width, height });
            
            if (screenshotResult && screenshotResult.finalImageUrl) {
                // Pass the entire result object to the modal
                this.showScreenshotModal(screenshotResult, width, height);
            } else {
                throw new Error("Failed to generate final screenshot");
            }

        } catch (error) {
            console.error('Error capturing screenshot:', error);
            this.showErrorModal('Failed to capture screenshot. Please try again.');
        } finally {
            this.cleanup();
        }
    }
    
    async captureTabScreenshot() {
        return new Promise((resolve, reject) => {
            // Request highest quality screenshot from background script
            chrome.runtime.sendMessage({ 
                action: 'captureTab',
                quality: 'highest'  // Signal to capture at maximum resolution
            }, (response) => {
                if (response && response.dataUrl) {
                    resolve(response.dataUrl);
                } else {
                    reject(new Error('Failed to capture tab'));
                }
            });
        });
    }
    
    showScreenshotModal(screenshotResult, width, height) {
        // Deconstruct the screenshot data
        const { finalImageUrl, croppedImageUrl } = screenshotResult;
        
        // Default settings
        const defaultSettings = {
            backgroundColor: '#FF5F57',
            backgroundType: 'solid', // 'solid' or 'gradient'
            gradient: 'sunset',
            padding: 65,
            innerRadius: 15,
            outerRadius: 15,
            shadowEnabled: false,
            shadowColor: '#000000',
            shadowOffsetX: 0,
            shadowOffsetY: 8,
            shadowBlur: 16,
            shadowOpacity: 0.2,
            browserFrame: false,
            exportResolution: '2x',
            filename: 'screenshot'
        };

        // Color palette
        const colors = ['#FF5F57', '#FEBC2E', '#282F37', '#58ACF9', '#50C878', '#FFC1CC', '#000000', '#ffffff'];
        
        // Gradient presets
        const gradients = {
            sunset: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
            ocean: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            forest: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
            fire: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            sky: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            purple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            gold: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
            mint: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)'
        };
        
        const modal = document.createElement('div');
        modal.className = 'gloco-modal';
        
        modal.innerHTML = `
            <div class="gloco-editor">
                <div class="gloco-preview-pane">
                    <div id="gloco-preview-background">
                        <img src="${croppedImageUrl}" alt="Screenshot" class="gloco-screenshot" />
                    </div>
                </div>
                <div class="gloco-sidebar">
                    <div class="gloco-sidebar-content">
                        <!-- Background Section -->
                        <div class="control-section">
                            <div class="control-header">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"/>
                                </svg>
                                <span>Background</span>
                            </div>
                            <div class="toggle-section">
                                <div class="toggle-control">
                                    <span class="toggle-label">Solid Colors</span>
                                    <div class="toggle-switch active" data-toggle="background-type"></div>
                                </div>
                            </div>
                            <div class="color-swatches">
                                ${colors.map(color => `
                                    <button class="color-swatch ${color === defaultSettings.backgroundColor ? 'active' : ''}" 
                                            style="background-color: ${color};" 
                                            data-color="${color}"></button>
                                `).join('')}
                            </div>
                            <div class="gradient-swatches" style="display: none;">
                                ${Object.entries(gradients).map(([name, gradient]) => `
                                    <button class="gradient-swatch ${name === defaultSettings.gradient ? 'active' : ''}" 
                                            style="background: ${gradient};" 
                                            data-gradient="${name}"></button>
                                `).join('')}
                            </div>
                        </div>

                        <hr class="control-divider" />

                        <!-- Shadow Section -->
                        <div class="control-section">
                            <div class="control-header">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                                </svg>
                                <span>Shadow</span>
                            </div>
                            <div class="toggle-section">
                                <div class="toggle-control">
                                    <span class="toggle-label">Enable Shadow</span>
                                    <div class="toggle-switch" data-toggle="shadow-enabled"></div>
                                </div>
                            </div>
                            <div class="slider-group shadow-controls" style="opacity: 0.5; pointer-events: none;">
                                <div class="color-picker-control">
                                    <span class="slider-label">Shadow Color</span>
                                    <input type="color" class="color-picker-input" value="${defaultSettings.shadowColor}" data-setting="shadowColor" />
                                </div>
                                <div class="slider-control">
                                    <div class="slider-label-container">
                                        <span class="slider-label">Offset X</span>
                                        <span class="slider-value">${defaultSettings.shadowOffsetX}px</span>
                                    </div>
                                    <input type="range" min="-50" max="50" value="${defaultSettings.shadowOffsetX}" data-setting="shadowOffsetX" />
                                </div>
                                <div class="slider-control">
                                    <div class="slider-label-container">
                                        <span class="slider-label">Offset Y</span>
                                        <span class="slider-value">${defaultSettings.shadowOffsetY}px</span>
                                    </div>
                                    <input type="range" min="-50" max="50" value="${defaultSettings.shadowOffsetY}" data-setting="shadowOffsetY" />
                                </div>
                                <div class="slider-control">
                                    <div class="slider-label-container">
                                        <span class="slider-label">Blur</span>
                                        <span class="slider-value">${defaultSettings.shadowBlur}px</span>
                                    </div>
                                    <input type="range" min="0" max="50" value="${defaultSettings.shadowBlur}" data-setting="shadowBlur" />
                                </div>
                                <div class="slider-control">
                                    <div class="slider-label-container">
                                        <span class="slider-label">Opacity</span>
                                        <span class="slider-value">${Math.round(defaultSettings.shadowOpacity * 100)}%</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.01" value="${defaultSettings.shadowOpacity}" data-setting="shadowOpacity" />
                                </div>
                            </div>
                        </div>

                        <hr class="control-divider" />

                        <!-- Padding Section -->
                        <div class="control-section">
                            <div class="control-header">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                                </svg>
                                <span>Padding</span>
                            </div>
                            <div class="slider-group">
                                <div class="slider-control">
                                    <div class="slider-label-container">
                                        <span class="slider-label">Padding</span>
                                        <span class="slider-value" id="modal-padding-value">${defaultSettings.padding}px</span>
                                    </div>
                                    <input type="range" min="0" max="200" value="${defaultSettings.padding}" id="modal-padding-slider" />
                                </div>
                            </div>
                        </div>

                        <hr class="control-divider" />

                        <!-- Corner Radius Section -->
                        <div class="control-section">
                            <div class="control-header">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                </svg>
                                <span>Corner Radius</span>
                            </div>
                            <div class="slider-group">
                                <div class="slider-control">
                                    <div class="slider-label-container">
                                        <span class="slider-label">Inner Radius</span>
                                        <span class="slider-value" id="modal-inner-radius-value">${defaultSettings.innerRadius}px</span>
                                    </div>
                                    <input type="range" min="0" max="50" value="${defaultSettings.innerRadius}" id="modal-inner-radius-slider" />
                                </div>
                                <div class="slider-control">
                                    <div class="slider-label-container">
                                        <span class="slider-label">Outer Radius</span>
                                        <span class="slider-value" id="modal-outer-radius-value">${defaultSettings.outerRadius}px</span>
                                    </div>
                                    <input type="range" min="0" max="50" value="${defaultSettings.outerRadius}" id="modal-outer-radius-slider" />
                                </div>
                            </div>
                        </div>

                        <hr class="control-divider" />

                        <!-- Frame Section -->
                        <div class="control-section">
                            <div class="control-header">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                </svg>
                                <span>Browser Frame</span>
                            </div>
                            <div class="toggle-section">
                                <div class="toggle-control">
                                    <span class="toggle-label">Add Browser Frame</span>
                                    <div class="toggle-switch" data-toggle="browser-frame"></div>
                                </div>
                            </div>
                        </div>

                        <hr class="control-divider" />

                        <!-- Export Section -->
                        <div class="control-section">
                            <div class="control-header">
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                </svg>
                                <span>Export</span>
                            </div>
                            <div class="export-options">
                                <div class="resolution-buttons">
                                    <button class="resolution-btn" data-resolution="1x">1x</button>
                                    <button class="resolution-btn active" data-resolution="2x">2x</button>
                                    <button class="resolution-btn" data-resolution="3x">3x</button>
                                </div>
                                <input type="text" class="filename-input" placeholder="Filename" value="${defaultSettings.filename}" data-setting="filename" />
                            </div>
                        </div>
                    </div>

                    <div class="sidebar-footer">
                        <button class="sidebar-btn" id="copyBtn">Copy</button>
                        <button class="sidebar-btn primary" id="downloadBtn">Download PNG</button>
                    </div>
                </div>
            </div>
            <button class="gloco-close-btn">×</button>
        `;
        
        document.body.appendChild(modal);

        // Set up enhanced modal interactions
        this.setupEnhancedModalEditing(modal, defaultSettings, croppedImageUrl, width, height, gradients);
        
        // Event listeners for main actions
        const closeBtn = modal.querySelector('.gloco-close-btn');
        const downloadBtn = sidebar.querySelector('#downloadBtn');
        const copyBtn = sidebar.querySelector('#copyBtn');
        
        closeBtn.addEventListener('click', () => this.closeModal(modal, finalImageUrl, croppedImageUrl, null));
        downloadBtn.addEventListener('click', async () => {
            await this.downloadCurrentImage(modal);
            this.showToast('Screenshot downloaded');
        });
        copyBtn.addEventListener('click', async () => {
            // Change button text and disable temporarily
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.disabled = true;
            
            await this.copyCurrentImageToClipboard(modal);
            this.showToast('Copied to clipboard');
            
            // Revert button after 2 seconds
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.disabled = false;
            }, 2000);
        });
        
        modal.addEventListener('click', (e) => {
            // Prevent closing when clicking on the editor content
            if (e.target.closest('.gloco-editor')) {
                return;
            }
            this.closeModal(modal, finalImageUrl, croppedImageUrl, null);
        });
        
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal, finalImageUrl, croppedImageUrl, null);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    setActiveSwatch(container, color) {
        // Remove active class from all swatches
        const allSwatches = container.querySelectorAll('.color-swatch');
        allSwatches.forEach(swatch => swatch.classList.remove('active'));
        
        // Find and mark the matching swatch as active
        const matchingSwatch = Array.from(allSwatches).find(
            swatch => swatch.getAttribute('data-color').toLowerCase() === color.toLowerCase()
        );
        
        if (matchingSwatch) {
            matchingSwatch.classList.add('active');
        }
    }
    
    setupModalEditing(modal, sidebar, colorPicker, initialSettings, croppedImageUrl, originalWidth, originalHeight) {
        const paddingSlider = sidebar.querySelector('#modal-padding-slider');
        const paddingValue = sidebar.querySelector('#modal-padding-value');
        const outerRadiusSlider = sidebar.querySelector('#modal-outer-radius-slider');
        const outerRadiusValue = sidebar.querySelector('#modal-outer-radius-value');
        const innerRadiusSlider = sidebar.querySelector('#modal-inner-radius-slider');
        const innerRadiusValue = sidebar.querySelector('#modal-inner-radius-value');
        const previewBackground = modal.querySelector('#gloco-preview-background');
        const screenshotImg = modal.querySelector('.gloco-screenshot');

        let currentSettings = { ...initialSettings };

        // Function to apply styles using CSS for instant feedback
        const applyStyles = () => {
            previewBackground.style.backgroundColor = currentSettings.color;
            previewBackground.style.borderRadius = `${currentSettings.outerRadius}px`;
            previewBackground.style.padding = `${currentSettings.padding}px`;
            screenshotImg.style.borderRadius = `${currentSettings.innerRadius}px`;
        };

        // Function to save settings with a debounce
        const debouncedSave = (() => {
            let timeout;
            return () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    chrome.storage.local.set({ gloco_settings: currentSettings });
                }, 300);
            };
        })();

        // Initial application of styles
        applyStyles();
        
        // Color swatch selection
        const colorSwatches = sidebar.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                const color = swatch.getAttribute('data-color');
                currentSettings.color = color;
                this.setActiveSwatch(sidebar, color);
                applyStyles();
                debouncedSave();
            });
        });
        
        // Handle padding slider
        paddingSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            currentSettings.padding = value;
            paddingValue.textContent = `${value}px`;
            applyStyles();
            debouncedSave();
        });
        
        // Handle outer radius slider
        outerRadiusSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            currentSettings.outerRadius = value;
            outerRadiusValue.textContent = `${value}px`;
            applyStyles();
            debouncedSave();
        });
        
        // Handle inner radius slider
        innerRadiusSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value, 10);
            currentSettings.innerRadius = value;
            innerRadiusValue.textContent = `${value}px`;
            applyStyles();
            debouncedSave();
        });
    }

    setupEnhancedModalEditing(modal, settings, croppedImageUrl, width, height, gradients) {
        const previewBackground = modal.querySelector('#gloco-preview-background');
        const screenshot = modal.querySelector('.gloco-screenshot');
        
        let currentSettings = { ...settings };

        // Helper function to convert hex to rgba
        const hexToRgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        // Function to update preview
        const updatePreview = () => {
            // Update background
            if (currentSettings.backgroundType === 'solid') {
                previewBackground.style.background = currentSettings.backgroundColor;
            } else {
                previewBackground.style.background = gradients[currentSettings.gradient];
            }
            
            // Update padding
            previewBackground.style.padding = currentSettings.padding + 'px';
            
            // Update border radius
            previewBackground.style.borderRadius = currentSettings.outerRadius + 'px';
            screenshot.style.borderRadius = currentSettings.innerRadius + 'px';
            
            // Update shadow
            if (currentSettings.shadowEnabled) {
                const shadowColor = hexToRgba(currentSettings.shadowColor, currentSettings.shadowOpacity);
                screenshot.style.boxShadow = `${currentSettings.shadowOffsetX}px ${currentSettings.shadowOffsetY}px ${currentSettings.shadowBlur}px ${shadowColor}`;
            } else {
                screenshot.style.boxShadow = 'none';
            }
            
            // Update browser frame
            if (currentSettings.browserFrame) {
                if (!screenshot.parentElement.classList.contains('browser-frame')) {
                    const frame = document.createElement('div');
                    frame.className = 'browser-frame';
                    frame.innerHTML = `
                        <div class="browser-header">
                            <div class="browser-controls">
                                <div class="browser-dot red"></div>
                                <div class="browser-dot yellow"></div>
                                <div class="browser-dot green"></div>
                            </div>
                            <div class="browser-url">example.com</div>
                            <div style="width: 60px;"></div>
                        </div>
                    `;
                    
                    screenshot.parentElement.insertBefore(frame, screenshot);
                    frame.appendChild(screenshot);
                }
            } else {
                const frame = screenshot.closest('.browser-frame');
                if (frame) {
                    previewBackground.appendChild(screenshot);
                    frame.remove();
                }
            }
        };

        // Color swatches
        modal.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                modal.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                currentSettings.backgroundColor = e.target.dataset.color;
                updatePreview();
            });
        });

        // Gradient swatches
        modal.querySelectorAll('.gradient-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                modal.querySelectorAll('.gradient-swatch').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
                currentSettings.gradient = e.target.dataset.gradient;
                updatePreview();
            });
        });

        // Toggle switches
        modal.querySelectorAll('.toggle-switch').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const toggleType = e.target.dataset.toggle;
                e.target.classList.toggle('active');
                
                if (toggleType === 'background-type') {
                    currentSettings.backgroundType = e.target.classList.contains('active') ? 'solid' : 'gradient';
                    // Toggle visibility of color/gradient swatches
                    const colorSwatches = modal.querySelector('.color-swatches');
                    const gradientSwatches = modal.querySelector('.gradient-swatches');
                    if (currentSettings.backgroundType === 'solid') {
                        colorSwatches.style.display = 'grid';
                        gradientSwatches.style.display = 'none';
                    } else {
                        colorSwatches.style.display = 'none';
                        gradientSwatches.style.display = 'grid';
                    }
                } else if (toggleType === 'shadow-enabled') {
                    currentSettings.shadowEnabled = e.target.classList.contains('active');
                    // Toggle shadow controls
                    const shadowControls = modal.querySelector('.shadow-controls');
                    if (currentSettings.shadowEnabled) {
                        shadowControls.style.opacity = '1';
                        shadowControls.style.pointerEvents = 'all';
                    } else {
                        shadowControls.style.opacity = '0.5';
                        shadowControls.style.pointerEvents = 'none';
                    }
                } else if (toggleType === 'browser-frame') {
                    currentSettings.browserFrame = e.target.classList.contains('active');
                }
                
                updatePreview();
            });
        });

        // Range sliders
        modal.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const setting = e.target.dataset.setting;
                let value = parseFloat(e.target.value);
                
                if (setting) {
                    if (setting === 'shadowOpacity') {
                        currentSettings[setting] = value;
                        e.target.parentElement.querySelector('.slider-value').textContent = Math.round(value * 100) + '%';
                    } else {
                        currentSettings[setting] = value;
                        e.target.parentElement.querySelector('.slider-value').textContent = value + 'px';
                    }
                } else {
                    // Handle legacy sliders
                    if (e.target.id === 'modal-padding-slider') {
                        currentSettings.padding = value;
                        modal.querySelector('#modal-padding-value').textContent = value + 'px';
                    } else if (e.target.id === 'modal-inner-radius-slider') {
                        currentSettings.innerRadius = value;
                        modal.querySelector('#modal-inner-radius-value').textContent = value + 'px';
                    } else if (e.target.id === 'modal-outer-radius-slider') {
                        currentSettings.outerRadius = value;
                        modal.querySelector('#modal-outer-radius-value').textContent = value + 'px';
                    }
                }
                
                updatePreview();
            });
        });

        // Color picker
        modal.querySelectorAll('.color-picker-input').forEach(picker => {
            picker.addEventListener('input', (e) => {
                const setting = e.target.dataset.setting;
                currentSettings[setting] = e.target.value;
                updatePreview();
            });
        });

        // Resolution buttons
        modal.querySelectorAll('.resolution-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                modal.querySelectorAll('.resolution-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                currentSettings.exportResolution = e.target.dataset.resolution;
            });
        });

        // Filename input
        const filenameInput = modal.querySelector('.filename-input');
        if (filenameInput) {
            filenameInput.addEventListener('input', (e) => {
                currentSettings.filename = e.target.value;
            });
        }

        // Store current settings for access by other functions
        modal._currentSettings = currentSettings;

        // Initial preview update
        updatePreview();
    }

    async generateEnhancedScreenshot(settings, highQuality = false) {
        return new Promise((resolve) => {
            if (!this.lastCapturedData) {
                resolve(null);
                return;
            }

            const { imageUrl, croppedWidth, croppedHeight } = this.lastCapturedData;
            const img = new Image();
            
            img.onload = () => {
                const scale = parseInt(settings.exportResolution.replace('x', ''));
                const pixelRatio = highQuality ? Math.max(scale, 2) : scale;
                
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Enable high-quality rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                const padding = settings.padding * pixelRatio;
                const outerRadius = settings.outerRadius * pixelRatio;
                const innerRadius = settings.innerRadius * pixelRatio;
                
                canvas.width = (croppedWidth + settings.padding * 2) * pixelRatio;
                canvas.height = (croppedHeight + settings.padding * 2) * pixelRatio;
                
                // Draw background with outer radius
                ctx.save();
                this.roundRect(ctx, 0, 0, canvas.width, canvas.height, outerRadius);
                ctx.clip();
                
                // Apply background (solid or gradient)
                if (settings.backgroundType === 'solid') {
                    ctx.fillStyle = settings.backgroundColor;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                } else {
                    // Create gradient (simplified for canvas)
                    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                    // Add gradient stops based on selected gradient
                    if (settings.gradient === 'sunset') {
                        gradient.addColorStop(0, '#ff9a9e');
                        gradient.addColorStop(0.5, '#fecfef');
                        gradient.addColorStop(1, '#fecfef');
                    } else if (settings.gradient === 'ocean') {
                        gradient.addColorStop(0, '#667eea');
                        gradient.addColorStop(1, '#764ba2');
                    } else if (settings.gradient === 'forest') {
                        gradient.addColorStop(0, '#134e5e');
                        gradient.addColorStop(1, '#71b280');
                    } else if (settings.gradient === 'fire') {
                        gradient.addColorStop(0, '#fa709a');
                        gradient.addColorStop(1, '#fee140');
                    } else if (settings.gradient === 'sky') {
                        gradient.addColorStop(0, '#a8edea');
                        gradient.addColorStop(1, '#fed6e3');
                    } else if (settings.gradient === 'purple') {
                        gradient.addColorStop(0, '#667eea');
                        gradient.addColorStop(1, '#764ba2');
                    } else if (settings.gradient === 'gold') {
                        gradient.addColorStop(0, '#f7971e');
                        gradient.addColorStop(1, '#ffd200');
                    } else if (settings.gradient === 'mint') {
                        gradient.addColorStop(0, '#89f7fe');
                        gradient.addColorStop(1, '#66a6ff');
                    }
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                
                ctx.restore();
                
                // Draw shadow if enabled
                if (settings.shadowEnabled) {
                    ctx.save();
                    const shadowColor = this.hexToRgba(settings.shadowColor, settings.shadowOpacity);
                    ctx.shadowColor = shadowColor;
                    ctx.shadowOffsetX = settings.shadowOffsetX * pixelRatio;
                    ctx.shadowOffsetY = settings.shadowOffsetY * pixelRatio;
                    ctx.shadowBlur = settings.shadowBlur * pixelRatio;
                    
                    this.roundRect(ctx, padding, padding, croppedWidth * pixelRatio, croppedHeight * pixelRatio, innerRadius);
                    ctx.fillStyle = 'rgba(0,0,0,0.01)';
                    ctx.fill();
                    ctx.restore();
                }
                
                // Draw screenshot with inner radius
                ctx.save();
                this.roundRect(ctx, padding, padding, croppedWidth * pixelRatio, croppedHeight * pixelRatio, innerRadius);
                ctx.clip();
                
                // Handle browser frame
                if (settings.browserFrame) {
                    // Draw browser frame background
                    const frameHeight = 28 * pixelRatio;
                    const framePadding = 8 * pixelRatio;
                    
                    ctx.fillStyle = '#f6f6f6';
                    ctx.fillRect(padding, padding, croppedWidth * pixelRatio, croppedHeight * pixelRatio + frameHeight + framePadding);
                    
                    // Draw header
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(padding, padding, croppedWidth * pixelRatio, frameHeight);
                    
                    // Draw traffic lights
                    const dotSize = 12 * pixelRatio;
                    const dotY = padding + frameHeight / 2 - dotSize / 2;
                    const dotSpacing = 8 * pixelRatio;
                    
                    ctx.fillStyle = '#ff5f56';
                    ctx.beginPath();
                    ctx.arc(padding + 12 * pixelRatio, dotY + dotSize / 2, dotSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.fillStyle = '#ffbd2e';
                    ctx.beginPath();
                    ctx.arc(padding + 12 * pixelRatio + dotSize + dotSpacing, dotY + dotSize / 2, dotSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.fillStyle = '#27ca3f';
                    ctx.beginPath();
                    ctx.arc(padding + 12 * pixelRatio + (dotSize + dotSpacing) * 2, dotY + dotSize / 2, dotSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Draw the screenshot below the header
                    ctx.drawImage(img, padding, padding + frameHeight, croppedWidth * pixelRatio, croppedHeight * pixelRatio);
                } else {
                    ctx.drawImage(img, padding, padding, croppedWidth * pixelRatio, croppedHeight * pixelRatio);
                }
                
                ctx.restore();
                
                resolve(canvas.toDataURL('image/png'));
            };
            
            img.src = imageUrl;
        });
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    async regenerateScreenshot(color, padding, outerRadius, innerRadius, highQuality = false) {
        try {
            if (!this.lastCapturedData) return null;
            
            const { imageUrl, croppedWidth, croppedHeight } = this.lastCapturedData;
            
            // Get device pixel ratio for high-quality regeneration
            // Force at least 2x pixel ratio for crisp results on all devices
            const pixelRatio = Math.max(window.devicePixelRatio || 1, highQuality ? 2.5 : 2);
            
            return new Promise((resolve) => {
                // Create canvas for regeneration with high-quality settings
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Enable high-quality rendering
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Calculate final dimensions using device pixel ratio
                const cssWidth = croppedWidth + (padding * 2);
                const cssHeight = croppedHeight + (padding * 2);
                const finalWidth = Math.round(cssWidth * pixelRatio);
                const finalHeight = Math.round(cssHeight * pixelRatio);
                
                canvas.width = finalWidth;
                canvas.height = finalHeight;
                
                // Set CSS size for proper display
                canvas.style.width = cssWidth + 'px';
                canvas.style.height = cssHeight + 'px';
                
                // Scale context for device pixel ratio
                ctx.scale(pixelRatio, pixelRatio);

                // Apply outer radius to entire canvas if specified
                const cssWidthFinal = cssWidth;
                const cssHeightFinal = cssHeight;
                
                if (outerRadius > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(0, 0, cssWidthFinal, cssHeightFinal, outerRadius);
                    ctx.clip();
                }
                
                // Fill background with color
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, cssWidthFinal, cssHeightFinal);
                
                // Load and draw the cropped image immediately
                const img = new Image();
                img.onload = () => {
                    // Save context state for inner radius
                    ctx.save();
                    
                    // Create rounded rectangle clipping path for the image (inner radius)
                    const x = padding;
                    const y = padding;
                    const width = croppedWidth;
                    const height = croppedHeight;
                    
                    if (innerRadius > 0) {
                        ctx.beginPath();
                        ctx.roundRect(x, y, width, height, innerRadius);
                        ctx.clip();
                    }
                    
                    // Draw the image at full quality
                    ctx.drawImage(img, x, y, width, height);
                    
                    // Restore context state
                    ctx.restore();
                    
                    // Restore outer radius clipping if it was applied
                    if (outerRadius > 0) {
                        ctx.restore();
                    }
                    
                    // Convert to blob and create URL with maximum quality
                    canvas.toBlob((blob) => {
                        const newImageUrl = URL.createObjectURL(blob);
                        resolve(newImageUrl);
                    }, 'image/png', 1.0); // Use maximum quality for crisp HD output
                };
                img.src = imageUrl;
            });
        } catch (error) {
            console.error('Error regenerating screenshot:', error);
            return null;
        }
    }
    
    async downloadCurrentImage(modal) {
        try {
            const settings = modal._currentSettings || {
                backgroundColor: '#FF5F57',
                backgroundType: 'solid',
                gradient: 'sunset',
                padding: 65,
                innerRadius: 15,
                outerRadius: 15,
                shadowEnabled: false,
                shadowColor: '#000000',
                shadowOffsetX: 0,
                shadowOffsetY: 8,
                shadowBlur: 16,
                shadowOpacity: 0.2,
                browserFrame: false,
                exportResolution: '2x',
                filename: 'screenshot'
            };

            // Generate high-quality version for download
            const highQualityImageUrl = await this.generateEnhancedScreenshot(settings, true);
            
            if (highQualityImageUrl) {
                // Create download link
                const link = document.createElement('a');
                link.href = highQualityImageUrl;
                link.download = `${settings.filename || 'screenshot'}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up the blob URL
                setTimeout(() => URL.revokeObjectURL(highQualityImageUrl), 1000);
            }
        } catch (error) {
            console.error('Download failed:', error);
            this.showToast('Download failed. Please try again.');
        }
    }
    
    async copyCurrentImageToClipboard(modal) {
        try {
            const settings = modal._currentSettings || {
                backgroundColor: '#FF5F57',
                backgroundType: 'solid',
                gradient: 'sunset',
                padding: 65,
                innerRadius: 15,
                outerRadius: 15,
                shadowEnabled: false,
                shadowColor: '#000000',
                shadowOffsetX: 0,
                shadowOffsetY: 8,
                shadowBlur: 16,
                shadowOpacity: 0.2,
                browserFrame: false,
                exportResolution: '2x',
                filename: 'screenshot'
            };

            const finalImageUrl = await this.generateEnhancedScreenshot(settings, true);

            if (!finalImageUrl) throw new Error("Could not generate image for copying");

            const response = await fetch(finalImageUrl);
            const blob = await response.blob();
            
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            URL.revokeObjectURL(finalImageUrl);
            this.showToast('Screenshot copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showToast('Failed to copy to clipboard');
        }
    }
    
    showErrorModal(message) {
        const modal = document.createElement('div');
        modal.className = 'gloco-modal';
        
        modal.innerHTML = `
            <div class="gloco-modal-content">
                <div class="gloco-modal-header">
                    <h3 class="gloco-modal-title">Error</h3>
                    <button class="gloco-close-btn">×</button>
                </div>
                <div style="padding: 20px; text-align: center;">
                    <p style="color: white; font-size: 16px;">${message}</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeBtn = modal.querySelector('.gloco-close-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            if (modal.parentNode) {
                document.body.removeChild(modal);
            }
        }, 3000);
    }
    
    showToast(message) {
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll('.gloco-toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Create new toast
        const toast = document.createElement('div');
        toast.className = 'gloco-toast';
        toast.innerHTML = `
            <div class="gloco-toast-content">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
                    <rect x="3" y="3" width="18" height="18" rx="0" ry="0"></rect>
                    <polyline points="7 13 11 17 17 8" stroke-linejoin="miter"></polyline>
                </svg>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Automatically remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
    
    closeModal(modal, finalImageUrl, croppedImageUrl, controlPanel) {
        modal.style.opacity = '0';
        if (controlPanel) {
            controlPanel.style.opacity = '0';
        }
        setTimeout(() => {
            if (modal.parentNode) {
                document.body.removeChild(modal);
            }
            if (controlPanel && controlPanel.parentNode) {
                document.body.removeChild(controlPanel);
            }
            // Revoke both URLs
            URL.revokeObjectURL(finalImageUrl);
            URL.revokeObjectURL(croppedImageUrl);
        }, 300);
    }
    
    cancelSelection() {
        this.cleanup();
    }
    
    cleanup() {
        this.isSelecting = false;
        
        // Restore page scrolling
        document.documentElement.style.overflow = '';
        
        this.removeOverlay();
        
        if (this.instructions && this.instructions.parentNode) {
            this.instructions.parentNode.removeChild(this.instructions);
        }
        
        if (this.coordinates && this.coordinates.parentNode) {
            this.coordinates.parentNode.removeChild(this.coordinates);
        }
        
        this.overlay = null;
        this.selectionBox = null;
        this.instructions = null;
        this.coordinates = null;
    }
    
    removeOverlay() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }

    async generateFinalScreenshot(screenshotDataUrl, selectionBox) {
        const { x, y, width, height } = selectionBox;
        
        return new Promise((resolve) => {
            const img = new Image();
            // Use image decode API for better quality and performance
            img.decode = img.decode || function() { return Promise.resolve(); };
            img.onload = async () => {
                // Wait for the image to be fully decoded for best quality
                await img.decode().catch(() => {});
                
                // Get device pixel ratio for high-quality capture
                const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
                
                // Create canvas for cropping with high-quality settings
                const cropCanvas = document.createElement('canvas');
                const cropCtx = cropCanvas.getContext('2d');
                
                // Enable maximum-quality rendering
                cropCtx.imageSmoothingEnabled = true;
                cropCtx.imageSmoothingQuality = 'high';
                cropCtx.globalCompositeOperation = 'source-over';
                cropCtx.imageSmoothingEnabled = true;
                
                // Calculate proper scale factors accounting for device pixel ratio
                const scaleX = img.width / window.innerWidth;
                const scaleY = img.height / window.innerHeight;
                
                // Set crop canvas size to maintain quality - use device pixel ratio
                const croppedWidth = Math.round(width * pixelRatio);
                const croppedHeight = Math.round(height * pixelRatio);
                cropCanvas.width = croppedWidth;
                cropCanvas.height = croppedHeight;
                
                // Scale canvas back to CSS pixels for proper display
                cropCanvas.style.width = width + 'px';
                cropCanvas.style.height = height + 'px';
                
                // Scale the context to account for device pixel ratio
                cropCtx.scale(pixelRatio, pixelRatio);
                
                // Draw the cropped portion with precise pixel boundaries
                const sourceX = Math.round(x * scaleX);
                const sourceY = Math.round(y * scaleY);
                const sourceWidth = Math.round(width * scaleX);
                const sourceHeight = Math.round(height * scaleY);
                
                cropCtx.drawImage(
                    img,
                    sourceX, sourceY, sourceWidth, sourceHeight,
                    0, 0, width, height
                );
                
                // Get the cropped image as data URL with maximum quality
                const croppedImageUrl = cropCanvas.toDataURL('image/png', 1.0);
                
                // Get current settings
                chrome.storage.local.get('gloco_settings', (data) => {
                    const settings = data.gloco_settings || { 
                        color: '#ff5533', 
                        padding: 50, 
                        outerRadius: 24,
                        innerRadius: 16
                    };
                    
                    // Create final canvas with padding and radius - maintain high quality
                    const finalCanvas = document.createElement('canvas');
                    const finalCtx = finalCanvas.getContext('2d');
                    
                    // Enable maximum-quality rendering for final canvas
                    finalCtx.imageSmoothingEnabled = true;
                    finalCtx.imageSmoothingQuality = 'high';
                    finalCtx.globalCompositeOperation = 'source-over';
                    finalCtx.imageSmoothingEnabled = true;
                    
                    // Use high-resolution dimensions for final canvas
                    const finalWidth = Math.round((width + (settings.padding * 2)) * pixelRatio);
                    const finalHeight = Math.round((height + (settings.padding * 2)) * pixelRatio);
                    
                    finalCanvas.width = finalWidth;
                    finalCanvas.height = finalHeight;
                    
                    // Set CSS size for proper display
                    finalCanvas.style.width = (width + (settings.padding * 2)) + 'px';
                    finalCanvas.style.height = (height + (settings.padding * 2)) + 'px';
                    
                    // Scale context for device pixel ratio
                    finalCtx.scale(pixelRatio, pixelRatio);
                    
                    // Apply outer radius to entire canvas if specified
                    const cssWidth = width + (settings.padding * 2);
                    const cssHeight = height + (settings.padding * 2);
                    
                    if (settings.outerRadius > 0) {
                        finalCtx.save();
                        finalCtx.beginPath();
                        finalCtx.roundRect(0, 0, cssWidth, cssHeight, settings.outerRadius);
                        finalCtx.clip();
                    }
                    
                    // Fill background
                    finalCtx.fillStyle = settings.color;
                    finalCtx.fillRect(0, 0, cssWidth, cssHeight);
                    
                    // Create cropped image to draw
                    const croppedImg = new Image();
                    croppedImg.onload = () => {
                        // Save context state for inner radius
                        finalCtx.save();
                        
                        // Create rounded rectangle clipping path for the image (inner radius)
                        const imageX = settings.padding;
                        const imageY = settings.padding;
                        
                        if (settings.innerRadius > 0) {
                            finalCtx.beginPath();
                            finalCtx.roundRect(imageX, imageY, width, height, settings.innerRadius);
                            finalCtx.clip();
                        }
                        
                        // Draw the cropped image at full quality
                        finalCtx.drawImage(croppedImg, imageX, imageY, width, height);
                        
                        // Restore context state
                        finalCtx.restore();
                        
                        // Restore outer radius clipping if it was applied
                        if (settings.outerRadius > 0) {
                            finalCtx.restore();
                        }
                        
                        // Convert to blob and create URL with maximum quality
                        finalCanvas.toBlob((blob) => {
                            const finalImageUrl = URL.createObjectURL(blob);
                            
                            // Store data for regeneration
                            this.lastCapturedData = {
                                imageUrl: croppedImageUrl,
                                croppedWidth: width,
                                croppedHeight: height
                            };
                            
                            resolve({ finalImageUrl, croppedImageUrl });
                        }, 'image/png', 1.0);
                    };
                    croppedImg.src = croppedImageUrl;
                });
            };
            img.src = screenshotDataUrl;
        });
    }

    updateTrackFill(slider, trackId) {
        const trackFill = document.getElementById(trackId);
        const trackWidth = slider.clientWidth;
        const sliderValue = slider.value;
        const trackFillWidth = (sliderValue / slider.max) * trackWidth;
        trackFill.style.width = trackFillWidth + 'px';
    }

    resizeModalToFitScreenshot(modal, imageUrl, imageWidth, imageHeight) {
        // Now we use the base image width/height for calculations if available
        const img = new Image();
        img.onload = () => {
            const modalContent = modal.querySelector('.gloco-modal-content');
            const actionsHeight = 70; // Height of the action buttons area
            
            // Calculate viewport constraints with some padding
            const maxWidth = Math.min(window.innerWidth * 0.9, window.innerWidth - 40);
            const maxHeight = Math.min(window.innerHeight * 0.9, window.innerHeight - 40);
            
            // Calculate available space for the image (subtract actions height)
            const availableHeight = maxHeight - actionsHeight;
            
            // Calculate scaling factor to fit within bounds
            // Use the dimensions of the generated composite image for scaling
            let scaleX = maxWidth / img.width;
            let scaleY = availableHeight / img.height;
            let scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
            
            // Calculate final dimensions for the container
            const finalContainerWidth = Math.floor(img.width * scale);
            const finalContainerHeight = Math.floor(img.height * scale);
            const finalModalWidth = finalContainerWidth;
            const finalModalHeight = finalContainerHeight + actionsHeight;
            
            // Apply the calculated dimensions
            modalContent.style.width = finalModalWidth + 'px';
            modalContent.style.height = finalModalHeight + 'px';
            modalContent.style.maxWidth = 'none'; // Remove conflicting max constraints
            modalContent.style.maxHeight = 'none';
            
            // The preview background takes up the full space
            const previewBg = modalContent.querySelector('#gloco-preview-background');
            if (previewBg) {
                previewBg.style.width = finalContainerWidth + 'px';
                previewBg.style.height = finalContainerHeight + 'px';
            }
        };
        img.src = imageUrl;
    }
}

// Initialize the selector
if (!window.glocoSelector) {
    window.glocoSelector = new GlocoSelector();
} 