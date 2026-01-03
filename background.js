// background.js

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
  }
});

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