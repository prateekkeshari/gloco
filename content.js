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
        if (this.isSelecting) return;
        
        this.isSelecting = true;
        this.createOverlay();
        this.showInstructions();
        
        // Prevent page scrolling during selection
        document.body.style.overflow = 'hidden';
    }
    
    createOverlay() {
        // Remove existing overlay if any
        this.removeOverlay();
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'gloco-overlay';
        
        this.overlay.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.overlay.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.overlay.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.overlay.addEventListener('keydown', this.onKeyDown.bind(this));
        
        // Make overlay focusable for escape key
        this.overlay.tabIndex = -1;
        
        document.body.appendChild(this.overlay);
        this.overlay.focus();
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
        // 1. Fetch the latest settings from storage first.
        let settings;
        try {
            const data = await chrome.storage.local.get('gloco_settings');
            settings = data.gloco_settings || { color: '#ff5533', padding: 30 };
        } catch (error) {
            console.log('Storage access failed, using defaults:', error);
            settings = { color: '#ff5533', padding: 30 };
        }
        
        const PADDING = settings.padding;
        const BRAND_COLOR = settings.color;

        try {
            this.overlay.style.display = 'none';
            await new Promise(resolve => setTimeout(resolve, 50));

            // Capture the visible tab
            const screenshotData = await this.captureTabScreenshot();
            
            // Store for regeneration
            this.lastCapturedData = {
                x, y, width, height, screenshotData
            };
            
            const img = new Image();

            await new Promise((resolve, reject) => {
                img.onload = () => {
                    const finalCanvas = document.createElement('canvas');
                    finalCanvas.width = width + PADDING * 2;
                    finalCanvas.height = height + PADDING * 2;
                    const finalCtx = finalCanvas.getContext('2d');

                    // Fill with brand color
                    finalCtx.fillStyle = BRAND_COLOR;
                    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
                    
                    // Draw screenshot
                    const scaleX = img.width / window.innerWidth;
                    const scaleY = img.height / window.innerHeight;
                    finalCtx.drawImage(
                        img,
                        x * scaleX, y * scaleY, width * scaleX, height * scaleY,
                        PADDING, PADDING, width, height
                    );

                    finalCanvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error("Canvas to Blob conversion failed"));
                            return;
                        }
                        const imageUrlWithBg = URL.createObjectURL(blob);
                        this.showScreenshotModal(imageUrlWithBg, width, height); 
                        resolve();
                    }, 'image/png');
                };
                img.onerror = () => reject(new Error("Image loading failed"));
                img.src = screenshotData;
            });

        } catch (error) {
            console.error('Error capturing screenshot:', error);
            this.showErrorModal('Failed to capture screenshot. Please try again.');
        } finally {
            this.cleanup();
        }
    }
    
    async captureTabScreenshot() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'captureTab' }, (response) => {
                if (response && response.dataUrl) {
                    resolve(response.dataUrl);
                } else {
                    reject(new Error('Failed to capture tab'));
                }
            });
        });
    }
    
    showScreenshotModal(imageUrl, width, height) {
        // Store original captured data for regeneration
        this.originalImageData = {
            imageUrl,
            width,
            height,
            originalScreenshotData: null
        };
        
        const modal = document.createElement('div');
        modal.className = 'gloco-modal';
        
        modal.innerHTML = `
            <div class="gloco-modal-content">
                <div class="gloco-modal-header">
                    <h3 class="gloco-modal-title">Screenshot Captured</h3>
                    <button class="gloco-close-btn">×</button>
                </div>
                <div class="gloco-screenshot-container">
                    <img src="${imageUrl}" alt="Screenshot" class="gloco-screenshot" />
                </div>
                <div class="gloco-editor-controls">
                    <div class="editor-section">
                        <div class="control-group">
                            <label>Background Color</label>
                            <div class="custom-color-picker">
                                <div class="color-swatches">
                                    <div class="color-swatch active" data-color="#ff5533" style="background: #ff5533"></div>
                                    <div class="color-swatch" data-color="#ff6b6b" style="background: #ff6b6b"></div>
                                    <div class="color-swatch" data-color="#4ecdc4" style="background: #4ecdc4"></div>
                                    <div class="color-swatch" data-color="#45b7d1" style="background: #45b7d1"></div>
                                    <div class="color-swatch" data-color="#f093fb" style="background: linear-gradient(45deg, #f093fb 0%, #f5576c 100%)"></div>
                                    <div class="color-swatch" data-color="#4facfe" style="background: linear-gradient(45deg, #4facfe 0%, #00f2fe 100%)"></div>
                                    <div class="color-swatch" data-color="#43e97b" style="background: linear-gradient(45deg, #43e97b 0%, #38f9d7 100%)"></div>
                                    <div class="color-swatch" data-color="#fa709a" style="background: linear-gradient(45deg, #fa709a 0%, #fee140 100%)"></div>
                                    <div class="color-swatch" data-color="#667eea" style="background: linear-gradient(45deg, #667eea 0%, #764ba2 100%)"></div>
                                    <div class="color-swatch" data-color="#f093fb" style="background: linear-gradient(45deg, #ffecd2 0%, #fcb69f 100%)"></div>
                                    <div class="color-swatch" data-color="#000000" style="background: #000000"></div>
                                    <div class="color-swatch" data-color="#ffffff" style="background: #ffffff; border: 2px solid #e5e7eb;"></div>
                                </div>
                                <div class="custom-color-section">
                                    <input type="color" id="modal-color-picker" value="#ff5533" class="hidden-color-input">
                                    <button class="custom-color-btn" onclick="document.getElementById('modal-color-picker').click()">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M12 2l3.09 6.26L22 9l-5.91 5.89L18 21l-6-3.27L6 21l1.91-6.11L2 9l6.91-.74L12 2z"/>
                                        </svg>
                                        Custom
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="control-group">
                            <label>Padding: <span id="modal-padding-value">30</span>px</label>
                            <div class="custom-range-container">
                                <input type="range" id="modal-padding-slider" min="0" max="100" step="5" value="30">
                                <div class="range-labels">
                                    <span>0</span>
                                    <span>50</span>
                                    <span>100</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="gloco-modal-actions">
                    <button class="gloco-action-btn secondary" id="copyBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="m5,15 L5,5 A2,2 0 0,1 7,3 L17,3"></path>
                        </svg>
                        Copy
                    </button>
                    <button class="gloco-action-btn primary" id="downloadBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7,10 12,15 17,10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Load current settings
        chrome.storage.local.get('gloco_settings', (data) => {
            const settings = data.gloco_settings || { color: '#ff5533', padding: 30 };
            const colorPicker = modal.querySelector('#modal-color-picker');
            const paddingSlider = modal.querySelector('#modal-padding-slider');
            const paddingValue = modal.querySelector('#modal-padding-value');
            
            colorPicker.value = settings.color;
            paddingSlider.value = settings.padding;
            paddingValue.textContent = settings.padding;
            
            // Set active swatch
            this.setActiveSwatch(modal, settings.color);
            
            // Set up real-time editing
            this.setupModalEditing(modal);
        });
        
        // Event listeners for main actions
        const closeBtn = modal.querySelector('.gloco-close-btn');
        const downloadBtn = modal.querySelector('#downloadBtn');
        const copyBtn = modal.querySelector('#copyBtn');
        
        closeBtn.addEventListener('click', () => this.closeModal(modal, imageUrl));
        downloadBtn.addEventListener('click', () => this.downloadCurrentImage(modal));
        copyBtn.addEventListener('click', () => this.copyCurrentImageToClipboard(modal));
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal, imageUrl);
            }
        });
        
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal, imageUrl);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    setActiveSwatch(modal, color) {
        const swatches = modal.querySelectorAll('.color-swatch');
        swatches.forEach(swatch => {
            swatch.classList.remove('active');
            if (swatch.dataset.color === color) {
                swatch.classList.add('active');
            }
        });
    }
    
    setupModalEditing(modal) {
        const colorPicker = modal.querySelector('#modal-color-picker');
        const paddingSlider = modal.querySelector('#modal-padding-slider');
        const paddingValue = modal.querySelector('#modal-padding-value');
        const screenshotImg = modal.querySelector('.gloco-screenshot');
        const swatches = modal.querySelectorAll('.color-swatch');
        
        let updateTimeout;
        let currentColor = colorPicker.value;
        
        const updateScreenshot = (color = currentColor) => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(async () => {
                const padding = parseInt(paddingSlider.value);
                
                // Regenerate the image with new settings
                const newImageUrl = await this.regenerateScreenshot(color, padding);
                if (newImageUrl) {
                    // Clean up old image URL
                    if (screenshotImg.src.startsWith('blob:')) {
                        URL.revokeObjectURL(screenshotImg.src);
                    }
                    screenshotImg.src = newImageUrl;
                }
            }, 100);
        };
        
        // Handle swatch clicks
        swatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                swatches.forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                
                currentColor = swatch.dataset.color;
                colorPicker.value = currentColor;
                updateScreenshot(currentColor);
            });
        });
        
        // Handle custom color picker
        colorPicker.addEventListener('input', (e) => {
            currentColor = e.target.value;
            swatches.forEach(s => s.classList.remove('active'));
            updateScreenshot(currentColor);
        });
        
        paddingSlider.addEventListener('input', (e) => {
            paddingValue.textContent = e.target.value;
            updateScreenshot();
        });
    }
    
    async regenerateScreenshot(color, padding) {
        try {
            if (!this.lastCapturedData) return null;
            
            const { x, y, width, height, screenshotData } = this.lastCapturedData;
            const img = new Image();
            
            return new Promise((resolve) => {
                img.onload = () => {
                    const finalCanvas = document.createElement('canvas');
                    finalCanvas.width = width + padding * 2;
                    finalCanvas.height = height + padding * 2;
                    const finalCtx = finalCanvas.getContext('2d');

                    // Fill with new color
                    finalCtx.fillStyle = color;
                    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
                    
                    // Draw screenshot
                    const scaleX = img.width / window.innerWidth;
                    const scaleY = img.height / window.innerHeight;
                    finalCtx.drawImage(
                        img,
                        x * scaleX, y * scaleY, width * scaleX, height * scaleY,
                        padding, padding, width, height
                    );

                    finalCanvas.toBlob((blob) => {
                        if (blob) {
                            const newImageUrl = URL.createObjectURL(blob);
                            resolve(newImageUrl);
                        } else {
                            resolve(null);
                        }
                    }, 'image/png');
                };
                img.src = screenshotData;
            });
        } catch (error) {
            console.error('Error regenerating screenshot:', error);
            return null;
        }
    }
    
    downloadCurrentImage(modal) {
        const screenshotImg = modal.querySelector('.gloco-screenshot');
        const link = document.createElement('a');
        link.href = screenshotImg.src;
        link.download = `gloco-screenshot-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    async copyCurrentImageToClipboard(modal) {
        try {
            const screenshotImg = modal.querySelector('.gloco-screenshot');
            const response = await fetch(screenshotImg.src);
            const blob = await response.blob();
            
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            
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
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: Inter, sans-serif;
            font-size: 14px;
            z-index: 1000001;
            animation: glocoFadeIn 0.3s ease;
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }
    
    closeModal(modal, imageUrl) {
        modal.style.opacity = '0';
        setTimeout(() => {
            if (modal.parentNode) {
                document.body.removeChild(modal);
            }
            URL.revokeObjectURL(imageUrl);
        }, 300);
    }
    
    cancelSelection() {
        this.cleanup();
    }
    
    cleanup() {
        this.isSelecting = false;
        
        // Restore page scrolling
        document.body.style.overflow = '';
        
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
}

// Initialize the selector
if (!window.glocoSelector) {
    window.glocoSelector = new GlocoSelector();
} 