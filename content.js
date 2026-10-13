// content.js
const isTopFrame = (window === window.top);
console.log(`✅ ToolWeb content script loaded on: ${window.location.href} (${isTopFrame ? 'top frame' : 'iframe'})`);

// ========================================
// SIDEBAR INJECTÉE (comme Hypothesis)
// ========================================

let sidebarContainer = null;
let sidebarIframe = null;
let sidebarExpanded = false;

function createSidebar() {
    if (sidebarContainer) {
        console.log('⚠️ Sidebar déjà créée');
        return;
    }

    console.log('🏗️ Création de la sidebar injectée...');

    // Créer le conteneur principal
    sidebarContainer = document.createElement('div');
    sidebarContainer.id = 'toolweb-sidebar-container';
    sidebarContainer.className = 'collapsed'; // Commence réduite

    // Créer l'iframe qui contiendra sidepanel.html
    sidebarIframe = document.createElement('iframe');
    sidebarIframe.id = 'toolweb-sidebar-iframe';
    sidebarIframe.src = chrome.runtime.getURL('sidepanel.html');
    sidebarIframe.allow = 'clipboard-read; clipboard-write; microphone';

    // Créer le bouton toggle sur la barre réduite (lignes horizontales pour agrandir)
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'toolweb-sidebar-toggle';
    toggleBtn.innerHTML = '<span class="line-h"></span><span class="line-h"></span>';
    toggleBtn.title = 'Cliquez pour agrandir ToolWeb';

    // Créer le bouton de réduction (externe, déborde à gauche)
    const collapseBtn = document.createElement('button');
    collapseBtn.id = 'toolweb-collapse-btn';
    collapseBtn.innerHTML = '<span class="line-v"></span><span class="line-v"></span>';
    collapseBtn.title = 'Réduire la sidebar';
    collapseBtn.style.cssText = `
        position: fixed;
        top: 12px;
        right: 476px;
        transform: translateX(50%);
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        cursor: pointer;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: row;
        gap: 4px;
        padding: 0;
        opacity: 0;
        pointer-events: none;
    `;

    collapseBtn.onmouseover = () => {
        collapseBtn.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.6)';
        collapseBtn.style.transform = 'translateX(50%) scale(1.1)';
    };
    collapseBtn.onmouseout = () => {
        collapseBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        collapseBtn.style.transform = 'translateX(50%) scale(1)';
    };
    collapseBtn.onclick = () => collapseSidebar();

    // Ajouter les styles pour les lignes verticales
    const style = document.createElement('style');
    style.textContent = `
        #toolweb-collapse-btn .line-v {
            width: 2px;
            height: 18px;
            background: white;
            border-radius: 1px;
        }
    `;
    document.head.appendChild(style);

    // Assembler
    sidebarContainer.appendChild(sidebarIframe);
    sidebarContainer.appendChild(toggleBtn);
    document.body.appendChild(sidebarContainer);
    document.body.appendChild(collapseBtn);

    // Stocker la référence au bouton
    window.toolwebCollapseBtn = collapseBtn;

    // Ajouter l'animation de première apparition
    sidebarContainer.classList.add('first-show');
    setTimeout(() => sidebarContainer.classList.remove('first-show'), 300);

    // Gérer le clic sur la barre réduite pour agrandir
    sidebarContainer.addEventListener('click', function(e) {
        if (sidebarContainer.classList.contains('collapsed')) {
            expandSidebar();
        }
    });

    console.log('✅ Sidebar créée et injectée');
}

function toggleSidebar() {
    if (!sidebarContainer) {
        createSidebar();
        // Par défaut, on l'affiche agrandie au premier clic
        setTimeout(() => expandSidebar(), 100);
    } else {
        // Si elle existe, toggle entre agrandi/réduit
        if (sidebarExpanded) {
            collapseSidebar();
        } else {
            expandSidebar();
        }
    }
}

function expandSidebar() {
    if (!sidebarContainer) return;

    console.log('📈 Agrandissement de la sidebar');
    sidebarContainer.classList.remove('collapsed');
    sidebarContainer.classList.add('expanded');
    sidebarExpanded = true;

    // Afficher le bouton de réduction externe
    if (window.toolwebCollapseBtn) {
        window.toolwebCollapseBtn.style.opacity = '1';
        window.toolwebCollapseBtn.style.pointerEvents = 'auto';
    }
}

function collapseSidebar() {
    if (!sidebarContainer) return;

    console.log('📉 Réduction de la sidebar');
    sidebarContainer.classList.remove('expanded');
    sidebarContainer.classList.add('collapsed');
    sidebarExpanded = false;

    // Masquer le bouton de réduction externe
    if (window.toolwebCollapseBtn) {
        window.toolwebCollapseBtn.style.opacity = '0';
        window.toolwebCollapseBtn.style.pointerEvents = 'none';
    }
}

function removeSidebar() {
    if (sidebarContainer) {
        console.log('🗑️ Suppression de la sidebar');
        sidebarContainer.remove();
        sidebarContainer = null;
        sidebarIframe = null;
        sidebarExpanded = false;
    }

    // Supprimer aussi le bouton de réduction externe
    if (window.toolwebCollapseBtn) {
        window.toolwebCollapseBtn.remove();
        window.toolwebCollapseBtn = null;
    }
}

// ========================================
// FIN SIDEBAR INJECTÉE
// ========================================

// ========================================
// TUTO GIF 🎬 : bande Stop, réouverture, aperçu en grand
// ========================================
// Pendant l'enregistrement, la barre latérale est masquée et remplacée par une bande
// étroite (Stop + chrono). Elle apparaît dans tous les onglets, y compris après un
// changement de page, car l'état est lu dans chrome.storage.session.

let gifBand = null;
let gifBandTimer = null;

function showGifBand(recording) {
    document.documentElement.classList.add('toolweb-gif-recording');

    if (!gifBand) {
        gifBand = document.createElement('div');
        gifBand.id = 'toolweb-gif-band';
        gifBand.innerHTML = `
            <button id="toolweb-gif-stop" title="Arrêter l'enregistrement"><span></span></button>
            <span id="toolweb-gif-dot"></span>
            <span id="toolweb-gif-timer">0:00</span>
        `;
        gifBand.querySelector('#toolweb-gif-stop').addEventListener('click', () => {
            console.log('⏹️ Stop demandé depuis la bande');
            chrome.runtime.sendMessage({ action: 'gif_stop' });
        });
        document.body.appendChild(gifBand);
    }

    clearInterval(gifBandTimer);
    const timer = gifBand.querySelector('#toolweb-gif-timer');
    gifBand.classList.toggle('finalizing', !!recording.finalizing);
    if (recording.finalizing) {
        timer.textContent = '⏳';
        return;
    }
    const tick = () => {
        const elapsed = Date.now() - recording.startedAt;
        if (elapsed < 0) {
            timer.textContent = String(Math.ceil(-elapsed / 1000)); // compte à rebours
            return;
        }
        const seconds = Math.floor(elapsed / 1000);
        timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    };
    tick();
    gifBandTimer = setInterval(tick, 500);
}

function hideGifBand() {
    clearInterval(gifBandTimer);
    document.documentElement.classList.remove('toolweb-gif-recording');
    if (gifBand) {
        gifBand.remove();
        gifBand = null;
    }
}

// GIF prêt : la barre latérale réapparaît, ouverte sur l'onglet 🎬
function openSidebarOnGifSection() {
    const showGifSection = () => {
        sidebarIframe.contentWindow.postMessage({ type: 'toolweb_show_section', section: 'gif' }, '*');
    };
    if (!sidebarContainer) {
        createSidebar();
        sidebarIframe.addEventListener('load', showGifSection, { once: true });
        setTimeout(() => expandSidebar(), 100);
    } else {
        expandSidebar();
        showGifSection();
    }
}

// Aperçu en grand : une page de l'extension en plein écran par-dessus le site
function showGifPreview(key) {
    closeGifPreview();
    const viewer = document.createElement('iframe');
    viewer.id = 'toolweb-gif-preview';
    viewer.src = chrome.runtime.getURL('gif-viewer.html') + '?key=' + encodeURIComponent(key);
    viewer.addEventListener('load', () => viewer.focus(), { once: true });
    document.body.appendChild(viewer);
}

function closeGifPreview() {
    const viewer = document.getElementById('toolweb-gif-preview');
    if (viewer) viewer.remove();
}

// --- Habillage du GIF : compte à rebours, halo de clic, curseur simulé ---

let gifState = null;          // enregistrement en cours (copie de chrome.storage.session), ou null
let gifCountdownEl = null;
let gifCountdownTimer = null;
let gifCursorEl = null;

function gifIsFilming() {
    return gifState && !gifState.finalizing && Date.now() >= gifState.startedAt;
}

// Grand 3-2-1 au centre de la page ; retiré juste avant le début pour ne pas être filmé
function showGifCountdown(recording) {
    hideGifCountdown();
    if (Date.now() >= recording.startedAt || document.visibilityState !== 'visible') return;

    gifCountdownEl = document.createElement('div');
    gifCountdownEl.id = 'toolweb-gif-countdown';
    document.body.appendChild(gifCountdownEl);

    const tick = () => {
        const remaining = recording.startedAt - Date.now();
        if (remaining <= 250) {
            hideGifCountdown();
            return;
        }
        gifCountdownEl.textContent = String(Math.ceil(remaining / 1000));
    };
    tick();
    gifCountdownTimer = setInterval(tick, 50);
}

function hideGifCountdown() {
    clearInterval(gifCountdownTimer);
    if (gifCountdownEl) {
        gifCountdownEl.remove();
        gifCountdownEl = null;
    }
}

// Halo : cercle orange qui s'élargit à l'endroit du clic (dans chaque cadre de la page)
document.addEventListener('mousedown', (event) => {
    if (!gifIsFilming() || !gifState.halo) return;
    const halo = document.createElement('div');
    halo.className = 'toolweb-gif-halo';
    halo.style.left = `${event.clientX}px`;
    halo.style.top = `${event.clientY}px`;
    document.documentElement.appendChild(halo);
    setTimeout(() => halo.remove(), 700);
}, true);

// Curseur simulé (mode Onglet seulement : Chrome n'y filme pas le vrai curseur)
function createGifCursor() {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '28');
    svg.setAttribute('viewBox', '0 0 22 28');
    const arrow = document.createElementNS(svgNS, 'path');
    arrow.setAttribute('d', 'M2 2 L2 22 L7.5 17 L11 25.5 L14.5 24 L11 15.8 L18.5 15.8 Z');
    arrow.setAttribute('fill', 'white');
    arrow.setAttribute('stroke', 'black');
    arrow.setAttribute('stroke-width', '1.6');
    arrow.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(arrow);

    gifCursorEl = document.createElement('div');
    gifCursorEl.id = 'toolweb-gif-cursor';
    gifCursorEl.appendChild(svg);
    document.documentElement.appendChild(gifCursorEl);
}

function removeGifCursor() {
    if (gifCursorEl) {
        gifCursorEl.remove();
        gifCursorEl = null;
    }
}

document.addEventListener('mousemove', (event) => {
    if (!gifState || gifState.finalizing || gifState.mode !== 'tab') return;
    if (!gifCursorEl) createGifCursor();
    gifCursorEl.style.display = 'block';
    gifCursorEl.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
}, true);

// La souris quitte ce cadre (vers un autre cadre ou hors de la page) : on cache sa flèche
document.addEventListener('mouseout', (event) => {
    if (gifCursorEl && !event.relatedTarget) gifCursorEl.style.display = 'none';
}, true);

// Applique l'état de l'enregistrement dans ce cadre (bande et décompte : page principale seulement)
function applyGifState(recording) {
    gifState = recording || null;
    if (!gifState || gifState.finalizing || gifState.mode !== 'tab') removeGifCursor();
    if (!isTopFrame) return;
    if (gifState) {
        showGifBand(gifState);
        if (!gifState.finalizing) showGifCountdown(gifState);
        else hideGifCountdown();
    } else {
        hideGifBand();
        hideGifCountdown();
    }
}

chrome.storage.session.get('gifRecording')
    .then((result) => applyGifState(result.gifRecording))
    .catch(() => { /* accès pas encore ouvert par background.js : rien en cours */ });

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.gifRecording) applyGifState(changes.gifRecording.newValue);
});

// ========================================
// FIN TUTO GIF
// ========================================

// ========================================
// TRADUCTION RAPIDE
// ========================================

let translationEnabled = false;
let sourceLang = 'auto';
let targetLang = 'fr';
let selectedWords = new Set();
let translations = new Map();

function enableTranslation(settings) {
    console.log('🌐 Activation de la traduction avec paramètres:', settings);
    translationEnabled = true;
    sourceLang = settings.sourceLang || 'auto';
    targetLang = settings.targetLang || 'fr';
    // Changer le curseur en point d'interrogation
    document.body.classList.add('toolweb-translation-active');
}

function disableTranslation() {
    console.log('🌐 Désactivation de la traduction');
    translationEnabled = false;
    clearAllTranslations();
    // Remettre le curseur par défaut
    document.body.classList.remove('toolweb-translation-active');
}

function clearAllTranslations() {
    const elementsToClean = Array.from(selectedWords);

    elementsToClean.forEach(wordElement => {
        const translationElement = wordElement.querySelector('.toolweb-translation');
        if (translationElement) {
            translationElement.remove();
        }

        wordElement.classList.remove('toolweb-word-selected');
        wordElement.removeAttribute('data-group');

        if (wordElement.parentNode) {
            const parent = wordElement.parentNode;
            while (wordElement.firstChild) {
                parent.insertBefore(wordElement.firstChild, wordElement);
            }
            parent.removeChild(wordElement);
        }
    });

    selectedWords.clear();
    translations.clear();
    console.log('✅ Toutes les traductions supprimées');
}

function getWordAtPosition(e) {
    let textNode, offset;

    // Chrome/Edge: caretRangeFromPoint, Firefox: caretPositionFromPoint
    if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!range) return null;
        textNode = range.startContainer;
        offset = range.startOffset;
    } else if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (!pos) return null;
        textNode = pos.offsetNode;
        offset = pos.offset;
    } else {
        return null;
    }

    if (textNode.nodeType !== Node.TEXT_NODE) return null;

    const text = textNode.textContent;

    // Regex qui supporte les caractères Unicode (accents, œ, etc.) et les apostrophes
    const wordRegex = /[\p{L}\p{M}'']+/gu;
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
        if (offset >= match.index && offset <= match.index + match[0].length) {
            return {
                text: match[0],
                node: textNode,
                start: match.index,
                end: match.index + match[0].length
            };
        }
    }

    return null;
}

function wrapWord(wordInfo) {
    const wrapper = document.createElement('span');
    wrapper.className = 'toolweb-word';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';

    const range = document.createRange();
    range.setStart(wordInfo.node, wordInfo.start);
    range.setEnd(wordInfo.node, wordInfo.end);

    try {
        range.surroundContents(wrapper);
        return wrapper;
    } catch (e) {
        const wordText = wordInfo.text;
        const textBefore = wordInfo.node.textContent.substring(0, wordInfo.start);
        const textAfter = wordInfo.node.textContent.substring(wordInfo.end);

        wrapper.textContent = wordText;

        const parent = wordInfo.node.parentNode;
        const beforeNode = document.createTextNode(textBefore);
        const afterNode = document.createTextNode(textAfter);

        parent.insertBefore(beforeNode, wordInfo.node);
        parent.insertBefore(wrapper, wordInfo.node);
        parent.insertBefore(afterNode, wordInfo.node);
        parent.removeChild(wordInfo.node);

        return wrapper;
    }
}

function areElementsAdjacent(elem1, elem2, allowedElements = []) {
    // Vérifier si deux éléments sont adjacents (pas d'autre mot entre eux)
    const parent1 = elem1.parentNode;
    const parent2 = elem2.parentNode;

    // Doivent avoir le même parent pour être adjacents
    if (parent1 !== parent2) return false;

    const allNodes = Array.from(parent1.childNodes);
    const index1 = allNodes.indexOf(elem1);
    const index2 = allNodes.indexOf(elem2);

    if (index1 === -1 || index2 === -1) return false;

    const startIndex = Math.min(index1, index2);
    const endIndex = Math.max(index1, index2);

    // Vérifier les nœuds entre les deux éléments
    for (let i = startIndex + 1; i < endIndex; i++) {
        const node = allNodes[i];

        // Si c'est un nœud texte, vérifier qu'il ne contient que des espaces
        if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent.trim().length > 0) {
                // Il y a du texte (un mot) entre les deux
                return false;
            }
        }
        // Si c'est un élément
        else if (node.nodeType === Node.ELEMENT_NODE) {
            // Si c'est un toolweb-word, vérifier s'il fait partie des éléments autorisés
            if (node.classList && node.classList.contains('toolweb-word')) {
                // Si ce n'est pas dans la liste des éléments autorisés (du groupe actuel)
                if (!allowedElements.includes(node)) {
                    // Il y a un autre mot entre les deux
                    return false;
                }
            }
            // Si c'est un autre élément avec du contenu, ils ne sont pas adjacents
            else if (node.textContent.trim().length > 0) {
                return false;
            }
        }
    }

    return true;
}

function findWordsOnSameLine(newElement) {
    const newRect = newElement.getBoundingClientRect();
    const candidateWords = [];

    // Trouver tous les mots sur la même ligne
    selectedWords.forEach(element => {
        if (element !== newElement) {
            const elementRect = element.getBoundingClientRect();

            // Vérifier si sur la même ligne (tolérance de 20px)
            const heightOverlap = Math.abs(newRect.top - elementRect.top) < 20;

            if (heightOverlap) {
                candidateWords.push({
                    element: element,
                    left: elementRect.left,
                    text: extractWordText(element)
                });
            }
        }
    });

    // Si aucun mot sur la même ligne, retourner vide
    if (candidateWords.length === 0) return [];

    // Construire le groupe de mots adjacents
    const adjacentGroup = [];
    const allElements = [newElement, ...candidateWords.map(w => w.element)];

    // Trier par position horizontale
    allElements.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return rectA.left - rectB.left;
    });

    // Trouver la position du nouveau mot dans la séquence
    const newElementIndex = allElements.indexOf(newElement);

    // Construire le groupe en vérifiant l'adjacence
    const group = [newElement];

    // Vérifier à gauche
    for (let i = newElementIndex - 1; i >= 0; i--) {
        const currentGroup = [...group, allElements[i]];
        if (areElementsAdjacent(allElements[i], allElements[i + 1], currentGroup)) {
            group.unshift(allElements[i]);
        } else {
            break; // Arrêter si pas adjacent
        }
    }

    // Vérifier à droite
    for (let i = newElementIndex + 1; i < allElements.length; i++) {
        const currentGroup = [...group, allElements[i]];
        if (areElementsAdjacent(allElements[i - 1], allElements[i], currentGroup)) {
            group.push(allElements[i]);
        } else {
            break; // Arrêter si pas adjacent
        }
    }

    // Retourner uniquement les mots du groupe (sans le nouveau mot)
    return group
        .filter(el => el !== newElement)
        .map(el => ({
            element: el,
            left: el.getBoundingClientRect().left,
            text: extractWordText(el)
        }));
}

function extractWordText(element) {
    // Extraire juste le mot, pas la traduction
    const childNodes = Array.from(element.childNodes);
    for (let node of childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            return node.textContent.trim();
        }
    }
    return element.textContent.replace(/\n.*/, '').trim();
}

async function createGroupTranslation(newElement, sameLineWords) {
    // Ajouter le nouveau mot
    const allWords = [...sameLineWords, {
        element: newElement,
        left: newElement.getBoundingClientRect().left,
        text: newElement.textContent.trim()
    }];

    // Trier de gauche à droite
    allWords.sort((a, b) => a.left - b.left);

    // Créer la phrase complète
    const completeText = allWords.map(w => w.text).join(' ');
    console.log('🌐 Texte complet à traduire:', completeText);

    // Supprimer TOUTES les traductions existantes
    allWords.forEach(word => {
        const existingTranslation = word.element.querySelector('.toolweb-translation');
        if (existingTranslation) {
            existingTranslation.remove();
            console.log('🗑️ Suppression traduction existante pour:', word.text);
        }
        word.element.classList.remove('toolweb-word-selected');
        word.element.removeAttribute('data-group');
        selectedWords.delete(word.element);
    });

    // Ajouter UNE SEULE nouvelle traduction sur le premier mot
    const firstElement = allWords[0].element;
    console.log('✨ Ajout traduction sur le premier élément:', allWords[0].text);

    await addTranslation(firstElement, completeText);

    // Marquer tous les éléments comme sélectionnés
    allWords.forEach((word, index) => {
        word.element.classList.add('toolweb-word-selected');
        selectedWords.add(word.element);

        if (index > 0) {
            word.element.setAttribute('data-group', 'true');
        }
    });
}

async function translateText(text) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data && data[0] && data[0][0] && data[0][0][0]) {
            return data[0][0][0];
        } else {
            throw new Error('Réponse invalide');
        }
    } catch (error) {
        throw new Error('Erreur de traduction');
    }
}

function checkAndAdjustTranslationPosition(translationElement, wordElement) {
    // Attendre que le DOM soit mis à jour
    setTimeout(() => {
        let verticalOffset = -22; // Position par défaut
        let hasOverlap = true;
        let maxAttempts = 5; // Limite pour éviter boucle infinie
        let attempts = 0;

        while (hasOverlap && attempts < maxAttempts) {
            hasOverlap = false;
            translationElement.style.top = `${verticalOffset}px`;

            const rect = translationElement.getBoundingClientRect();

            // Vérifier les chevauchements avec d'autres traductions
            translations.forEach((otherTranslation, otherWord) => {
                if (otherTranslation !== translationElement && otherWord !== wordElement) {
                    const otherRect = otherTranslation.getBoundingClientRect();

                    // Vérifier le chevauchement horizontal
                    const horizontalOverlap = !(rect.right < otherRect.left || rect.left > otherRect.right);

                    // Vérifier le chevauchement vertical (avec marge de 2px)
                    const verticalOverlap = !(rect.bottom + 2 < otherRect.top || rect.top - 2 > otherRect.bottom);

                    if (horizontalOverlap && verticalOverlap) {
                        hasOverlap = true;
                    }
                }
            });

            if (hasOverlap) {
                verticalOffset -= 24; // Déplacer vers le haut
                attempts++;
            }
        }

        if (attempts > 0) {
            console.log(`📍 Traduction repositionnée à ${verticalOffset}px pour éviter chevauchement`);
        }
    }, 100);
}

async function addTranslation(wordElement, text) {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'toolweb-translation toolweb-translation-loading';
    loadingElement.textContent = '...';
    wordElement.appendChild(loadingElement);

    try {
        const translation = await translateText(text);
        loadingElement.remove();

        const translationElement = document.createElement('div');
        translationElement.className = 'toolweb-translation';
        translationElement.textContent = translation;

        wordElement.appendChild(translationElement);
        wordElement.classList.add('toolweb-word-selected');

        selectedWords.add(wordElement);
        translations.set(wordElement, translationElement);

        // Vérifier et ajuster la position pour éviter les chevauchements
        checkAndAdjustTranslationPosition(translationElement, wordElement);

    } catch (error) {
        loadingElement.textContent = '❌';
        loadingElement.className = 'toolweb-translation toolweb-translation-error';
        console.error('Erreur de traduction:', error);
    }
}

function removeTranslation(translationElement) {
    const wordElement = translationElement.parentElement;

    // Trouver tous les éléments du groupe
    const groupElements = [wordElement];

    // Si c'est un élément principal du groupe, trouver tous les éléments liés
    selectedWords.forEach(element => {
        if (element !== wordElement &&
            (element.hasAttribute('data-group') ||
             wordElement.hasAttribute('data-group'))) {
            groupElements.push(element);
        }
    });

    // Nettoyer tous les éléments du groupe
    groupElements.forEach(element => {
        const translation = element.querySelector('.toolweb-translation');
        if (translation) {
            translation.remove();
        }

        element.classList.remove('toolweb-word-selected');
        element.removeAttribute('data-group');
        selectedWords.delete(element);
        translations.delete(element);

        // Déwrapper si nécessaire
        if (element.children.length === 0) {
            const parent = element.parentNode;
            if (parent && element.parentNode) {
                while (element.firstChild) {
                    parent.insertBefore(element.firstChild, element);
                }
                parent.removeChild(element);
            }
        }
    });
}

async function handleWordClick(wordInfo, event) {
    event.preventDefault();
    event.stopPropagation();

    // Créer le wrapper pour le nouveau mot
    const newWrapper = wrapWord(wordInfo);

    // Chercher TOUS les mots déjà traduits sur la même ligne
    const sameLineWords = findWordsOnSameLine(newWrapper);

    if (sameLineWords.length > 0) {
        console.log('🔗 Mots trouvés sur la même ligne:', sameLineWords.map(w => w.text));
        // Fusionner avec les mots de la même ligne
        await createGroupTranslation(newWrapper, sameLineWords);
    } else {
        // Mot isolé
        await addTranslation(newWrapper, wordInfo.text);
    }
}

// Gestionnaire de clic pour la traduction
document.addEventListener('click', async function(e) {
    if (!translationEnabled) return;

    const target = e.target;

    // Si on clique sur une traduction, la supprimer
    if (target.classList.contains('toolweb-translation')) {
        removeTranslation(target);
        return;
    }

    // Si on clique sur un mot déjà traduit
    if (target.classList.contains('toolweb-word') &&
        target.querySelector('.toolweb-translation')) {
        removeTranslation(target.querySelector('.toolweb-translation'));
        return;
    }

    // Obtenir le mot cliqué
    const word = getWordAtPosition(e);
    if (word) {
        await handleWordClick(word, e);
    }
}, true); // useCapture = true pour capturer en premier

// ========================================
// FIN TRADUCTION RAPIDE
// ========================================

// Écouter les messages postMessage depuis l'iframe (uniquement dans le top frame)
window.addEventListener('message', function(event) {
    if (!isTopFrame) return; // Les iframes ne gèrent pas les messages sidebar
    // Vérifier que le message vient de notre iframe
    if (event.data && event.data.type === 'toolweb_message') {
        console.log('📩 Message reçu de l\'iframe:', event.data.action);

        const action = event.data.action;

        if (action === 'collapse_sidebar') {
            collapseSidebar();
        } else if (action === 'remove_sidebar') {
            removeSidebar();
        } else if (action === 'activate_magnifier') {
            activateMagnifier();
        } else if (action === 'deactivate_all_tools') {
            deactivateAllTools();
        } else if (action === 'update_magnifier') {
            updateMagnifierSettings(event.data.params);
        } else if (action === 'show_large_display') {
            showLargeTextOverlay(event.data.text, event.data.isIcon, event.data.timerMinutes || 0);
        } else if (action === 'paste_text') {
            insertTextAtCursor(event.data.text);
        } else if (action === 'enable_translation') {
            enableTranslation(event.data);
        } else if (action === 'disable_translation') {
            disableTranslation();
        } else if (action === 'show_gif_preview') {
            showGifPreview(event.data.key);
        } else if (action === 'close_gif_preview') {
            closeGifPreview();
        }
    }
});

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

        // Vérifier que le contexte de l'extension est toujours valide
        if (!chrome.runtime?.id) {
            console.warn('⚠️ Extension context invalidated - rechargez la page');
            return;
        }

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

                    // Vérifier que le contexte de l'extension est toujours valide
                    if (!chrome.runtime?.id) {
                        console.warn('⚠️ Extension context invalidated - rechargez la page');
                        return;
                    }

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

// Écouter les messages pour coller du texte (sidebar/loupe/affichage uniquement dans le top frame)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!isTopFrame) return; // Les iframes ne gèrent pas ces actions
    if (request.action === "toggle_sidebar") {
        console.log('🔄 Demande de toggle de la sidebar');
        toggleSidebar();
        sendResponse({ status: "success" });
    } else if (request.action === "paste_text") {
        console.log('Demande de collage reçue:', request.text);
        insertTextAtCursor(request.text);
        sendResponse({ status: "success" });
    } else if (request.action === "show_large_display") {
        console.log('Demande d\'affichage en grand:', request.text);
        showLargeTextOverlay(request.text);
        sendResponse({ status: "success" });
    } else if (request.action === "activate_magnifier") {
        console.log('Demande d\'activation de la loupe');
        activateMagnifier();
        sendResponse({ status: "success" });
    } else if (request.action === "deactivate_all_tools") {
        console.log('Demande de désactivation de tous les outils');
        deactivateAllTools();
        sendResponse({ status: "success" });
    } else if (request.action === "update_magnifier") {
        console.log('Mise à jour des paramètres de la loupe:', request.params);
        updateMagnifierSettings(request.params);
        sendResponse({ status: "success" });
    } else if (request.action === "gif_ready") {
        console.log('🎬 GIF prêt → réouverture de la barre latérale');
        hideGifBand();
        openSidebarOnGifSection();
        sendResponse({ status: "success" });
    }
});

function deactivateAllTools() {
    // Arrêter l'animation de la loupe
    if (magnifierAnimationFrame) {
        cancelAnimationFrame(magnifierAnimationFrame);
        magnifierAnimationFrame = null;
    }

    // Retirer les event listeners
    if (magnifierUpdateHandler) {
        document.removeEventListener('mousemove', magnifierUpdateHandler);
        magnifierUpdateHandler = null;
    }

    // Désactiver la loupe
    const magnifier = document.getElementById('toolweb-magnifier');
    const magnifierOverlay = document.getElementById('toolweb-magnifier-overlay');
    const magnifierControls = document.getElementById('toolweb-magnifier-controls');
    if (magnifier) magnifier.remove();
    if (magnifierOverlay) magnifierOverlay.remove();
    if (magnifierControls) magnifierControls.remove();

    // Retirer le bouton de fermeture de la loupe
    const magnifierCloseBtn = document.getElementById('toolweb-magnifier-close');
    if (magnifierCloseBtn) magnifierCloseBtn.remove();

    // Désactiver la traduction (mais ne pas effacer les traductions existantes)
    // Les traductions seront supprimées seulement via disable_translation
    // translationEnabled = false;

    // Désactiver l'affichage en grand
    const largeDisplay = document.getElementById('toolweb-large-overlay');
    if (largeDisplay) largeDisplay.remove();

    console.log('✅ Tous les outils ont été désactivés');
}

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
        tempTextarea.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; z-index: -9999;';
        document.body.appendChild(tempTextarea);
        tempTextarea.select();

        try {
            document.execCommand('copy');
            showPasteNotification('✅ Texte copié ! Cliquez dans le document et appuyez sur Cmd+V (ou Ctrl+V) pour coller.');
            console.log('✅ Texte copié dans le clipboard pour Google Docs');
        } catch (err) {
            console.error('❌ Erreur:', err);
            alert('Texte : ' + text + '\n\nCopiez ce texte manuellement.');
        } finally {
            if (document.body.contains(tempTextarea)) {
                document.body.removeChild(tempTextarea);
            }
        }
        return;
    }

    // Cas spécial 2: Google Sheets - utiliser le clipboard avec notification
    if (window.location.hostname.includes('docs.google.com') && window.location.pathname.includes('/spreadsheets/')) {
        console.log('🔍 Google Sheets détecté - copie dans le clipboard');

        const tempTextarea = document.createElement('textarea');
        tempTextarea.value = text;
        tempTextarea.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; z-index: -9999;';
        document.body.appendChild(tempTextarea);
        tempTextarea.select();

        try {
            document.execCommand('copy');
            showPasteNotification('✅ Texte copié ! Étapes:\n1. Cliquez sur une cellule\n2. Appuyez sur Cmd+V (ou Ctrl+V)');
            console.log('✅ Texte copié dans le clipboard pour Google Sheets');
        } catch (err) {
            console.error('❌ Erreur:', err);
            alert('Texte : ' + text + '\n\nCopiez ce texte manuellement.');
        } finally {
            if (document.body.contains(tempTextarea)) {
                document.body.removeChild(tempTextarea);
            }
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

function showLargeTextOverlay(text, isIcon, timerMinutes) {
    // Supprimer l'overlay existant + timer
    const existingOverlay = document.getElementById('toolweb-large-overlay');
    if (existingOverlay) existingOverlay.remove();
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

    const overlay = document.createElement('div');
    overlay.id = 'toolweb-large-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, ${isIcon ? '0.88' : '0.65'});
        z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        animation: fadeIn 0.3s ease;
    `;

    const textContainer = document.createElement('div');
    const textElement = document.createElement('div');

    if (isIcon) {
        // === MODE ICÔNE : plein écran, fond sombre, pas de cadre ===
        const parts = text.split('\n');
        const emoji = parts[0] || '';
        const label = parts[1] || '';

        textContainer.style.cssText = `
            background: transparent; padding: 0; box-shadow: none;
            max-width: 100%; max-height: 100%; text-align: center;
            animation: slideIn 0.4s ease;
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 10px;
        `;

        textElement.style.cssText = `
            display: flex; flex-direction: column; align-items: center; gap: 10px;
        `;

        const emojiEl = document.createElement('div');
        emojiEl.style.cssText = `
            font-size: ${timerMinutes > 0 ? '30vmin' : '45vmin'};
            line-height: 1;
            filter: drop-shadow(0 8px 20px rgba(0,0,0,0.3));
        `;
        emojiEl.textContent = emoji;

        const labelEl = document.createElement('div');
        labelEl.style.cssText = `
            font-size: ${timerMinutes > 0 ? '5vmin' : '8vmin'};
            font-weight: 900; color: white; letter-spacing: 6px;
            font-family: 'Arial', sans-serif;
            text-shadow: 0 4px 12px rgba(0,0,0,0.5);
            text-transform: uppercase;
        `;
        labelEl.textContent = label;

        textElement.appendChild(emojiEl);
        textElement.appendChild(labelEl);

        // === MINUTEUR INTÉGRÉ (si activé) ===
        if (timerMinutes > 0) {
            let totalSeconds = timerMinutes * 60;

            function formatTime(s) {
                const m = Math.floor(s / 60);
                const sec = s % 60;
                return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            }

            const timerEl = document.createElement('div');
            timerEl.style.cssText = `
                font-size: 18vmin; font-weight: 800; color: white;
                font-family: 'Segoe UI', monospace;
                letter-spacing: 4px; line-height: 1;
                text-shadow: 0 4px 16px rgba(0,0,0,0.4);
                margin-top: 2vmin;
            `;
            timerEl.textContent = formatTime(totalSeconds);
            textElement.appendChild(timerEl);

            // Boutons pause/stop sous le timer
            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display: flex; gap: 16px; margin-top: 2vmin;';

            const pauseBtn = document.createElement('button');
            let isPaused = false;
            pauseBtn.textContent = '⏸ Pause';
            pauseBtn.style.cssText = `
                padding: 12px 28px; border: none; border-radius: 10px;
                background: rgba(255,255,255,0.2); color: white;
                font-size: 18px; font-weight: 700; cursor: pointer;
                transition: all 0.2s; backdrop-filter: blur(4px);
            `;
            pauseBtn.onmouseover = () => pauseBtn.style.background = 'rgba(255,255,255,0.3)';
            pauseBtn.onmouseout = () => pauseBtn.style.background = 'rgba(255,255,255,0.2)';
            pauseBtn.onclick = (e) => {
                e.stopPropagation();
                isPaused = !isPaused;
                pauseBtn.textContent = isPaused ? '▶ Reprendre' : '⏸ Pause';
            };
            btnRow.appendChild(pauseBtn);
            textElement.appendChild(btnRow);

            // Lancer le décompte
            timerInterval = setInterval(() => {
                if (isPaused) return;
                totalSeconds--;

                if (totalSeconds <= 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    timerEl.textContent = '00:00';
                    timerEl.style.color = '#ff5252';

                    // Remplacer emoji par cloche
                    emojiEl.textContent = '🔔';

                    // Clignotement
                    let blink = true;
                    const blinkInterval = setInterval(() => {
                        overlay.style.background = blink ? 'rgba(255,60,0,0.85)' : 'rgba(0,0,0,0.88)';
                        blink = !blink;
                    }, 500);
                    setTimeout(() => { clearInterval(blinkInterval); overlay.style.background = 'rgba(0,0,0,0.88)'; }, 6000);

                    // Sonnerie x3
                    playBellSound();
                    setTimeout(() => playBellSound(), 2000);
                    setTimeout(() => playBellSound(), 4000);

                    pauseBtn.style.display = 'none';
                    return;
                }

                timerEl.textContent = formatTime(totalSeconds);
                if (totalSeconds <= 10) {
                    timerEl.style.color = '#ff5252';
                } else if (totalSeconds <= 30) {
                    timerEl.style.color = '#ffab40';
                }
            }, 1000);
        }
    } else {
        // === MODE TEXTE LIBRE (comportement original) ===
        textContainer.style.cssText = `
            background: white; padding: 60px 80px; border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            max-width: 90%; max-height: 80%; overflow: auto; text-align: center;
            animation: slideIn 0.4s ease;
            display: flex; flex-direction: column; align-items: center; gap: 30px;
        `;
        textElement.style.cssText = `
            font-size: 72px; font-weight: bold; color: #333;
            line-height: 1.3; word-wrap: break-word; font-family: 'Arial', sans-serif;
        `;
        textElement.textContent = text;

        // QR Code uniquement pour le texte libre
        const qrContainer = document.createElement('div');
        qrContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 10px;';
        const qrTitle = document.createElement('div');
        qrTitle.style.cssText = 'font-size: 16px; color: #666; font-weight: 600;';
        qrTitle.textContent = '📱 Scannez pour copier le texte';
        const qrImage = document.createElement('img');
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
        qrImage.style.cssText = 'width: 200px; height: 200px; border: 3px solid #333; border-radius: 10px;';
        qrImage.alt = 'QR Code';
        qrContainer.appendChild(qrTitle);
        qrContainer.appendChild(qrImage);
        textContainer.appendChild(textElement);
        textContainer.appendChild(qrContainer);
    }

    // Bouton fermer
    const sidebar = document.getElementById('toolweb-sidebar-container');
    const sidebarWidth = sidebar ? (sidebar.classList.contains('collapsed') ? 40 : 476) : 0;
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕ Fermer';
    closeButton.style.cssText = `
        position: absolute; top: 30px; right: ${sidebarWidth + 30}px;
        background: #f44336; color: white; border: none; border-radius: 8px;
        padding: 15px 30px; font-size: 18px; font-weight: bold;
        cursor: pointer; transition: all 0.2s;
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
    `;
    closeButton.onmouseover = () => { closeButton.style.background = '#d32f2f'; closeButton.style.transform = 'scale(1.05)'; };
    closeButton.onmouseout = () => { closeButton.style.background = '#f44336'; closeButton.style.transform = 'scale(1)'; };
    closeButton.onclick = () => {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        overlay.remove();
    };

    // Animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;
    document.head.appendChild(style);

    // Assembler
    if (isIcon) {
        textContainer.appendChild(textElement);
    }
    overlay.appendChild(textContainer);
    overlay.appendChild(closeButton);
    document.body.appendChild(overlay);

    // Fermer avec Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            overlay.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Fermer en cliquant sur le fond (pas sur les boutons)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            overlay.remove();
        }
    });

    console.log('✅ Overlay affiché:', isIcon ? 'icône' : 'texte', timerMinutes > 0 ? `+ minuteur ${timerMinutes}min` : '');
}

// ========================================
// MINUTEUR AVEC SONNERIE
// ========================================

let timerInterval = null;

function playBellSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        function playBell(startTime) {
            // Oscillateur principal (ton de cloche)
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(830, startTime);
            osc.frequency.exponentialRampToValueAtTime(620, startTime + 0.3);

            // Harmonique pour richesse sonore
            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1660, startTime);
            osc2.frequency.exponentialRampToValueAtTime(1240, startTime + 0.2);

            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.4, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);

            const gain2 = audioCtx.createGain();
            gain2.gain.setValueAtTime(0.15, startTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

            osc.connect(gain).connect(audioCtx.destination);
            osc2.connect(gain2).connect(audioCtx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.8);
            osc2.start(startTime);
            osc2.stop(startTime + 0.5);
        }

        // 3 coups de cloche
        const now = audioCtx.currentTime;
        playBell(now);
        playBell(now + 0.9);
        playBell(now + 1.8);
    } catch (e) {
        console.warn('⚠️ Impossible de jouer le son:', e);
    }
}

// Variables globales pour la loupe
let magnifierSettings = {
    size: 200,
    darkness: 70,
    zoom: 1.0
};

let magnifierUpdateHandler = null;
let magnifierAnimationFrame = null;
let currentMouseX = 0;
let currentMouseY = 0;

function activateMagnifier() {
    // Supprimer la loupe existante si elle existe
    const existingMagnifier = document.getElementById('toolweb-magnifier');
    if (existingMagnifier) {
        deactivateAllTools();
        console.log('🔍 Loupe désactivée');
        return;
    }

    console.log('🔍 Activation de la loupe...');

    // IMPORTANT : Réinitialiser le zoom à 1.0 au démarrage
    magnifierSettings.zoom = 1.0;
    console.log('✅ Zoom réinitialisé à 1.0');

    // Créer l'overlay SVG qui couvre toute la page (y compris les iframes)
    // Le SVG utilise un mask avec un trou circulaire pour l'effet loupe
    const overlay = document.createElement('div');
    overlay.id = 'toolweb-magnifier-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 2147483645;
        display: none;
    `;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';

    const defs = document.createElementNS(svgNS, 'defs');
    const mask = document.createElementNS(svgNS, 'mask');
    mask.setAttribute('id', 'toolweb-magnifier-mask');

    const maskBg = document.createElementNS(svgNS, 'rect');
    maskBg.setAttribute('width', '100%');
    maskBg.setAttribute('height', '100%');
    maskBg.setAttribute('fill', 'white');

    const maskHole = document.createElementNS(svgNS, 'circle');
    maskHole.setAttribute('id', 'toolweb-mask-hole');
    maskHole.setAttribute('r', String(magnifierSettings.size / 2));
    maskHole.setAttribute('fill', 'black');

    mask.appendChild(maskBg);
    mask.appendChild(maskHole);
    defs.appendChild(mask);
    svg.appendChild(defs);

    const overlayRect = document.createElementNS(svgNS, 'rect');
    overlayRect.setAttribute('id', 'toolweb-overlay-rect');
    overlayRect.setAttribute('width', '100%');
    overlayRect.setAttribute('height', '100%');
    overlayRect.setAttribute('fill', `rgba(0, 0, 0, ${magnifierSettings.darkness / 100})`);
    overlayRect.setAttribute('mask', 'url(#toolweb-magnifier-mask)');
    svg.appendChild(overlayRect);

    overlay.appendChild(svg);
    document.body.appendChild(overlay);

    // Créer le conteneur de la loupe (cercle avec bordure)
    const magnifier = document.createElement('div');
    magnifier.id = 'toolweb-magnifier';

    magnifier.style.cssText = `
        position: fixed;
        width: ${magnifierSettings.size}px;
        height: ${magnifierSettings.size}px;
        border: 4px solid #667eea;
        border-radius: 50%;
        pointer-events: none;
        z-index: 2147483646;
        background: transparent;
        display: none;
        overflow: hidden;
    `;

    // Créer l'élément qui affichera le contenu agrandi (seulement si zoom > 1)
    const magnifierContent = document.createElement('div');
    magnifierContent.id = 'toolweb-magnifier-content';
    magnifierContent.style.cssText = `
        position: absolute;
        width: 100%;
        height: 100%;
        pointer-events: none;
        display: none;
    `;
    magnifier.appendChild(magnifierContent);

    // Créer le bouton de fermeture
    const closeButton = document.createElement('button');
    closeButton.id = 'toolweb-magnifier-close';
    closeButton.innerHTML = '✕';

    // Calculer la position en fonction de la sidebar
    const sidebar = document.getElementById('toolweb-sidebar-container');
    const sidebarWidth = sidebar ? (sidebar.classList.contains('collapsed') ? 40 : 476) : 0;
    const rightPosition = sidebarWidth + 20; // Largeur sidebar + marge

    closeButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: ${rightPosition}px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        font-size: 24px;
        font-weight: bold;
        cursor: pointer;
        z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);
        transition: all 0.2s;
        pointer-events: auto;
    `;
    closeButton.onmouseover = () => {
        closeButton.style.background = '#d32f2f';
        closeButton.style.transform = 'scale(1.1)';
    };
    closeButton.onmouseout = () => {
        closeButton.style.background = '#f44336';
        closeButton.style.transform = 'scale(1)';
    };
    closeButton.onclick = () => {
        if (magnifierAnimationFrame) {
            cancelAnimationFrame(magnifierAnimationFrame);
        }
        deactivateAllTools();
        console.log('🔍 Loupe fermée (bouton)');
    };

    document.body.appendChild(magnifier);
    document.body.appendChild(closeButton);

    // Fonction d'animation fluide
    function animateMagnifier() {
        const radius = magnifierSettings.size / 2;

        // Positionner la loupe centrée sur le curseur
        magnifier.style.left = (currentMouseX - radius) + 'px';
        magnifier.style.top = (currentMouseY - radius) + 'px';
        magnifier.style.display = 'block';

        // Mettre à jour le trou SVG de l'overlay
        const maskHole = document.getElementById('toolweb-mask-hole');
        const magnifierOverlay = document.getElementById('toolweb-magnifier-overlay');
        if (maskHole) {
            maskHole.setAttribute('cx', String(currentMouseX));
            maskHole.setAttribute('cy', String(currentMouseY));
        }
        if (magnifierOverlay) {
            magnifierOverlay.style.display = 'block';
        }

        // Si zoom > 1, afficher le contenu agrandi
        if (magnifierSettings.zoom > 1.0) {
            // Créer le clone UNE SEULE FOIS au premier passage
            if (!magnifierContent.firstChild) {
                console.log('🔍 Création du clone initial...');
                const bodyClone = document.body.cloneNode(true);

                // Supprimer les éléments de la loupe du clone
                const clonedMagnifier = bodyClone.querySelector('#toolweb-magnifier');
                const clonedCloseBtn = bodyClone.querySelector('#toolweb-magnifier-close');
                if (clonedMagnifier) clonedMagnifier.remove();
                if (clonedCloseBtn) clonedCloseBtn.remove();

                magnifierContent.appendChild(bodyClone);
                console.log('✅ Clone body créé avec succès');
            }

            // Afficher le contenu
            magnifierContent.style.display = 'block';
            magnifier.style.background = 'white';

            // APPROCHE CLASSIQUE DE LOUPE : positionner le clone comme la vraie page
            const zoom = magnifierSettings.zoom;

            // Position du curseur dans le viewport (sans scroll)
            const viewportX = currentMouseX;
            const viewportY = currentMouseY;

            // Le clone doit être positionné pour que le point sous le curseur
            // apparaisse au centre de la loupe après zoom
            // Formule simple : déplacer le clone de -(cursorPos * zoom) + radius
            const translateX = -viewportX * zoom + radius;
            const translateY = -viewportY * zoom + radius;

            magnifierContent.style.transform = `scale(${zoom})`;
            magnifierContent.style.transformOrigin = '0 0';
            magnifierContent.style.left = translateX + 'px';
            magnifierContent.style.top = translateY + 'px';

            console.log('🔍 SIMPLE APPROACH | ZOOM:', zoom.toFixed(2) + 'x | Viewport cursor:', viewportX, viewportY, '| Translate:', translateX.toFixed(0), translateY.toFixed(0), '| Radius:', radius);
        } else {
            // Pas de zoom, juste un cercle transparent
            magnifierContent.style.display = 'none';
            magnifier.style.background = 'transparent';
            // Nettoyer le clone si on repasse à zoom = 1
            if (magnifierContent.firstChild) {
                magnifierContent.innerHTML = '';
                console.log('🔍 Clone nettoyé (zoom = 1)');
            }
        }

        // Continuer l'animation
        magnifierAnimationFrame = requestAnimationFrame(animateMagnifier);
    }

    // Fonction pour capturer la position de la souris
    magnifierUpdateHandler = function(e) {
        currentMouseX = e.clientX;
        currentMouseY = e.clientY;
    };

    // Ajouter l'écouteur de mouvement de souris
    document.addEventListener('mousemove', magnifierUpdateHandler);

    // Démarrer l'animation
    animateMagnifier();

    // Fermer avec Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            if (magnifierAnimationFrame) {
                cancelAnimationFrame(magnifierAnimationFrame);
            }
            deactivateAllTools();
            document.removeEventListener('keydown', handleEscape);
            console.log('🔍 Loupe fermée (Escape)');
        }
    };
    document.addEventListener('keydown', handleEscape);

    console.log('✅ Loupe activée - Déplacez votre souris pour l\'utiliser. Appuyez sur ESC ou cliquez sur ✕ pour fermer.');
}

function updateMagnifierSettings(params) {
    console.log('🔍 updateMagnifierSettings appelé avec:', params);
    console.log('🔍 Paramètres actuels AVANT mise à jour:', JSON.stringify(magnifierSettings));

    // Mettre à jour les paramètres
    if (params.size !== undefined) {
        magnifierSettings.size = params.size;
        console.log('✅ Taille mise à jour:', params.size);
    }
    if (params.darkness !== undefined) {
        magnifierSettings.darkness = params.darkness;
        console.log('✅ Obscurité mise à jour:', params.darkness);
    }
    if (params.zoom !== undefined) {
        const oldZoom = magnifierSettings.zoom;
        magnifierSettings.zoom = params.zoom;
        console.log('✅ Zoom mis à jour de', oldZoom, 'vers', params.zoom);

        // Forcer la recréation du clone si le zoom change
        const magnifierContent = document.getElementById('toolweb-magnifier-content');
        if (magnifierContent && magnifierContent.firstChild && oldZoom !== params.zoom) {
            console.log('🔄 Nettoyage du clone pour recréation...');
            magnifierContent.innerHTML = '';
        }
    }

    console.log('🔍 Paramètres actuels APRES mise à jour:', JSON.stringify(magnifierSettings));

    // Mettre à jour la loupe si elle est active
    const magnifier = document.getElementById('toolweb-magnifier');

    if (magnifier) {
        // Mettre à jour la taille
        magnifier.style.width = magnifierSettings.size + 'px';
        magnifier.style.height = magnifierSettings.size + 'px';

        // Mettre à jour l'overlay SVG (taille du trou et obscurité)
        const maskHole = document.getElementById('toolweb-mask-hole');
        if (maskHole) {
            maskHole.setAttribute('r', String(magnifierSettings.size / 2));
        }
        const overlayRect = document.getElementById('toolweb-overlay-rect');
        if (overlayRect) {
            overlayRect.setAttribute('fill', `rgba(0, 0, 0, ${magnifierSettings.darkness / 100})`);
        }

        console.log('✅ Styles DOM mis à jour');
    } else {
        console.warn('⚠️ Loupe non trouvée dans le DOM');
    }
}

