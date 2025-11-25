document.addEventListener('DOMContentLoaded', function () {
  console.log('sidepanel.js chargé et DOMContentLoaded déclenché');

  const startBtn = document.getElementById('startRecording');
  const stopBtn = document.getElementById('stopRecording');
  const copyBtn = document.getElementById('copyText');
  const cleanBtn = document.getElementById('cleanText');
  const restartBtn = document.getElementById('restartRecording');
  const transcribedText = document.getElementById('transcribedText');
  const writeEmailBtn = document.getElementById('writeEmail');
  const historyList = document.getElementById('history-list');
  const showLargeDisplayBtn = document.getElementById('showLargeDisplay');
  const displayText = document.getElementById('displayText');

  let mediaRecorder;
  let audioChunks = [];
  let cursorPosition = 0;

  // Initialiser l'historique depuis le stockage local
  loadClipboardHistory();

  // Écouter les mises à jour de l'historique
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.clipboardHistory) {
      updateHistoryUI(changes.clipboardHistory.newValue);
    }
  });

  // Gestionnaire pour l'affichage en grand
  if (showLargeDisplayBtn && displayText) {
    // Fonction pour afficher le texte
    const displayLargeText = async function () {
      const text = displayText.value.trim();
      if (!text) {
        alert('Veuillez entrer du texte à afficher.');
        return;
      }

      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab) {
          alert("Aucun onglet actif. Ouvrez une page web et réessayez.");
          return;
        }

        // Envoyer le message au content script pour afficher l'overlay
        chrome.tabs.sendMessage(tab.id, { action: "show_large_display", text: text }, function (response) {
          if (chrome.runtime.lastError) {
            console.warn("Content script non disponible, injection directe...");
            // Fallback: injecter directement la fonction
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (textToDisplay) => {
                // Fonction inline pour afficher l'overlay
                const existingOverlay = document.getElementById('scriptomail-large-overlay');
                if (existingOverlay) existingOverlay.remove();

                const overlay = document.createElement('div');
                overlay.id = 'scriptomail-large-overlay';
                overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 2147483647; display: flex; align-items: center; justify-content: center;`;

                const textContainer = document.createElement('div');
                textContainer.style.cssText = `background: white; padding: 60px 80px; border-radius: 20px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); max-width: 90%; max-height: 80%; overflow: auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 30px;`;

                const textElement = document.createElement('div');
                textElement.style.cssText = `font-size: 72px; font-weight: bold; color: #333; line-height: 1.3; word-wrap: break-word; font-family: Arial, sans-serif;`;
                textElement.textContent = textToDisplay;

                // Générer le QR code
                const qrContainer = document.createElement('div');
                qrContainer.style.cssText = `display: flex; flex-direction: column; align-items: center; gap: 10px;`;

                const qrTitle = document.createElement('div');
                qrTitle.style.cssText = `font-size: 16px; color: #666; font-weight: 600;`;
                qrTitle.textContent = '📱 Scannez pour copier le texte';

                const qrImage = document.createElement('img');
                // Utiliser l'API QR Code gratuite
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(textToDisplay)}`;
                qrImage.src = qrCodeUrl;
                qrImage.style.cssText = `width: 200px; height: 200px; border: 3px solid #333; border-radius: 10px;`;
                qrImage.alt = 'QR Code';

                qrContainer.appendChild(qrTitle);
                qrContainer.appendChild(qrImage);

                const closeButton = document.createElement('button');
                closeButton.textContent = '✕ Fermer';
                closeButton.style.cssText = `position: absolute; top: 30px; right: 30px; background: #f44336; color: white; border: none; border-radius: 8px; padding: 15px 30px; font-size: 18px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);`;
                closeButton.onclick = () => overlay.remove();

                textContainer.appendChild(textElement);
                textContainer.appendChild(qrContainer);
                overlay.appendChild(textContainer);
                overlay.appendChild(closeButton);
                document.body.appendChild(overlay);

                document.addEventListener('keydown', (e) => {
                  if (e.key === 'Escape') overlay.remove();
                });
                overlay.addEventListener('click', (e) => {
                  if (e.target === overlay) overlay.remove();
                });
              },
              args: [text]
            }).then(() => {
              console.log("✅ Overlay affiché via injection directe");
            }).catch((err) => {
              console.error("Erreur lors de l'injection:", err);
              alert("Impossible d'afficher le texte sur cette page.");
            });
          } else {
            console.log("✅ Overlay affiché avec succès");
          }
        });
      } catch (error) {
        console.error("Erreur lors de l'affichage:", error);
        alert("Erreur lors de l'affichage du texte.");
      }
    };

    // Clic sur le bouton
    showLargeDisplayBtn.addEventListener('click', displayLargeText);

    // Raccourci clavier : Enter (sans Shift) pour afficher
    displayText.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Empêcher le saut de ligne
        displayLargeText();
      }
      // Shift+Enter laisse le comportement par défaut (saut de ligne)
    });
  }

  // Gestionnaires pour les formules rapides
  const quickPhraseBtns = document.querySelectorAll('.quick-phrase-btn');
  quickPhraseBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const phrase = this.getAttribute('data-phrase');
      pasteTextToActiveTab(phrase);
    });
  });

  // Gestionnaire pour le champ de saisie personnalisé
  const customPhraseInput = document.getElementById('customPhraseInput');
  if (customPhraseInput) {
    customPhraseInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const customText = this.value.trim();
        if (customText) {
          // Ajouter le texte à l'historique
          chrome.storage.local.get(['clipboardHistory'], function (result) {
            let history = result.clipboardHistory || [];
            // Éviter les doublons
            if (!history.includes(customText)) {
              history.push(customText);
              // Garder seulement les 20 derniers
              if (history.length > 20) {
                history.shift();
              }
              chrome.storage.local.set({ clipboardHistory: history }, () => {
                console.log('✅ Phrase personnalisée ajoutée à l\'historique');
                updateHistoryUI(history);
              });
            } else {
              console.log('⚠️ Cette phrase existe déjà dans l\'historique');
              updateHistoryUI(history);
            }
          });
          // Vider le champ
          this.value = '';
        }
      }
    });
  }

  // --- Fonctions existantes (transcription, etc.) ---

  if (!startBtn || !stopBtn || !copyBtn || !cleanBtn || !restartBtn || !writeEmailBtn) {
    console.error('Un ou plusieurs éléments nécessaires n\'ont pas été trouvés dans le DOM.');
    return;
  }

  if (!transcribedText) {
    console.error('L\'élément transcribedText n\'a pas été trouvé.');
    return;
  }

  transcribedText.addEventListener('click', function () {
    cursorPosition = this.selectionStart;
  });

  transcribedText.addEventListener('keyup', function () {
    cursorPosition = this.selectionStart;
  });

  restartBtn.addEventListener('click', function () {
    console.log('Recommencer l\'enregistrement...');
    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording();
    }
    transcribedText.value = '';
    transcribedText.setAttribute('readonly', true);
    startBtn.disabled = false;
    stopBtn.disabled = true;
    audioChunks = [];
    if (mediaRecorder && mediaRecorder.stream) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    mediaRecorder = null;
    console.log('Enregistrement réinitialisé et prêt à redémarrer');
  });

  startBtn.addEventListener('click', function () {
    console.log('Démarrage de l\'enregistrement...');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    startRecording();
  });

  stopBtn.addEventListener('click', function () {
    console.log('Arrêt de l\'enregistrement...');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    stopRecording();
  });

  copyBtn.addEventListener('click', function () {
    console.log('Copie du texte en cours...');
    transcribedText.select();
    document.execCommand('copy');
    console.log('Texte copié dans le presse-papiers.');
  });

  cleanBtn.addEventListener('click', async function () {
    console.log('Nettoyage du texte en cours...');
    this.disabled = true;
    const cleanedText = await cleanTextWithAI(transcribedText.value);
    transcribedText.value = cleanedText;
    this.disabled = false;
    console.log('Texte nettoyé avec succès.');
  });

  writeEmailBtn.addEventListener('click', function () {
    console.log('Génération de l\'email à partir du texte en cours...');
    const currentText = transcribedText.value;
    writeEmailWithAI(currentText).then(emailContent => {
      transcribedText.value = emailContent;
      console.log('Email généré et inséré dans la zone de texte.');
    });
  });

  function startRecording() {
    console.log('Tentative d\'accès au microphone...');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        console.log('Accès au microphone accordé.');
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
        console.log('Enregistrement démarré.');

        mediaRecorder.ondataavailable = event => {
          audioChunks.push(event.data);
          console.log('Données audio disponibles.');
        };

        setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === "recording") {
            console.log('Arrêt automatique de l\'enregistrement après 2 minutes...');
            stopRecording();
          }
        }, 120000);
      })
      .catch(error => {
        console.error('Erreur lors de l\'accès au microphone:', error);
        let errorMsg = `Erreur : ${error.name}\n${error.message}`;
        if (error.name === 'NotAllowedError') {
          errorMsg += '\n\nVeuillez autoriser l\'accès au microphone dans les paramètres de Chrome.';
        } else if (error.name === 'NotFoundError') {
          errorMsg += '\n\nAucun microphone détecté sur votre appareil.';
        }
        alert(errorMsg);
        startBtn.disabled = false;
      });
  }

  function stopRecording() {
    if (mediaRecorder) {
      mediaRecorder.stop();
      console.log('Enregistrement arrêté.');
      mediaRecorder.onstop = () => {
        console.log('Enregistrement terminé, création du Blob audio...');
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];
        console.log('Données audio prêtes à être envoyées.');
        sendAudioToWhisperAPI(audioBlob);
        if (mediaRecorder.stream) {
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        startBtn.disabled = false;
      };
    } else {
      console.error('mediaRecorder n\'est pas initialisé.');
    }
  }

  function sendAudioToWhisperAPI(audioBlob) {
    console.log('Envoi de l\'audio au service Whisper pour transcription...');
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    // API Key loaded from config.js
    fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
      },
      body: formData
    })
      .then(response => response.json())
      .then(data => {
        if (data.text) {
          let currentText = transcribedText.value;
          let newText = currentText.slice(0, cursorPosition) + data.text + currentText.slice(cursorPosition);
          transcribedText.value = newText;
          cursorPosition += data.text.length;
          transcribedText.setSelectionRange(cursorPosition, cursorPosition);
          transcribedText.removeAttribute('readonly');
          console.log('Transcription réussie.');
        } else if (data.error) {
          console.error('Erreur lors de la transcription:', data);
          alert('Erreur lors de la transcription : ' + (data.error.message || JSON.stringify(data)));
        }
      })
      .catch(error => {
        console.error('Erreur lors de la transcription:', error);
        alert('Erreur lors de la transcription : ' + error.message);
      });
  }

  async function cleanTextWithAI(text) {
    console.log('Appel à l\'API pour nettoyage du texte...');
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: `Corrige ce texte pour qu'il soit grammaticalement correct et bien formaté. N'hésite pas à réorganiser les idées en paragraphes, mais n'ajoute pas de nouvelles phrases :\n\n${text}` }
          ],
          max_tokens: 1000,
          temperature: 0.2,
          n: 1
        })
      });
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
      } else {
        console.error('Erreur lors du nettoyage:', data);
        alert('Erreur lors du nettoyage : ' + (data.error ? data.error.message : JSON.stringify(data)));
        return text;
      }
    } catch (error) {
      console.error('Erreur API:', error);
      alert('Erreur API : ' + error.message);
      return text;
    }
  }

  async function writeEmailWithAI(text) {
    console.log('Appel à l\'API pour génération de l\'email...');
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a helpful assistant specifically tailored for email generation.' },
            { role: 'user', content: `À partir du texte suivant, écris un email professionnel :\n\n${text}` }
          ],
          max_tokens: 1000,
          temperature: 0.5
        })
      });
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
      } else {
        console.error('Erreur génération email:', data);
        alert('Erreur génération email : ' + (data.error ? data.error.message : JSON.stringify(data)));
        return '';
      }
    } catch (error) {
      console.error('Erreur API:', error);
      alert('Erreur API : ' + error.message);
      return '';
    }
  }

  // --- Fonctions pour l'historique du presse-papiers ---

  function loadClipboardHistory() {
    chrome.storage.local.get(['clipboardHistory'], function (result) {
      if (result.clipboardHistory) {
        updateHistoryUI(result.clipboardHistory);
      }
    });
  }

  function updateHistoryUI(history) {
    historyList.innerHTML = '';

    if (!history || history.length === 0) {
      historyList.innerHTML = '<div style="text-align:center; color:#888; font-size:12px; padding:10px;">Aucun historique. Copiez du texte sur une page web pour le voir apparaître ici.</div>';
      return;
    }

    // Afficher les plus récents en premier
    history.slice().reverse().forEach((item, index) => {
      const actualIndex = history.length - 1 - index; // Index réel dans le tableau

      const div = document.createElement('div');
      div.className = 'history-item';

      // Tooltip avec le texte complet
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = item;

      const textSpan = document.createElement('span');
      textSpan.className = 'history-text';
      textSpan.textContent = item;

      // Container pour les boutons
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'history-actions';

      // Bouton Coller
      const pasteBtn = document.createElement('button');
      pasteBtn.className = 'paste-btn';
      pasteBtn.textContent = 'Coller';
      pasteBtn.onclick = () => pasteTextToActiveTab(item);

      // Bouton Supprimer
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '✕';
      deleteBtn.title = 'Supprimer';
      deleteBtn.onclick = () => deleteHistoryItem(actualIndex);

      actionsDiv.appendChild(pasteBtn);
      actionsDiv.appendChild(deleteBtn);

      div.appendChild(tooltip);
      div.appendChild(textSpan);
      div.appendChild(actionsDiv);
      historyList.appendChild(div);
    });
  }

  function deleteHistoryItem(index) {
    chrome.storage.local.get(['clipboardHistory'], function (result) {
      let history = result.clipboardHistory || [];
      history.splice(index, 1);
      chrome.storage.local.set({ clipboardHistory: history }, () => {
        console.log('🗑️ Élément supprimé de l\'historique');
        updateHistoryUI(history);
      });
    });
  }

  async function pasteTextToActiveTab(text) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab) {
        console.error("Aucun onglet actif trouvé.");
        alert("Aucun onglet actif. Ouvrez une page web et réessayez.");
        return;
      }

      // Vérifier si c'est une page système (chrome://, about:, etc.)
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://'))) {
        console.warn("Page système détectée, utilisation du clipboard");
        copyToClipboardFallback(text);
        return;
      }

      // Envoyer un message au content script pour coller le texte
      chrome.tabs.sendMessage(tab.id, { action: "paste_text", text: text }, function (response) {
        if (chrome.runtime.lastError) {
          console.warn("Content script non disponible:", chrome.runtime.lastError.message);
          console.log("Tentative d'injection du script...");

          // Fallback: essayer d'injecter le script directement
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (textToPaste) => {
              const activeElement = document.activeElement;
              if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                // Insérer le texte
                if (activeElement.value !== undefined) {
                  const start = activeElement.selectionStart || 0;
                  const end = activeElement.selectionEnd || 0;
                  const value = activeElement.value;
                  activeElement.value = value.substring(0, start) + textToPaste + value.substring(end);
                  activeElement.selectionStart = activeElement.selectionEnd = start + textToPaste.length;
                  activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                  // ContentEditable
                  document.execCommand('insertText', false, textToPaste);
                }
                return { success: true };
              } else {
                return { success: false, reason: 'no_active_element' };
              }
            },
            args: [text]
          }).then((results) => {
            if (results && results[0] && results[0].result) {
              if (results[0].result.success) {
                console.log("✅ Texte collé via injection directe");
              } else {
                console.warn("Aucun champ actif, utilisation du clipboard");
                copyToClipboardFallback(text);
              }
            }
          }).catch((err) => {
            console.error("Erreur lors de l'injection:", err);
            copyToClipboardFallback(text);
          });
        } else {
          console.log("✅ Message de collage envoyé avec succès au content script");
        }
      });
    } catch (error) {
      console.error("Erreur lors du collage:", error);
      copyToClipboardFallback(text);
    }
  }

  function copyToClipboardFallback(text) {
    // Méthode 1: Utiliser l'API clipboard si disponible
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showNotification('✅ Texte copié ! Appuyez sur Cmd+V (ou Ctrl+V) pour coller.', 'success');
        })
        .catch((err) => {
          console.error("Erreur clipboard API:", err);
          // Méthode 2: Fallback avec textarea temporaire
          fallbackCopyMethod(text);
        });
    } else {
      fallbackCopyMethod(text);
    }
  }

  function fallbackCopyMethod(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        showNotification('✅ Texte copié ! Appuyez sur Cmd+V (ou Ctrl+V) pour coller.', 'success');
      } else {
        showNotification('❌ Impossible de copier le texte', 'error');
      }
    } catch (err) {
      console.error('Erreur execCommand:', err);
      showNotification('❌ Impossible de copier le texte', 'error');
    }

    document.body.removeChild(textarea);
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
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
});
