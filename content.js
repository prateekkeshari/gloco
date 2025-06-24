// Send a message to the background script that the content script has loaded
chrome.runtime.sendMessage({ action: 'startSelectionFromContent' });

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
        
        const modal = document.createElement('div');
        modal.className = 'gloco-modal';
        
        modal.innerHTML = `
            <div class="gloco-modal-content">
                <button class="gloco-close-btn">×</button>
                <div class="gloco-screenshot-container">
                    <img src="${imageUrl}" alt="Screenshot" class="gloco-screenshot" />
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
        
        // Size the modal to fit the screenshot
        this.resizeModalToFitScreenshot(modal, imageUrl);
        
        // Load current settings
        chrome.storage.local.get('gloco_settings', (data) => {
            const settings = data.gloco_settings || { 
                color: '#ff5533', 
                padding: 30, 
                outerRadius: 16, 
                innerRadius: 12 
            };
            const colorPicker = document.createElement('input');
            colorPicker.type = 'hidden';
            colorPicker.id = 'modal-color-picker';
            colorPicker.value = settings.color;
            floatingControls.appendChild(colorPicker);
            
            const paddingSlider = floatingControls.querySelector('#modal-padding-slider');
            const paddingValue = floatingControls.querySelector('#modal-padding-value');
            const outerRadiusSlider = floatingControls.querySelector('#modal-outer-radius-slider');
            const outerRadiusValue = floatingControls.querySelector('#modal-outer-radius-value');
            const innerRadiusSlider = floatingControls.querySelector('#modal-inner-radius-slider');
            const innerRadiusValue = floatingControls.querySelector('#modal-inner-radius-value');
            
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
            this.setupModalEditing(modal, floatingControls, colorPicker);
        });
        
        // Event listeners for main actions
        const closeBtn = modal.querySelector('.gloco-close-btn');
        const downloadBtn = modal.querySelector('#downloadBtn');
        const copyBtn = modal.querySelector('#copyBtn');
        
        closeBtn.addEventListener('click', () => this.closeModal(modal, imageUrl, floatingControls));
        downloadBtn.addEventListener('click', () => {
            this.downloadCurrentImage(modal);
            this.showToast('Screenshot downloaded');
        });
        copyBtn.addEventListener('click', () => {
            // Change button text and disable temporarily
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Copied
            `;
            copyBtn.disabled = true;
            copyBtn.style.opacity = '0.8';
            
            this.copyCurrentImageToClipboard(modal);
            this.showToast('Copied to clipboard');
            
            // Revert button after 2 seconds
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.disabled = false;
                copyBtn.style.opacity = '1';
            }, 2000);
        });
        
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
        // Remove active class from all swatches
        const allSwatches = floatingControls.querySelectorAll('.color-swatch');
        allSwatches.forEach(swatch => swatch.classList.remove('active'));
        
        // Find and mark the matching swatch as active
        const matchingSwatch = Array.from(allSwatches).find(
            swatch => swatch.getAttribute('data-color').toLowerCase() === color.toLowerCase()
        );
        
        if (matchingSwatch) {
            matchingSwatch.classList.add('active');
        }
    }
    
    setupModalEditing(modal, floatingControls, colorPicker) {
        const paddingSlider = floatingControls.querySelector('#modal-padding-slider');
        const paddingValue = floatingControls.querySelector('#modal-padding-value');
        const outerRadiusSlider = floatingControls.querySelector('#modal-outer-radius-slider');
        const outerRadiusValue = floatingControls.querySelector('#modal-outer-radius-value');
        const innerRadiusSlider = floatingControls.querySelector('#modal-inner-radius-slider');
        const innerRadiusValue = floatingControls.querySelector('#modal-inner-radius-value');
        const screenshotImg = modal.querySelector('.gloco-screenshot');
        
        // Get initial values
        let currentColor = colorPicker.value;
        let currentPadding = parseInt(paddingSlider.value);
        let currentOuterRadius = parseInt(outerRadiusSlider.value);
        let currentInnerRadius = parseInt(innerRadiusSlider.value);
        
        let updateTimeout;
        
        const updateScreenshot = async (color = currentColor) => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(async () => {
                // Regenerate the image with new settings
                const newImageUrl = await this.regenerateScreenshot(color, currentPadding, currentOuterRadius, currentInnerRadius);
                if (newImageUrl) {
                    // Clean up old image URL
                    if (screenshotImg.src.startsWith('blob:')) {
                        URL.revokeObjectURL(screenshotImg.src);
                    }
                    screenshotImg.src = newImageUrl;
                    
                    // Resize modal to fit new screenshot
                    this.resizeModalToFitScreenshot(modal, newImageUrl);
                }
                
                // Save settings
                chrome.storage.local.set({
                    gloco_settings: {
                        color: color,
                        padding: currentPadding,
                        outerRadius: currentOuterRadius,
                        innerRadius: currentInnerRadius
                    }
                });
            }, 150);
        };
        
        // Color swatch selection
        const colorSwatches = floatingControls.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                const color = swatch.getAttribute('data-color');
                currentColor = color;
                colorPicker.value = color;
                
                // Update active swatch
                this.setActiveSwatch(floatingControls, color);
                
                // Update screenshot
                updateScreenshot(color);
            });
        });
        
        // Handle padding slider
        paddingSlider.addEventListener('input', (e) => {
            currentPadding = parseInt(e.target.value);
            paddingValue.textContent = `${currentPadding}px`;
            updateScreenshot();
            this.updateTrackFill(paddingSlider, 'padding-track-fill');
        });
        
        // Handle outer radius slider
        outerRadiusSlider.addEventListener('input', (e) => {
            currentOuterRadius = parseInt(e.target.value);
            outerRadiusValue.textContent = `${currentOuterRadius}px`;
            updateScreenshot();
            this.updateTrackFill(outerRadiusSlider, 'outer-radius-track-fill');
        });
        
        // Handle inner radius slider
        innerRadiusSlider.addEventListener('input', (e) => {
            currentInnerRadius = parseInt(e.target.value);
            innerRadiusValue.textContent = `${currentInnerRadius}px`;
            updateScreenshot();
            this.updateTrackFill(innerRadiusSlider, 'inner-radius-track-fill');
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
        // Remove any existing toasts
        const existingToasts = document.querySelectorAll('.gloco-toast');
        existingToasts.forEach(toast => toast.remove());
        
        // Create new toast
        const toast = document.createElement('div');
        toast.className = 'gloco-toast';
        toast.innerHTML = `
            <div class="gloco-toast-content">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
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

    resizeModalToFitScreenshot(modal, imageUrl) {
        const img = new Image();
        img.onload = () => {
            const modalContent = modal.querySelector('.gloco-modal-content');
            const actionsHeight = 70; // Height of the action buttons area
            
            // Set modal content size to match image + actions
            modalContent.style.width = img.width + 'px';
            modalContent.style.height = (img.height + actionsHeight) + 'px';
            modalContent.style.maxWidth = '90vw';
            modalContent.style.maxHeight = '90vh';
        };
        img.src = imageUrl;
    }
}

// Initialize the selector
if (!window.glocoSelector) {
    window.glocoSelector = new GlocoSelector();
} 