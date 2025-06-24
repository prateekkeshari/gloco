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
        try {
            this.overlay.style.display = 'none';
            await new Promise(resolve => setTimeout(resolve, 50));

            // Capture the visible tab
            const screenshotData = await this.captureTabScreenshot();
            
            // Generate final screenshot with current settings (including corner radius)
            const finalImageUrl = await this.generateFinalScreenshot(screenshotData, { x, y, width, height });
            
            if (finalImageUrl) {
                this.showScreenshotModal(finalImageUrl, width, height);
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
        
        // Determine orientation for responsive sizing
        const aspectRatio = width / height;
        let orientationClass = '';
        let screenshotClass = '';
        
        if (aspectRatio > 1.3) {
            orientationClass = 'landscape';
            screenshotClass = 'landscape';
        } else if (aspectRatio < 0.8) {
            orientationClass = 'portrait';
            screenshotClass = 'portrait';
        } else {
            orientationClass = 'square';
            screenshotClass = 'square';
        }
        
        const modal = document.createElement('div');
        modal.className = 'gloco-modal';
        
        modal.innerHTML = `
            <div class="gloco-modal-content ${orientationClass}">
                <div class="gloco-modal-header">
                    <h3 class="gloco-modal-title">Screenshot Captured</h3>
                    <button class="gloco-close-btn">×</button>
                </div>
                <div class="gloco-screenshot-container">
                    <img src="${imageUrl}" alt="Screenshot" class="gloco-screenshot ${screenshotClass}" />
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
        
        // Create floating controls
        const floatingControls = document.createElement('div');
        floatingControls.className = 'gloco-floating-controls';
        floatingControls.innerHTML = `
            <div class="floating-panel">
                <div class="panel-header">
                    <span class="panel-title">Background</span>
                </div>
                <div class="color-swatches">
                    <div class="color-swatch active" data-color="#ff5533" style="background: #ff5533"></div>
                    <div class="color-swatch" data-color="#FFD938" style="background: #FFD938"></div>
                    <div class="color-swatch" data-color="#1A2B49" style="background: #1A2B49"></div>
                    <div class="color-swatch" data-color="#81BEFF" style="background: #81BEFF"></div>
                    <div class="color-swatch" data-color="#A1D55D" style="background: #A1D55D"></div>
                    <div class="color-swatch" data-color="#F4CDD7" style="background: #F4CDD7"></div>
                    <div class="color-swatch" data-color="#000000" style="background: #000000"></div>
                    <div class="color-swatch" data-color="#ffffff" style="background: #ffffff; border: 2px solid #e5e7eb;"></div>
                </div>
                <div class="custom-color-section">
                    <input type="color" id="modal-color-picker" value="#ff5533" class="hidden-color-input">
                    <button class="custom-color-btn" onclick="document.getElementById('modal-color-picker').click()">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2l3.09 6.26L22 9l-5.91 5.89L18 21l-6-3.27L6 21l1.91-6.11L2 9l6.91-.74L12 2z"/>
                        </svg>
                        Custom
                    </button>
                </div>
            </div>
            
            <div class="floating-panel">
                <div class="panel-header">
                    <span class="panel-title">Padding</span>
                    <span class="panel-value" id="modal-padding-value">30px</span>
                </div>
                <div class="slider-container">
                    <input type="range" id="modal-padding-slider" min="0" max="100" step="1" value="30" class="floating-slider">
                    <div class="slider-track-fill" id="padding-track-fill"></div>
                </div>
            </div>
            
            <div class="floating-panel">
                <div class="panel-header">
                    <span class="panel-title">Outer Radius</span>
                    <span class="panel-value" id="modal-outer-radius-value">16px</span>
                </div>
                <div class="slider-container">
                    <input type="range" id="modal-outer-radius-slider" min="0" max="50" step="1" value="16" class="floating-slider">
                    <div class="slider-track-fill" id="outer-radius-track-fill"></div>
                </div>
            </div>
            
            <div class="floating-panel">
                <div class="panel-header">
                    <span class="panel-title">Inner Radius</span>
                    <span class="panel-value" id="modal-inner-radius-value">12px</span>
                </div>
                <div class="slider-container">
                    <input type="range" id="modal-inner-radius-slider" min="0" max="50" step="1" value="12" class="floating-slider">
                    <div class="slider-track-fill" id="inner-radius-track-fill"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.appendChild(floatingControls);
        
        // Load current settings
        chrome.storage.local.get('gloco_settings', (data) => {
            const settings = data.gloco_settings || { 
                color: '#ff5533', 
                padding: 30, 
                outerRadius: 16, 
                innerRadius: 12 
            };
            const colorPicker = floatingControls.querySelector('#modal-color-picker');
            const paddingSlider = floatingControls.querySelector('#modal-padding-slider');
            const paddingValue = floatingControls.querySelector('#modal-padding-value');
            const outerRadiusSlider = floatingControls.querySelector('#modal-outer-radius-slider');
            const outerRadiusValue = floatingControls.querySelector('#modal-outer-radius-value');
            const innerRadiusSlider = floatingControls.querySelector('#modal-inner-radius-slider');
            const innerRadiusValue = floatingControls.querySelector('#modal-inner-radius-value');
            
            colorPicker.value = settings.color;
            paddingSlider.value = settings.padding;
            paddingValue.textContent = settings.padding + 'px';
            outerRadiusSlider.value = settings.outerRadius || 16;
            outerRadiusValue.textContent = (settings.outerRadius || 16) + 'px';
            innerRadiusSlider.value = settings.innerRadius || 12;
            innerRadiusValue.textContent = (settings.innerRadius || 12) + 'px';
            
            // Initialize track fills
            this.updateTrackFill(paddingSlider, 'padding-track-fill');
            this.updateTrackFill(outerRadiusSlider, 'outer-radius-track-fill');
            this.updateTrackFill(innerRadiusSlider, 'inner-radius-track-fill');
            
            // Set active swatch
            this.setActiveSwatch(floatingControls, settings.color);
            
            // Set up real-time editing
            this.setupModalEditing(modal, floatingControls);
        });
        
        // Event listeners for main actions
        const closeBtn = modal.querySelector('.gloco-close-btn');
        const downloadBtn = modal.querySelector('#downloadBtn');
        const copyBtn = modal.querySelector('#copyBtn');
        
        closeBtn.addEventListener('click', () => this.closeModal(modal, imageUrl, floatingControls));
        downloadBtn.addEventListener('click', () => this.downloadCurrentImage(modal));
        copyBtn.addEventListener('click', () => this.copyCurrentImageToClipboard(modal));
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal, imageUrl, floatingControls);
            }
        });
        
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal, imageUrl, floatingControls);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }
    
    setActiveSwatch(floatingControls, color) {
        const swatches = floatingControls.querySelectorAll('.color-swatch');
        swatches.forEach(swatch => {
            swatch.classList.remove('active');
            if (swatch.dataset.color === color) {
                swatch.classList.add('active');
            }
        });
    }
    
    setupModalEditing(modal, floatingControls) {
        const colorPicker = floatingControls.querySelector('#modal-color-picker');
        const paddingSlider = floatingControls.querySelector('#modal-padding-slider');
        const paddingValue = floatingControls.querySelector('#modal-padding-value');
        const outerRadiusSlider = floatingControls.querySelector('#modal-outer-radius-slider');
        const outerRadiusValue = floatingControls.querySelector('#modal-outer-radius-value');
        const innerRadiusSlider = floatingControls.querySelector('#modal-inner-radius-slider');
        const innerRadiusValue = floatingControls.querySelector('#modal-inner-radius-value');
        const screenshotImg = modal.querySelector('.gloco-screenshot');
        const swatches = floatingControls.querySelectorAll('.color-swatch');
        
        let updateTimeout;
        let currentColor = colorPicker.value;
        
        const updateScreenshot = (color = currentColor) => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(async () => {
                const padding = parseInt(paddingSlider.value);
                const outerRadius = parseInt(outerRadiusSlider.value);
                const innerRadius = parseInt(innerRadiusSlider.value);
                
                // Regenerate the image with new settings
                const newImageUrl = await this.regenerateScreenshot(color, padding, outerRadius, innerRadius);
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
            paddingValue.textContent = e.target.value + 'px';
            this.updateTrackFill(paddingSlider, 'padding-track-fill');
            updateScreenshot();
        });
        
        outerRadiusSlider.addEventListener('input', (e) => {
            outerRadiusValue.textContent = e.target.value + 'px';
            this.updateTrackFill(outerRadiusSlider, 'outer-radius-track-fill');
            updateScreenshot();
        });
        
        innerRadiusSlider.addEventListener('input', (e) => {
            innerRadiusValue.textContent = e.target.value + 'px';
            this.updateTrackFill(innerRadiusSlider, 'inner-radius-track-fill');
            updateScreenshot();
        });
    }
    
    async regenerateScreenshot(color, padding, outerRadius, innerRadius) {
        try {
            if (!this.lastCapturedData) return null;
            
            const { imageUrl, croppedWidth, croppedHeight } = this.lastCapturedData;
            
            // Create canvas for regeneration
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Calculate final dimensions
            const finalWidth = croppedWidth + (padding * 2);
            const finalHeight = croppedHeight + (padding * 2);
            
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            
            // Apply outer radius to entire canvas if specified
            if (outerRadius > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(0, 0, finalWidth, finalHeight, outerRadius);
                ctx.clip();
            }
            
            // Fill background with color
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, finalWidth, finalHeight);
            
            // Load and draw the cropped image
            return new Promise((resolve) => {
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
                    
                    // Draw the image
                    ctx.drawImage(img, x, y, width, height);
                    
                    // Restore context state for inner radius
                    ctx.restore();
                    
                    // Restore outer radius clipping if it was applied
                    if (outerRadius > 0) {
                        ctx.restore();
                    }
                    
                    // Convert to blob and create URL
                    canvas.toBlob((blob) => {
                        const newImageUrl = URL.createObjectURL(blob);
                        resolve(newImageUrl);
                    }, 'image/png');
                };
                img.src = imageUrl;
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
    
    closeModal(modal, imageUrl, floatingControls) {
        modal.style.opacity = '0';
        setTimeout(() => {
            if (modal.parentNode) {
                document.body.removeChild(modal);
            }
            if (floatingControls && floatingControls.parentNode) {
                document.body.removeChild(floatingControls);
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

    async generateFinalScreenshot(screenshotDataUrl, selectionBox) {
        const { x, y, width, height } = selectionBox;
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas for cropping
                const cropCanvas = document.createElement('canvas');
                const cropCtx = cropCanvas.getContext('2d');
                
                // Calculate scale factors
                const scaleX = img.width / window.innerWidth;
                const scaleY = img.height / window.innerHeight;
                
                // Set crop canvas size to the selected area
                const croppedWidth = width;
                const croppedHeight = height;
                cropCanvas.width = croppedWidth;
                cropCanvas.height = croppedHeight;
                
                // Draw the cropped portion
                cropCtx.drawImage(
                    img,
                    x * scaleX, y * scaleY, width * scaleX, height * scaleY,
                    0, 0, croppedWidth, croppedHeight
                );
                
                // Get the cropped image as data URL
                const croppedImageUrl = cropCanvas.toDataURL('image/png');
                
                // Get current settings
                chrome.storage.local.get('gloco_settings', (data) => {
                    const settings = data.gloco_settings || { 
                        color: '#ff5533', 
                        padding: 30, 
                        outerRadius: 16, 
                        innerRadius: 12 
                    };
                    
                    // Create final canvas with padding and radius
                    const finalCanvas = document.createElement('canvas');
                    const finalCtx = finalCanvas.getContext('2d');
                    
                    const finalWidth = croppedWidth + (settings.padding * 2);
                    const finalHeight = croppedHeight + (settings.padding * 2);
                    
                    finalCanvas.width = finalWidth;
                    finalCanvas.height = finalHeight;
                    
                    // Apply outer radius to entire canvas if specified
                    if (settings.outerRadius > 0) {
                        finalCtx.save();
                        finalCtx.beginPath();
                        finalCtx.roundRect(0, 0, finalWidth, finalHeight, settings.outerRadius);
                        finalCtx.clip();
                    }
                    
                    // Fill background
                    finalCtx.fillStyle = settings.color;
                    finalCtx.fillRect(0, 0, finalWidth, finalHeight);
                    
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
                            finalCtx.roundRect(imageX, imageY, croppedWidth, croppedHeight, settings.innerRadius);
                            finalCtx.clip();
                        }
                        
                        // Draw the cropped image
                        finalCtx.drawImage(croppedImg, imageX, imageY, croppedWidth, croppedHeight);
                        
                        // Restore context state
                        finalCtx.restore();
                        
                        // Restore outer radius clipping if it was applied
                        if (settings.outerRadius > 0) {
                            finalCtx.restore();
                        }
                        
                        // Convert to blob and create URL
                        finalCanvas.toBlob((blob) => {
                            const finalImageUrl = URL.createObjectURL(blob);
                            
                            // Store data for regeneration
                            this.lastCapturedData = {
                                imageUrl: croppedImageUrl,
                                croppedWidth,
                                croppedHeight
                            };
                            
                            resolve(finalImageUrl);
                        }, 'image/png');
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
}

// Initialize the selector
if (!window.glocoSelector) {
    window.glocoSelector = new GlocoSelector();
} 