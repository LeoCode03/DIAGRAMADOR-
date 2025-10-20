function showNotification(message, type = 'info', duration = 3000) {
    let container = document.getElementById('notificationContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationContainer';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 350px;
        `;
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = `w3-card w3-padding w3-animate-top`;
    
    const colors = {
        success: { bg: '#00C9A7', text: 'white' },
        error: { bg: '#FF6B6B', text: 'white' },
        warning: { bg: '#FFB84D', text: 'white' },
        info: { bg: '#4DD4E8', text: 'white' }
    };
    
    const colorScheme = colors[type] || colors.info;
    notification.style.cssText = `
        background-color: ${colorScheme.bg};
        color: ${colorScheme.text};
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    `;
    
    notification.innerHTML = `
        <span style="flex: 1;">${message}</span>
        <button onclick="this.parentElement.remove()" 
                style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem; padding: 0; width: 24px; height: 24px;"
                aria-label="Cerrar notificación">&times;</button>
    `;
    
    container.appendChild(notification);
    
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
    
    return notification;
}

function showConfirmModal(message, onConfirm, onCancel = null) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        console.error('Modal de confirmación no encontrado');
        return;
    }
    
    const messageEl = document.getElementById('confirmMessage');
    const btnYes = document.getElementById('btnConfirmYes');
    const btnNo = document.getElementById('btnConfirmNo');
    
    messageEl.textContent = message;
    
    const newBtnYes = btnYes.cloneNode(true);
    const newBtnNo = btnNo.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtnYes, btnYes);
    btnNo.parentNode.replaceChild(newBtnNo, btnNo);
    
    newBtnYes.addEventListener('click', () => {
        closeConfirmModal();
        if (onConfirm) onConfirm();
    });
    
    newBtnNo.addEventListener('click', () => {
        closeConfirmModal();
        if (onCancel) onCancel();
    });
    
    modal.style.display = 'block';
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showCustomModal(title, content, buttons = [], showCloseButton = true) {
    let modal = document.getElementById('customModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customModal';
        modal.className = 'w3-modal';
        modal.innerHTML = `
            <div class="w3-modal-content w3-card-4 w3-animate-zoom" style="max-width: 500px;">
                <div class="w3-container" style="background-color: #00C1BA; color: white;">
                    <span id="customModalCloseBtn" class="w3-button w3-display-topright w3-hover-red" onclick="closeCustomModal()">&times;</span>
                    <h3 id="customModalTitle"></h3>
                </div>
                <div class="w3-container w3-padding" id="customModalContent"></div>
                <div class="w3-container w3-padding w3-center" id="customModalButtons"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('customModalTitle').textContent = title;
    document.getElementById('customModalContent').innerHTML = content;
    
    const closeBtn = document.getElementById('customModalCloseBtn');
    if (closeBtn) {
        closeBtn.style.display = showCloseButton ? 'block' : 'none';
    }
    
    const buttonsContainer = document.getElementById('customModalButtons');
    buttonsContainer.innerHTML = '';
    
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.textContent = btn.text;
        button.className = btn.class || 'w3-button w3-round w3-margin';
        if (btn.style) {
            button.setAttribute('style', btn.style);
        } else {
            button.style.backgroundColor = '#00C1BA';
            button.style.color = 'white';
        }
        button.addEventListener('click', () => {
            if (btn.onClick) btn.onClick();
            closeCustomModal();
        });
        buttonsContainer.appendChild(button);
    });
    
    modal.style.display = 'block';
}

function closeCustomModal() {
    const modal = document.getElementById('customModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showLoader(message = 'Cargando...') {
    let loader = document.getElementById('appLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'appLoader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;
        loader.innerHTML = `
            <div class="w3-card w3-white w3-padding-large w3-center" style="border-radius: 8px;">
                <div class="w3-spin" style="width: 50px; height: 50px; border: 5px solid #B3F0ED; border-top: 5px solid #00C1BA; border-radius: 50%; margin: 0 auto 15px;"></div>
                <p id="loaderMessage">${message}</p>
            </div>
        `;
        document.body.appendChild(loader);
    } else {
        document.getElementById('loaderMessage').textContent = message;
        loader.style.display = 'flex';
    }
    
    return loader;
}

function hideLoader() {
    const loader = document.getElementById('appLoader');
    if (loader) {
        loader.style.display = 'none';
    }
}

function showOptionsDialog(title, message, options, onSelect) {
    const content = `
        <p>${message}</p>
        <div class="w3-margin-top">
            ${options.map((opt, idx) => `
                <button class="${opt.class || 'w3-button w3-white w3-border w3-block w3-margin-bottom'}" 
                        ${opt.style ? `style="${opt.style}"` : ''}
                        data-value="${opt.value}" 
                        onclick="selectOption(${idx})">
                    ${opt.text}
                </button>
            `).join('')}
        </div>
    `;
    
    window._optionsDialogCallback = (index) => {
        if (onSelect && options[index]) {
            onSelect(options[index].value);
        }
        closeCustomModal();
    };
    
    showCustomModal(title, content, [], false);
}

function selectOption(index) {
    if (window._optionsDialogCallback) {
        window._optionsDialogCallback(index);
    }
}

function validateForm(form) {
    const inputs = form.querySelectorAll('[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('w3-border-red');
            isValid = false;
        } else {
            input.classList.remove('w3-border-red');
        }
    });
    
    return isValid;
}

function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Copiado al portapapeles', 'success', 2000);
    } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showNotification('Copiado al portapapeles', 'success', 2000);
        } catch (err) {
            showNotification('Error al copiar', 'error');
        }
        document.body.removeChild(textarea);
    }
}

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || window.innerWidth < 768;
}

function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

if (!document.getElementById('uiAnimations')) {
    const style = document.createElement('style');
    style.id = 'uiAnimations';
    style.textContent = `
        @keyframes fadeOut {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-10px);
            }
        }
        
        .w3-spin {
            animation: w3-spin 1s linear infinite;
        }
        
        @keyframes w3-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}
