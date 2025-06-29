// Gloco-Selector: Core Class and Selection Logic
class GlocoSelector {
    constructor() {
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        this.overlay = null;
        this.selectionBox = null;
        this.instructions = null;
        this.coordinates = null;
        this.lastCapturedData = null; // To store data for regeneration
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'startSelection') {
                this.startSelection();
                sendResponse({ success: true });
            }
        });
    }
    
    startSelection() {
        if (this.isSelecting) {
            this.cancelSelection();
        }
        
        this.isSelecting = true;
        this.createOverlay();
        this.showInstructions();
        
        document.documentElement.style.overflow = 'hidden';
    }
    
    createOverlay() {
        this.removeOverlay();
        
        const currentScrollX = window.scrollX || window.pageXOffset;
        const currentScrollY = window.scrollY || window.pageYOffset;
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'gloco-overlay';
        
        this.overlay.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.overlay.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.overlay.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.overlay.addEventListener('keydown', this.onKeyDown.bind(this));
        
        this.overlay.tabIndex = -1;
        document.body.appendChild(this.overlay);
        this.overlay.focus({ preventScroll: true });
        
        if (window.scrollX !== currentScrollX || window.scrollY !== currentScrollY) {
            window.scrollTo(currentScrollX, currentScrollY);
        }
    }
    
    showInstructions() {
        this.instructions = document.createElement('div');
        this.instructions.className = 'gloco-instructions';
        this.instructions.textContent = 'Click and drag to select an area • Press ESC to cancel';
        
        document.body.appendChild(this.instructions);
        
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
        
        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'gloco-selection-box';
        this.selectionBox.style.left = this.startX + 'px';
        this.selectionBox.style.top = this.startY + 'px';
        this.selectionBox.style.width = '0px';
        this.selectionBox.style.height = '0px';
        
        this.overlay.appendChild(this.selectionBox);
        
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

            const screenshotData = await this.captureTabScreenshot();
            
            const screenshotResult = await this.generateFinalScreenshot(screenshotData, { x, y, width, height });
            
            if (screenshotResult && screenshotResult.finalImageUrl) {
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
            chrome.runtime.sendMessage({ 
                action: 'captureTab',
                quality: 'highest'
            }, (response) => {
                if (response && response.dataUrl) {
                    resolve(response.dataUrl);
                } else {
                    reject(new Error('Failed to capture tab'));
                }
            });
        });
    }

    cancelSelection() {
        this.cleanup();
    }
    
    cleanup() {
        this.isSelecting = false;
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
} 