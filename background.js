// background.js

chrome.action.onClicked.addListener((tab) => {
  // Ouvre le panneau latéral dans l'onglet actuel
  chrome.sidePanel.open({ tabId: tab.id });
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
}