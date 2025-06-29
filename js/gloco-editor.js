// Gloco-Editor: Editor UI and Interaction Logic
if (typeof GlocoSelector === 'undefined') {
    throw new Error('GlocoSelector class must be defined before loading editor.');
}

GlocoSelector.prototype.showScreenshotModal = function(screenshotResult, width, height) {
    const { finalImageUrl, croppedImageUrl } = screenshotResult;
    
    const defaultSettings = {
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

    const colors = ['#FF5F57', '#FEBC2E', '#282F37', '#58ACF9', '#50C878', '#FFC1CC', '#000000', '#ffffff'];
    
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
                    <div class="control-section">
                        <div class="control-header">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"/></svg>
                            <span>Background</span>
                        </div>
                        <div class="toggle-section">
                            <div class="toggle-control">
                                <span class="toggle-label">Solid Colors</span>
                                <div class="toggle-switch active" data-toggle="background-type"></div>
                            </div>
                        </div>
                        <div class="color-swatches">
                            ${colors.map(color => `<button class="color-swatch ${color === defaultSettings.backgroundColor ? 'active' : ''}" style="background-color: ${color};" data-color="${color}"></button>`).join('')}
                        </div>
                        <div class="gradient-swatches" style="display: none;">
                            ${Object.entries(gradients).map(([name, gradient]) => `<button class="gradient-swatch ${name === defaultSettings.gradient ? 'active' : ''}" style="background: ${gradient};" data-gradient="${name}"></button>`).join('')}
                        </div>
                    </div>

                    <hr class="control-divider" />

                    <div class="control-section">
                        <div class="control-header">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
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

                    <div class="control-section">
                        <div class="control-header">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
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

                    <div class="control-section">
                        <div class="control-header">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
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

                    <div class="control-section">
                        <div class="control-header">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
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

                    <div class="control-section">
                        <div class="control-header">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
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

    this.setupEnhancedModalEditing(modal, defaultSettings, croppedImageUrl, width, height, gradients);
    
    const sidebar = modal.querySelector('.gloco-sidebar');
    const closeBtn = modal.querySelector('.gloco-close-btn');
    const downloadBtn = sidebar.querySelector('#downloadBtn');
    const copyBtn = sidebar.querySelector('#copyBtn');
    
    closeBtn.addEventListener('click', () => this.closeModal(modal, finalImageUrl, croppedImageUrl, null));
    
    downloadBtn.addEventListener('click', async () => {
        await this.downloadCurrentImage(modal);
        this.showToast('Screenshot downloaded');
    });
    
    copyBtn.addEventListener('click', async () => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.disabled = true;
        
        await this.copyCurrentImageToClipboard(modal);
        this.showToast('Copied to clipboard');
        
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.disabled = false;
        }, 2000);
    });
    
    modal.addEventListener('click', (e) => {
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
};

GlocoSelector.prototype.setupEnhancedModalEditing = function(modal, settings, croppedImageUrl, width, height, gradients) {
    const previewBackground = modal.querySelector('#gloco-preview-background');
    const screenshot = modal.querySelector('.gloco-screenshot');
    
    let currentSettings = { ...settings };

    const updatePreview = () => {
        if (currentSettings.backgroundType === 'solid') {
            previewBackground.style.background = currentSettings.backgroundColor;
        } else {
            previewBackground.style.background = gradients[currentSettings.gradient];
        }
        
        previewBackground.style.padding = currentSettings.padding + 'px';
        previewBackground.style.borderRadius = currentSettings.outerRadius + 'px';
        screenshot.style.borderRadius = currentSettings.innerRadius + 'px';
        
        if (currentSettings.shadowEnabled) {
            const shadowColor = this.hexToRgba(currentSettings.shadowColor, currentSettings.shadowOpacity);
            screenshot.style.boxShadow = `${currentSettings.shadowOffsetX}px ${currentSettings.shadowOffsetY}px ${currentSettings.shadowBlur}px ${shadowColor}`;
        } else {
            screenshot.style.boxShadow = 'none';
        }
        
        if (currentSettings.browserFrame) {
            if (!screenshot.parentElement.classList.contains('browser-frame')) {
                const frame = document.createElement('div');
                frame.className = 'browser-frame';
                frame.innerHTML = `
                    <div class="browser-header">
                        <div class="browser-controls">
                            <div class="browser-dot red"></div><div class="browser-dot yellow"></div><div class="browser-dot green"></div>
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

    modal.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            modal.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            currentSettings.backgroundColor = e.target.dataset.color;
            updatePreview();
        });
    });

    modal.querySelectorAll('.gradient-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            modal.querySelectorAll('.gradient-swatch').forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            currentSettings.gradient = e.target.dataset.gradient;
            updatePreview();
        });
    });

    modal.querySelectorAll('.toggle-switch').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const toggleType = e.target.dataset.toggle;
            e.target.classList.toggle('active');
            
            if (toggleType === 'background-type') {
                currentSettings.backgroundType = e.target.classList.contains('active') ? 'solid' : 'gradient';
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

    modal.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const setting = e.target.dataset.setting;
            let value = parseFloat(e.target.value);
            
            if (setting) {
                if (setting === 'shadowOpacity') {
                    currentSettings[setting] = value;
                    e.target.closest('.slider-control').querySelector('.slider-value').textContent = Math.round(value * 100) + '%';
                } else {
                    currentSettings[setting] = value;
                    e.target.closest('.slider-control').querySelector('.slider-value').textContent = value + 'px';
                }
            } else {
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

    modal.querySelectorAll('.color-picker-input').forEach(picker => {
        picker.addEventListener('input', (e) => {
            const setting = e.target.dataset.setting;
            currentSettings[setting] = e.target.value;
            updatePreview();
        });
    });

    modal.querySelectorAll('.resolution-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            modal.querySelectorAll('.resolution-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentSettings.exportResolution = e.target.dataset.resolution;
        });
    });

    const filenameInput = modal.querySelector('.filename-input');
    if (filenameInput) {
        filenameInput.addEventListener('input', (e) => {
            currentSettings.filename = e.target.value;
        });
    }

    modal._currentSettings = currentSettings;

    updatePreview();
};

GlocoSelector.prototype.downloadCurrentImage = async function(modal) {
    try {
        const settings = modal._currentSettings;
        const highQualityImageUrl = await this.generateEnhancedScreenshot(settings, true);
        
        if (highQualityImageUrl) {
            const link = document.createElement('a');
            link.href = highQualityImageUrl;
            link.download = `${settings.filename || 'screenshot'}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(highQualityImageUrl), 1000);
        }
    } catch (error) {
        console.error('Download failed:', error);
        this.showToast('Download failed. Please try again.');
    }
};

GlocoSelector.prototype.copyCurrentImageToClipboard = async function(modal) {
    try {
        const settings = modal._currentSettings;
        const finalImageUrl = await this.generateEnhancedScreenshot(settings, true);

        if (!finalImageUrl) throw new Error("Could not generate image for copying");

        const response = await fetch(finalImageUrl);
        const blob = await response.blob();
        
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        URL.revokeObjectURL(finalImageUrl);
        this.showToast('Screenshot copied to clipboard!');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        this.showToast('Failed to copy to clipboard');
    }
};

GlocoSelector.prototype.closeModal = function(modal, finalImageUrl, croppedImageUrl, controlPanel) {
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
        URL.revokeObjectURL(finalImageUrl);
        URL.revokeObjectURL(croppedImageUrl);
    }, 300);
};
