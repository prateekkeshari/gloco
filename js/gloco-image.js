// Gloco-Image: Image Processing and Generation
if (typeof GlocoSelector === 'undefined') {
    throw new Error('GlocoSelector class must be defined before loading image processor.');
}

GlocoSelector.prototype.generateFinalScreenshot = async function(screenshotDataUrl, selectionBox) {
    const { x, y, width, height } = selectionBox;
    
    return new Promise((resolve) => {
        const img = new Image();
        img.decode = img.decode || function() { return Promise.resolve(); };
        img.onload = async () => {
            await img.decode().catch(() => {});
            
            const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
            
            const cropCanvas = document.createElement('canvas');
            const cropCtx = cropCanvas.getContext('2d');
            
            cropCtx.imageSmoothingEnabled = true;
            cropCtx.imageSmoothingQuality = 'high';
            
            const scaleX = img.width / window.innerWidth;
            const scaleY = img.height / window.innerHeight;
            
            const croppedWidth = Math.round(width * pixelRatio);
            const croppedHeight = Math.round(height * pixelRatio);
            cropCanvas.width = croppedWidth;
            cropCanvas.height = croppedHeight;
            
            cropCanvas.style.width = width + 'px';
            cropCanvas.style.height = height + 'px';
            
            cropCtx.scale(pixelRatio, pixelRatio);
            
            const sourceX = Math.round(x * scaleX);
            const sourceY = Math.round(y * scaleY);
            const sourceWidth = Math.round(width * scaleX);
            const sourceHeight = Math.round(height * scaleY);
            
            cropCtx.drawImage(
                img,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, width, height
            );
            
            const croppedImageUrl = cropCanvas.toDataURL('image/png', 1.0);
            
            chrome.storage.local.get('gloco_settings', (data) => {
                const settings = data.gloco_settings || { 
                    color: '#ff5533', 
                    padding: 50, 
                    outerRadius: 24,
                    innerRadius: 16
                };
                
                const finalCanvas = document.createElement('canvas');
                const finalCtx = finalCanvas.getContext('2d');
                
                finalCtx.imageSmoothingEnabled = true;
                finalCtx.imageSmoothingQuality = 'high';
                
                const finalWidth = Math.round((width + (settings.padding * 2)) * pixelRatio);
                const finalHeight = Math.round((height + (settings.padding * 2)) * pixelRatio);
                
                finalCanvas.width = finalWidth;
                finalCanvas.height = finalHeight;
                
                finalCanvas.style.width = (width + (settings.padding * 2)) + 'px';
                finalCanvas.style.height = (height + (settings.padding * 2)) + 'px';
                
                finalCtx.scale(pixelRatio, pixelRatio);
                
                const cssWidth = width + (settings.padding * 2);
                const cssHeight = height + (settings.padding * 2);
                
                if (settings.outerRadius > 0) {
                    finalCtx.save();
                    finalCtx.beginPath();
                    this.roundRect(0, 0, cssWidth, cssHeight, settings.outerRadius);
                    finalCtx.clip();
                }
                
                finalCtx.fillStyle = settings.color;
                finalCtx.fillRect(0, 0, cssWidth, cssHeight);
                
                const croppedImg = new Image();
                croppedImg.onload = () => {
                    finalCtx.save();
                    
                    const imageX = settings.padding;
                    const imageY = settings.padding;
                    
                    if (settings.innerRadius > 0) {
                        finalCtx.beginPath();
                        this.roundRect(imageX, imageY, width, height, settings.innerRadius);
                        finalCtx.clip();
                    }
                    
                    finalCtx.drawImage(croppedImg, imageX, imageY, width, height);
                    finalCtx.restore();
                    
                    if (settings.outerRadius > 0) {
                        finalCtx.restore();
                    }
                    
                    finalCanvas.toBlob((blob) => {
                        const finalImageUrl = URL.createObjectURL(blob);
                        
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
};

GlocoSelector.prototype.regenerateScreenshot = async function(color, padding, outerRadius, innerRadius, highQuality = false) {
    try {
        if (!this.lastCapturedData) return null;
        
        const { imageUrl, croppedWidth, croppedHeight } = this.lastCapturedData;
        
        const pixelRatio = Math.max(window.devicePixelRatio || 1, highQuality ? 2.5 : 2);
        
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            const cssWidth = croppedWidth + (padding * 2);
            const cssHeight = croppedHeight + (padding * 2);
            const finalWidth = Math.round(cssWidth * pixelRatio);
            const finalHeight = Math.round(cssHeight * pixelRatio);
            
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            
            canvas.style.width = cssWidth + 'px';
            canvas.style.height = cssHeight + 'px';
            
            ctx.scale(pixelRatio, pixelRatio);

            const cssWidthFinal = cssWidth;
            const cssHeightFinal = cssHeight;
            
            if (outerRadius > 0) {
                ctx.save();
                ctx.beginPath();
                this.roundRect(0, 0, cssWidthFinal, cssHeightFinal, outerRadius);
                ctx.clip();
            }
            
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, cssWidthFinal, cssHeightFinal);
            
            const img = new Image();
            img.onload = () => {
                ctx.save();
                
                const x = padding;
                const y = padding;
                const width = croppedWidth;
                const height = croppedHeight;
                
                if (innerRadius > 0) {
                    ctx.beginPath();
                    this.roundRect(x, y, width, height, innerRadius);
                    ctx.clip();
                }
                
                ctx.drawImage(img, x, y, width, height);
                ctx.restore();
                
                if (outerRadius > 0) {
                    ctx.restore();
                }
                
                canvas.toBlob((blob) => {
                    const newImageUrl = URL.createObjectURL(blob);
                    resolve(newImageUrl);
                }, 'image/png', 1.0);
            };
            img.src = imageUrl;
        });
    } catch (error) {
        console.error('Error regenerating screenshot:', error);
        return null;
    }
};

GlocoSelector.prototype.generateEnhancedScreenshot = async function(settings, highQuality = false) {
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
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            const padding = settings.padding * pixelRatio;
            const outerRadius = settings.outerRadius * pixelRatio;
            const innerRadius = settings.innerRadius * pixelRatio;
            
            canvas.width = (croppedWidth + settings.padding * 2) * pixelRatio;
            canvas.height = (croppedHeight + settings.padding * 2) * pixelRatio;
            
            ctx.save();
            this.roundRect(ctx, 0, 0, canvas.width, canvas.height, outerRadius);
            ctx.clip();
            
            if (settings.backgroundType === 'solid') {
                ctx.fillStyle = settings.backgroundColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
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
            
            ctx.save();
            this.roundRect(ctx, padding, padding, croppedWidth * pixelRatio, croppedHeight * pixelRatio, innerRadius);
            ctx.clip();
            
            if (settings.browserFrame) {
                const frameHeight = 28 * pixelRatio;
                const framePadding = 8 * pixelRatio;
                
                ctx.fillStyle = '#f6f6f6';
                ctx.fillRect(padding, padding, croppedWidth * pixelRatio, croppedHeight * pixelRatio + frameHeight + framePadding);
                
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(padding, padding, croppedWidth * pixelRatio, frameHeight);
                
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
                
                ctx.drawImage(img, padding, padding + frameHeight, croppedWidth * pixelRatio, croppedHeight * pixelRatio);
            } else {
                ctx.drawImage(img, padding, padding, croppedWidth * pixelRatio, croppedHeight * pixelRatio);
            }
            
            ctx.restore();
            
            resolve(canvas.toDataURL('image/png'));
        };
        
        img.src = imageUrl;
    });
}; 