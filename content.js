// content.js
console.log('✅ ScriptOmail content script loaded on:', window.location.href);

// Écouter les événements de copie
document.addEventListener('copy', (e) => {
    console.log('📋 Événement de copie détecté!');

    // Méthode 1: Essayer de lire depuis clipboardData de l'événement (le plus fiable)
    let copiedText = '';

    if (e.clipboardData && e.clipboardData.getData) {
        try {
            copiedText = e.clipboardData.getData('text/plain');
            console.log('✅ Texte capturé via clipboardData:', copiedText ? `"${copiedText.substring(0, 50)}..."` : '(vide)');
        } catch (err) {
            console.warn('⚠️ Impossible de lire clipboardData:', err);
        }
    }

    // Méthode 2: Utiliser la sélection actuelle
    if (!copiedText || !copiedText.trim()) {
        let selection = document.getSelection().toString();
        console.log('Sélection capturée:', selection ? `"${selection.substring(0, 50)}..."` : '(vide)');
        copiedText = selection;
    }

    // Si on a du texte, l'envoyer immédiatement
    if (copiedText && copiedText.trim()) {
        console.log('✅ Envoi du texte copié au background script');
        chrome.runtime.sendMessage({ action: "text_copied", text: copiedText }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ Erreur lors de l\'envoi:', chrome.runtime.lastError.message);
            } else {
                console.log('✅ Message envoyé avec succès');
            }
        });
    } else {
        console.log('⚠️ Aucun texte capturé, essai avec clipboard API en dernier recours...');
        // Fallback: essayer de lire le presse-papiers après un court délai
        // Note: Ceci peut échouer si l'extension est rechargée
        setTimeout(async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) {
                    console.log('✅ Texte lu via clipboard API:', text.substring(0, 50) + '...');
                    chrome.runtime.sendMessage({ action: "text_copied", text: text }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('❌ Erreur lors de l\'envoi:', chrome.runtime.lastError.message);
                        } else {
                            console.log('✅ Message envoyé avec succès (clipboard API)');
                        }
                    });
                } else {
                    console.log('⚠️ Clipboard API retourne du vide aussi');
                }
            } catch (err) {
                console.error('❌ Impossible de lire le presse-papiers:', err);
            }
        }, 100); // Réduit à 100ms car on a déjà essayé les autres méthodes
    }
});

// Écouter les messages pour coller du texte
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "paste_text") {
        console.log('Demande de collage reçue:', request.text);
        insertTextAtCursor(request.text);
        sendResponse({ status: "success" });
    } else if (request.action === "show_large_display") {
        console.log('Demande d\'affichage en grand:', request.text);
        showLargeTextOverlay(request.text);
        sendResponse({ status: "success" });
    }
});

function insertTextAtCursor(text) {
    const activeElement = document.activeElement;

    if (!activeElement) {
        console.warn('Aucun élément actif pour coller le texte.');
        // Fallback: copier dans le clipboard et notifier l'utilisateur
        navigator.clipboard.writeText(text).then(() => {
            showPasteNotification('Texte copié ! Appuyez sur Cmd+V (ou Ctrl+V) pour coller.');
        });
        return;
    }

    console.log('Élément actif:', activeElement.tagName, activeElement.className);

    // Cas spécial 1: Google Docs - utiliser le clipboard avec notification
    if (window.location.hostname.includes('docs.google.com') &&
        (window.location.pathname.includes('/document/') ||
            activeElement.className.includes('docs-texteventtarget-iframe'))) {
        console.log('🔍 Google Docs détecté - copie dans le clipboard');

        // Google Docs a des protections strictes, on utilise le clipboard
        // et on crée une notification visible
        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = text;
        tempTextarea.style.position = 'fixed';
        tempTextarea.style.opacity = '0';
        tempTextarea.style.pointerEvents = 'none';
        document.body.appendChild(tempTextarea);
        tempTextarea.select();

        try {
            document.execCommand('copy');
            document.body.removeChild(tempTextarea);
            showPasteNotification('✅ Texte copié ! Cliquez dans le document et appuyez sur Cmd+V (ou Ctrl+V) pour coller.');
            console.log('✅ Texte copié dans le clipboard pour Google Docs');
        } catch (err) {
            document.body.removeChild(tempTextarea);
            console.error('❌ Erreur:', err);
            alert('Texte : ' + text + '\n\nCopiez ce texte manuellement.');
        }
        return;
    }

    // Cas spécial 2: Google Sheets - utiliser le clipboard avec notification
    if (window.location.hostname.includes('docs.google.com') && window.location.pathname.includes('/spreadsheets/')) {
        console.log('🔍 Google Sheets détecté - copie dans le clipboard');

        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = text;
        tempTextarea.style.position = 'fixed';
        tempTextarea.style.opacity = '0';
        tempTextarea.style.pointerEvents = 'none';
        document.body.appendChild(tempTextarea);
        tempTextarea.select();

        try {
            document.execCommand('copy');
            document.body.removeChild(tempTextarea);
            showPasteNotification('✅ Texte copié ! Étapes:\n1. Cliquez sur une cellule\n2. Appuyez sur Cmd+V (ou Ctrl+V)');
            console.log('✅ Texte copié dans le clipboard pour Google Sheets');
        } catch (err) {
            document.body.removeChild(tempTextarea);
            console.error('❌ Erreur:', err);
            alert('Texte : ' + text + '\n\nCopiez ce texte manuellement.');
        }
        return;
    }

    // Pour tous les autres sites : collage direct
    // Cas 1: Input ou Textarea
    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
        const start = activeElement.selectionStart || 0;
        const end = activeElement.selectionEnd || 0;
        const value = activeElement.value;

        activeElement.value = value.substring(0, start) + text + value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd = start + text.length;

        // Déclencher les événements pour les frameworks
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        activeElement.focus();
        console.log('✅ Texte inséré dans input/textarea');
    }
    // Cas 2: ContentEditable (Gmail, éditeurs riches)
    else if (activeElement.isContentEditable) {
        // Méthode 1: execCommand
        if (document.execCommand('insertText', false, text)) {
            console.log('✅ Texte inséré via execCommand');
        } else {
            // Méthode 2: Insertion manuelle via range
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(text));
                range.collapse(false);
                console.log('✅ Texte inséré via range');
            }
        }
        activeElement.focus();
    }
    // Cas 3: Aucun champ actif - chercher le dernier champ utilisé
    else {
        console.warn('Aucun champ de texte actif.');
        // Essayer de trouver un input ou textarea visible
        const inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
        let targetInput = null;

        for (let input of inputs) {
            const rect = input.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                targetInput = input;
                break;
            }
        }

        if (targetInput) {
            targetInput.focus();
            targetInput.value += text;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('✅ Texte inséré dans le premier champ trouvé');
        } else {
            console.warn('Aucun champ de texte trouvé, utilisation du clipboard');
            navigator.clipboard.writeText(text).then(() => {
                showPasteNotification('📋 Texte copié ! Appuyez sur Cmd+V pour coller.');
            });
        }
    }
}

function showPasteNotification(message) {
    // Créer une notification temporaire
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showLargeTextOverlay(text) {
    // Supprimer l'overlay existant s'il y en a un
    const existingOverlay = document.getElementById('scriptomail-large-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // Créer l'overlay avec fond plus transparent
    const overlay = document.createElement('div');
    overlay.id = 'scriptomail-large-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.65);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;

    // Créer le conteneur de texte
    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
        background: white;
        padding: 60px 80px;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        max-width: 90%;
        max-height: 80%;
        overflow: auto;
        text-align: center;
        animation: slideIn 0.4s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 30px;
    `;

    // Créer le texte
    const textElement = document.createElement('div');
    textElement.style.cssText = `
        font-size: 72px;
        font-weight: bold;
        color: #333;
        line-height: 1.3;
        word-wrap: break-word;
        font-family: 'Arial', sans-serif;
    `;
    textElement.textContent = text;

    // Créer le conteneur QR Code
    const qrContainer = document.createElement('div');
    qrContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    `;

    const qrTitle = document.createElement('div');
    qrTitle.style.cssText = `
        font-size: 16px;
        color: #666;
        font-weight: 600;
    `;
    qrTitle.textContent = '📱 Scannez pour copier le texte';

    const qrImage = document.createElement('img');
    // Utiliser l'API QR Code gratuite
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
    qrImage.src = qrCodeUrl;
    qrImage.style.cssText = `
        width: 200px;
        height: 200px;
        border: 3px solid #333;
        border-radius: 10px;
    `;
    qrImage.alt = 'QR Code';

    qrContainer.appendChild(qrTitle);
    qrContainer.appendChild(qrImage);

    // Créer le bouton de fermeture
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕ Fermer';
    closeButton.style.cssText = `
        position: absolute;
        top: 30px;
        right: 30px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 15px 30px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
    `;
    closeButton.onmouseover = () => {
        closeButton.style.background = '#d32f2f';
        closeButton.style.transform = 'scale(1.05)';
    };
    closeButton.onmouseout = () => {
        closeButton.style.background = '#f44336';
        closeButton.style.transform = 'scale(1)';
    };
    closeButton.onclick = () => overlay.remove();

    // Ajouter les styles d'animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // Assembler l'overlay
    textContainer.appendChild(textElement);
    textContainer.appendChild(qrContainer);
    overlay.appendChild(textContainer);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);

    // Fermer avec Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Fermer en cliquant sur le fond
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    console.log('✅ Overlay affiché avec le texte:', text);
}

