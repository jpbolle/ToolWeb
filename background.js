// background.js
importScripts('gif-db.js'); // accès aux GIF stockés (IndexedDB) pour l'envoi vers Drive

chrome.action.onClicked.addListener((tab) => {
  // Toggle la sidebar injectée dans la page
  chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('Erreur lors du toggle de la sidebar:', chrome.runtime.lastError.message);
    } else {
      console.log('✅ Toggle sidebar envoyé');
    }
  });
});

// Écouter les messages du content script (copie de texte)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message reçu:', request);
  if (request.action === "text_copied") {
    console.log('💾 Sauvegarde du texte dans l\'historique:', request.text.substring(0, 50) + '...');
    saveToHistory(request.text);
    sendResponse({ success: true });
  }
  if (request.action === "gif_start") {
    startGifCapture(request, sender).then(sendResponse);
  }
  if (request.action === "gif_stop") {
    stopGifCapture(sender).then(sendResponse);
  }
  if (request.action === "gif_upload") {
    uploadGifToDrive(request)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => {
        console.error('❌ Envoi Drive impossible:', error);
        sendResponse({ ok: false, error: error.message || String(error) });
      });
  }
  if (request.action === "gif_capture_saved" || request.action === "gif_capture_failed") {
    finishGifCapture(request);
  }
  return true; // Garder le canal ouvert pour les réponses asynchrones
});

// ===== Tuto GIF 🎬 : chef d'orchestre de l'enregistrement =====
// L'enregistrement tourne dans un offscreen document (offscreen.html), qui survit aux
// changements de page. Ici, on obtient le flux vidéo et on le lui transmet.

// content.js doit lire l'état de l'enregistrement (gifRecording) pour afficher la bande Stop
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

const GIF_BAND_WIDTH = 40; // largeur de la bande Stop, en px (cf. sidebar.css)

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA', 'DISPLAY_MEDIA'],
    justification: "Enregistrer l'onglet ou l'écran pour produire un GIF tutoriel"
  });
}

async function startGifCapture(request, sender) {
  try {
    let streamId = null;
    let cropRight = 0;
    let captureSize = null;
    if (request.mode === 'tab') {
      // Autorisé parce que l'utilisateur a ouvert ToolWeb par l'icône sur cet onglet
      streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: sender.tab.id });
      // La bande Stop (40 px à droite) apparaît dans l'image de l'onglet : on la rogne
      const tab = await chrome.tabs.get(sender.tab.id);
      if (tab.width) cropRight = GIF_BAND_WIDTH / tab.width;
      // Sans taille précise, Chrome filme l'onglet en 640 × 480 avec des bandes noires
      const ratio = request.pixelRatio || 1;
      if (tab.width && tab.height) {
        captureSize = { width: Math.round(tab.width * ratio), height: Math.round(tab.height * ratio) };
      }
    }
    // Mode écran : c'est offscreen.js qui affiche la fenêtre de choix de Chrome

    await ensureOffscreenDocument();
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen',
      action: 'start_capture',
      streamId,
      mode: request.mode,
      cropRight,
      captureSize,
      settings: request.settings
    });
    if (!result || !result.ok) throw new Error(result ? result.error : 'Pas de réponse de la page de capture');

    await chrome.storage.session.set({
      // startedAt = fin du compte à rebours ; halo = cercle à chaque clic (réglage de l'onglet 🎬)
      gifRecording: {
        mode: request.mode,
        startedAt: result.startAt,
        tabId: sender.tab.id,
        halo: request.halo !== false,
        finalizing: false
      }
    });
    await chrome.storage.session.remove(['gifLastError', 'gifStopTabId']);
    console.log('🎬 Enregistrement lancé, mode:', request.mode);
    return { ok: true };
  } catch (error) {
    console.error('❌ Enregistrement impossible:', error);
    return { ok: false, error: error.message || String(error) };
  }
}

function saveToHistory(text) {
  // Vérifier d'abord si la capture est activée
  chrome.storage.local.get(['clipboardCaptureEnabled'], function (result) {
    // Par défaut activé si jamais défini (undefined ou true = activé)
    const isEnabled = result.clipboardCaptureEnabled === undefined ? true : result.clipboardCaptureEnabled;

    console.log('📋 État de la capture:', isEnabled ? 'ACTIVÉE' : 'DÉSACTIVÉE');

    if (!isEnabled) {
      console.log('⏸️ Capture désactivée, texte ignoré');
      return;
    }

    chrome.storage.local.get(['clipboardHistory'], function (result) {
      let history = result.clipboardHistory || [];
      console.log('📚 Historique actuel:', history.length, 'éléments');

      // Éviter les doublons consécutifs
      if (history.length > 0 && history[history.length - 1] === text) {
        console.log('⚠️ Doublon détecté, ignoré');
        return;
      }

      history.push(text);
      console.log('✅ Texte ajouté à l\'historique');

      // Garder seulement les 20 derniers éléments
      if (history.length > 20) {
        history.shift();
      }

      chrome.storage.local.set({ clipboardHistory: history }, () => {
        console.log('💾 Historique sauvegardé:', history.length, 'éléments');
      });
    });
  });
}

async function stopGifCapture(sender) {
  const { gifRecording } = await chrome.storage.session.get('gifRecording');
  if (!gifRecording) return { ok: false, error: 'Aucun enregistrement en cours' };

  // On retient l'onglet où Stop a été cliqué : c'est là que la barre latérale réapparaîtra
  await chrome.storage.session.set({
    gifRecording: { ...gifRecording, finalizing: true },
    gifStopTabId: sender.tab ? sender.tab.id : gifRecording.tabId
  });
  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', action: 'stop_capture' });
    return { ok: true };
  } catch (error) {
    // Page de capture disparue (extension rechargée…) : on remet l'état à zéro
    await chrome.storage.session.remove(['gifRecording', 'gifStopTabId']);
    return { ok: false, error: error.message };
  }
}

// GIF prêt (ou échec) : on rouvre la barre latérale sur l'onglet 🎬
async function finishGifCapture(request) {
  const { gifRecording, gifStopTabId } = await chrome.storage.session.get(['gifRecording', 'gifStopTabId']);
  const tabId = gifStopTabId || (gifRecording && gifRecording.tabId);

  if (request.action === 'gif_capture_failed') {
    await chrome.storage.session.set({ gifLastError: request.error });
  }
  await chrome.storage.session.remove(['gifRecording', 'gifStopTabId']);

  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'gif_ready' }).catch((error) => {
      console.warn('⚠️ Impossible de rouvrir la barre latérale:', error.message);
    });
  }
}

// ===== Tuto GIF 🎬 : envoi vers Google Drive =====
// Connexion avec le compte Google de Chrome (cnddinant.be) via chrome.identity :
// le client OAuth et la portée sont déclarés dans le bloc "oauth2" du manifeste.

function getDriveToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (result) => {
      if (chrome.runtime.lastError || !result) {
        reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Connexion Google refusée'));
        return;
      }
      // Selon la version de Chrome : le jeton seul, ou un objet { token }
      resolve(typeof result === 'string' ? result : result.token);
    });
  });
}

async function uploadGifToDrive({ folderId, key, name }) {
  if (!folderId) throw new Error('Aucun dossier Drive choisi');
  const capture = await gifDbGet(key);
  if (!capture) throw new Error('GIF introuvable (supprimé de l\'historique ?)');

  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify({ name, mimeType: 'image/gif', parents: [folderId] })], { type: 'application/json' }));
  body.append('file', capture.blob);
  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink';

  const send = (token) => fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  let token = await getDriveToken();
  let response = await send(token);
  if (response.status === 401) {
    // Jeton expiré : on l'oublie et on en redemande un
    await chrome.identity.removeCachedAuthToken({ token });
    token = await getDriveToken();
    response = await send(token);
  }
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error((details.error && details.error.message) || `Erreur Drive ${response.status}`);
  }

  const file = await response.json();
  // On mémorise l'envoi avec le GIF : l'onglet 🎬 affichera « envoyé » et le lien
  capture.drive = { id: file.id, link: file.webViewLink, name, sentAt: Date.now() };
  await gifDbPut(key, capture);
  console.log('☁️ GIF envoyé sur Drive:', file.webViewLink);
  return { link: file.webViewLink };
}
