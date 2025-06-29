// Gloco-Helpers: Toast, Modal, and Utility Functions
if (typeof GlocoSelector === 'undefined') {
    throw new Error('GlocoSelector class must be defined before loading helpers.');
}

GlocoSelector.prototype.hexToRgba = function(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

GlocoSelector.prototype.roundRect = function(ctx, x, y, width, height, radius) {
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
};

GlocoSelector.prototype.showErrorModal = function(message) {
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
};

GlocoSelector.prototype.showToast = function(message) {
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
}; 