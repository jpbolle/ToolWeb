document.addEventListener('DOMContentLoaded', function () {
  console.log('sidepanel.js chargé et DOMContentLoaded déclenché');

  // Helper function pour envoyer des messages au content script
  // Comme on est dans une iframe, on utilise postMessage au lieu de chrome.tabs.sendMessage
  function sendMessageToContentScript(action, data = {}) {
    window.parent.postMessage({
      type: 'toolweb_message',
      action: action,
      ...data
    }, '*');
  }

  // Gestion du bouton de réduction de la sidebar (dans l'iframe)
  const collapseSidebarBtn = document.getElementById('collapseSidebarBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');

  // Fonction pour restaurer les 2 lignes parallèles verticales
  function resetButtonToLines() {
    if (collapseSidebarBtn) {
      collapseSidebarBtn.innerHTML = '<span class="line"></span><span class="line"></span>';
      collapseSidebarBtn.title = 'Réduire la sidebar';
    }
  }

  if (collapseSidebarBtn) {
    collapseSidebarBtn.addEventListener('click', function () {
      console.log('📉 Demande de réduction de la sidebar');
      sendMessageToContentScript('collapse_sidebar');
    });
  }

  // Gestion du bouton de fermeture complète
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', function () {
      console.log('🗑️ Demande de fermeture complète de la sidebar');

      // Désactiver le toggle de la loupe
      if (toggleMagnifier) {
        toggleMagnifier.checked = false;
        console.log('🔍 Toggle désactivé (fermeture sidebar)');
      }

      // Désactiver le toggle de la traduction
      if (toggleTranslation && toggleTranslation.checked) {
        toggleTranslation.checked = false;
        chrome.storage.local.set({ translationEnabled: false });
        sendMessageToContentScript('disable_translation');
        console.log('🌐 Toggle traduction désactivé (fermeture sidebar)');
      }

      sendMessageToContentScript('remove_sidebar');
    });
  }

  // Écouter quand la sidebar est réagrandie pour remettre les lignes
  // On vérifie périodiquement si le bouton est visible (ce qui signifie que la sidebar est agrandie)
  setInterval(() => {
    if (collapseSidebarBtn && collapseSidebarBtn.offsetParent !== null) {
      // Le bouton est visible, s'assurer qu'il a les 2 lignes verticales
      if (!collapseSidebarBtn.querySelector('.line')) {
        resetButtonToLines();
      }
    }
  }, 1000);

  // Gestion du toggle ON/OFF de la loupe
  const toggleMagnifier = document.getElementById('toggleMagnifier');

  if (toggleMagnifier) {
    toggleMagnifier.addEventListener('change', function() {
      if (this.checked) {
        // Toggle activé → Activer la loupe
        console.log('🔍 Toggle activé → Activation de la loupe');
        activateMagnifierFromPanel();
      } else {
        // Toggle désactivé → Désactiver la loupe
        console.log('🔍 Toggle désactivé → Désactivation de la loupe');
        sendMessageToContentScript('deactivate_all_tools');
      }
    });
  }

  // Gestion du toggle ON/OFF de la traduction
  const toggleTranslation = document.getElementById('toggleTranslation');
  const sourceLanguage = document.getElementById('sourceLanguage');
  const targetLanguage = document.getElementById('targetLanguage');

  if (toggleTranslation) {
    // Charger les paramètres sauvegardés
    chrome.storage.local.get(['translationEnabled', 'sourceLang', 'targetLang'], function(result) {
      toggleTranslation.checked = result.translationEnabled || false;
      if (sourceLanguage) sourceLanguage.value = result.sourceLang || 'auto';
      if (targetLanguage) targetLanguage.value = result.targetLang || 'fr';

      // Si la traduction est activée au chargement, l'activer
      if (result.translationEnabled) {
        sendTranslationSettings();
      }
    });

    // Gérer le changement du toggle
    toggleTranslation.addEventListener('change', function() {
      chrome.storage.local.set({ translationEnabled: this.checked });

      if (this.checked) {
        console.log('🌐 Toggle activé → Activation de la traduction');
        sendTranslationSettings();
      } else {
        console.log('🌐 Toggle désactivé → Désactivation de la traduction');
        sendMessageToContentScript('disable_translation');
      }
    });
  }

  // Gérer les changements de langue
  if (sourceLanguage) {
    sourceLanguage.addEventListener('change', function() {
      chrome.storage.local.set({ sourceLang: this.value });
      if (toggleTranslation.checked) {
        sendTranslationSettings();
      }
    });
  }

  if (targetLanguage) {
    targetLanguage.addEventListener('change', function() {
      chrome.storage.local.set({ targetLang: this.value });
      if (toggleTranslation.checked) {
        sendTranslationSettings();
      }
    });
  }

  // Fonction pour envoyer les paramètres de traduction au content script
  function sendTranslationSettings() {
    const settings = {
      enabled: toggleTranslation.checked,
      sourceLang: sourceLanguage.value,
      targetLang: targetLanguage.value
    };
    sendMessageToContentScript('enable_translation', settings);
    console.log('📤 Paramètres de traduction envoyés:', settings);
  }

  // Système de navigation par onglets
  const navIcons = document.querySelectorAll('.nav-icon');
  const toolSections = document.querySelectorAll('.tool-section');

  navIcons.forEach(icon => {
    icon.addEventListener('click', function () {
      const targetSection = this.getAttribute('data-section');

      // Désactiver tous les outils actifs sur la page
      sendMessageToContentScript('deactivate_all_tools');

      // Si on quitte la section loupe, désactiver le toggle
      if (targetSection !== 'magnifier' && toggleMagnifier) {
        toggleMagnifier.checked = false;
        console.log('🔍 Toggle désactivé (changement de section)');
      }

      // Si on quitte la section traduction, désactiver le toggle
      if (targetSection !== 'translation' && toggleTranslation && toggleTranslation.checked) {
        toggleTranslation.checked = false;
        chrome.storage.local.set({ translationEnabled: false });
        sendMessageToContentScript('disable_translation');
        console.log('🌐 Toggle traduction désactivé (changement de section)');
      }

      // Retirer la classe active de tous les icônes et sections
      navIcons.forEach(i => i.classList.remove('active'));
      toolSections.forEach(s => s.classList.remove('active'));

      // Activer l'icône cliqué et sa section correspondante
      this.classList.add('active');
      const sectionToShow = document.querySelector(`.tool-section[data-section="${targetSection}"]`);
      if (sectionToShow) {
        sectionToShow.classList.add('active');
      }

      console.log(`✅ Section activée: ${targetSection}`);

      // Ne PAS activer automatiquement la loupe
      // L'utilisateur doit activer le toggle manuellement
    });
  });

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

  // Gestionnaire pour les icônes d'information
  const infoIcons = document.querySelectorAll('.info-icon');
  infoIcons.forEach(icon => {
    icon.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const descId = this.getAttribute('data-desc-id');
      const element = document.getElementById(descId);
      if (element) {
        element.classList.toggle('show');
      }
    });
  });

  // Gestionnaire pour le toggle du presse-papiers
  const clipboardToggle = document.getElementById('clipboardToggle');
  if (clipboardToggle) {
    // Charger l'état sauvegardé (par défaut: true = activé)
    chrome.storage.local.get(['clipboardCaptureEnabled'], function (result) {
      // Si jamais défini, on active par défaut
      const isEnabled = result.clipboardCaptureEnabled === undefined ? true : result.clipboardCaptureEnabled;
      clipboardToggle.checked = isEnabled;
      console.log('📋 État initial du toggle:', isEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉE');
    });

    // Écouter les changements
    clipboardToggle.addEventListener('change', function () {
      const isEnabled = this.checked;
      chrome.storage.local.set({ clipboardCaptureEnabled: isEnabled }, () => {
        console.log('📋 Capture du presse-papiers:', isEnabled ? 'ACTIVÉE' : 'DÉSACTIVÉE');
      });
    });
  }

  // Gestionnaire pour le bouton "Effacer tout"
  const clearAllHistoryBtn = document.getElementById('clearAllHistory');
  if (clearAllHistoryBtn) {
    clearAllHistoryBtn.addEventListener('click', function () {
      chrome.storage.local.set({ clipboardHistory: [] }, () => {
        console.log('🗑️ Historique du presse-papiers effacé');
        updateHistoryUI([]);
      });
    });
  }

  // Écouter les mises à jour de l'historique
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.clipboardHistory) {
      updateHistoryUI(changes.clipboardHistory.newValue);
    }
  });

  // Fonction pour activer la loupe depuis le panneau
  function activateMagnifierFromPanel() {
    // Réinitialiser le curseur de zoom à 1.0
    if (magnifierZoomSlider) {
      magnifierZoomSlider.value = '1';
      magnifierZoomValue.textContent = '1.0x';
      console.log('✅ Curseur zoom réinitialisé à 1.0');
    }

    // Envoyer le message au content script pour activer la loupe
    sendMessageToContentScript('activate_magnifier');
    console.log("✅ Demande d'activation de la loupe envoyée");
  }

  // Gestionnaires pour les curseurs de la loupe
  const magnifierSizeSlider = document.getElementById('magnifierSize');
  const magnifierSizeValue = document.getElementById('magnifierSizeValue');
  const magnifierDarknessSlider = document.getElementById('magnifierDarkness');
  const magnifierDarknessValue = document.getElementById('magnifierDarknessValue');
  const magnifierZoomSlider = document.getElementById('magnifierZoom');
  const magnifierZoomValue = document.getElementById('magnifierZoomValue');

  // Initialiser les valeurs affichées au chargement
  if (magnifierSizeSlider && magnifierSizeValue) {
    magnifierSizeValue.textContent = magnifierSizeSlider.value + 'px';
  }
  if (magnifierDarknessSlider && magnifierDarknessValue) {
    magnifierDarknessValue.textContent = magnifierDarknessSlider.value + '%';
  }
  if (magnifierZoomSlider && magnifierZoomValue) {
    magnifierZoomSlider.value = '1';  // Force la valeur à 1 au démarrage
    magnifierZoomValue.textContent = '1.0x';
  }

  if (magnifierSizeSlider) {
    magnifierSizeSlider.addEventListener('input', function () {
      const size = this.value;
      magnifierSizeValue.textContent = size + 'px';
      updateMagnifierParams();
    });
  }

  if (magnifierDarknessSlider) {
    magnifierDarknessSlider.addEventListener('input', function () {
      const darkness = this.value;
      magnifierDarknessValue.textContent = darkness + '%';
      updateMagnifierParams();
    });
  }

  if (magnifierZoomSlider) {
    magnifierZoomSlider.addEventListener('input', function () {
      const zoom = parseFloat(this.value).toFixed(1);
      magnifierZoomValue.textContent = zoom + 'x';
      updateMagnifierParams();
    });
  }

  function updateMagnifierParams() {
    const params = {
      size: parseInt(magnifierSizeSlider.value),
      darkness: parseInt(magnifierDarknessSlider.value),
      zoom: parseFloat(magnifierZoomSlider.value)
    };

    sendMessageToContentScript('update_magnifier', { params: params });
  }

  // Gestionnaire pour l'affichage en grand
  if (showLargeDisplayBtn && displayText) {
    // Fonction pour afficher le texte
    const displayLargeText = function () {
      const text = displayText.value.trim();
      if (!text) {
        alert('Veuillez entrer du texte à afficher.');
        return;
      }

      // Envoyer le message au content script pour afficher l'overlay
      sendMessageToContentScript('show_large_display', { text: text });
      console.log("✅ Demande d'affichage en grand envoyée");
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

        // Tester les formats supportés et choisir le meilleur pour Whisper
        const mimeTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4',
          'audio/wav'
        ];

        let selectedMimeType = '';
        for (let mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            console.log('Format audio sélectionné:', mimeType);
            break;
          }
        }

        if (!selectedMimeType) {
          console.warn('Aucun format préféré supporté, utilisation du format par défaut');
          mediaRecorder = new MediaRecorder(stream);
        } else {
          mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
        }

        // Stocker le mimeType pour l'utiliser lors de la création du Blob
        mediaRecorder.recordedMimeType = selectedMimeType || 'audio/webm';

        // Démarrer l'enregistrement avec timeslice pour forcer la capture régulière
        mediaRecorder.start(100); // Capture toutes les 100ms
        console.log('Enregistrement démarré avec format:', mediaRecorder.recordedMimeType);

        mediaRecorder.ondataavailable = event => {
          if (event.data && event.data.size > 0) {
            audioChunks.push(event.data);
            console.log('Données audio disponibles, taille:', event.data.size, 'octets');
          }
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
      const recordedMimeType = mediaRecorder.recordedMimeType || 'audio/webm';
      mediaRecorder.onstop = () => {
        console.log('Enregistrement terminé, création du Blob audio...');
        const audioBlob = new Blob(audioChunks, { type: recordedMimeType });
        audioChunks = [];
        console.log('Données audio prêtes à être envoyées.');
        sendAudioToWhisperAPI(audioBlob, recordedMimeType);
        if (mediaRecorder.stream) {
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        startBtn.disabled = false;
      };
    } else {
      console.error('mediaRecorder n\'est pas initialisé.');
    }
  }

  async function convertToWav(audioBlob) {
    console.log('Conversion de l\'audio en WAV...');

    try {
      // Créer un contexte audio
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Lire le blob comme ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Décoder l'audio
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('Audio décodé:', audioBuffer.duration, 'secondes,', audioBuffer.numberOfChannels, 'canaux');

      // Analyser le niveau audio
      const channelData = audioBuffer.getChannelData(0);
      let maxAmplitude = 0;
      let totalAmplitude = 0;
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > maxAmplitude) maxAmplitude = abs;
        totalAmplitude += abs;
      }
      const avgAmplitude = totalAmplitude / channelData.length;

      console.log('📊 Analyse audio:');
      console.log('  - Amplitude maximale:', maxAmplitude.toFixed(4));
      console.log('  - Amplitude moyenne:', avgAmplitude.toFixed(4));
      console.log('  - Niveau audio:', maxAmplitude > 0.01 ? '✅ Détecté' : '❌ Trop faible ou silencieux');

      if (maxAmplitude < 0.01) {
        console.warn('⚠️ ATTENTION: L\'audio semble silencieux! Vérifiez votre microphone.');
        alert('⚠️ L\'audio enregistré semble silencieux.\nVérifiez que votre microphone fonctionne et que vous parlez assez fort.');
      }

      // Convertir en WAV
      const wavBlob = audioBufferToWav(audioBuffer);
      console.log('Conversion WAV terminée, taille:', wavBlob.size, 'octets');

      // Permettre de télécharger l'audio pour le tester
      window.lastRecordedWav = wavBlob;
      console.log('💾 Audio WAV disponible. Pour le télécharger et l\'écouter, tapez dans la console: downloadLastRecording()');

      return wavBlob;
    } catch (error) {
      console.error('Erreur lors de la conversion en WAV:', error);
      throw error;
    }
  }

  // Fonction globale pour télécharger le dernier enregistrement
  window.downloadLastRecording = function() {
    if (!window.lastRecordedWav) {
      console.error('Aucun enregistrement disponible');
      return;
    }
    const url = URL.createObjectURL(window.lastRecordedWav);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enregistrement_' + Date.now() + '.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('✅ Fichier téléchargé');
  };

  function audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    const data = [];
    for (let i = 0; i < numberOfChannels; i++) {
      data.push(audioBuffer.getChannelData(i));
    }

    const interleaved = interleave(data);
    const dataLength = interleaved.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // Écrire l'en-tête WAV
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Écrire les données audio
    floatTo16BitPCM(view, 44, interleaved);

    return new Blob([view], { type: 'audio/wav' });
  }

  function interleave(channelData) {
    const length = channelData[0].length;
    const numberOfChannels = channelData.length;
    const result = new Float32Array(length * numberOfChannels);

    let offset = 0;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        result[offset++] = channelData[channel][i];
      }
    }
    return result;
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function floatTo16BitPCM(view, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  async function sendAudioToWhisperAPI(audioBlob, mimeType) {
    console.log('Envoi de l\'audio au service Whisper pour transcription...');
    console.log('Taille du blob audio original:', audioBlob.size, 'octets');
    console.log('Type du blob original:', audioBlob.type);
    console.log('MimeType:', mimeType);
    console.log('Clé API présente:', CONFIG && CONFIG.OPENAI_API_KEY ? 'Oui (longueur: ' + CONFIG.OPENAI_API_KEY.length + ')' : 'Non');

    if (!CONFIG || !CONFIG.OPENAI_API_KEY) {
      alert('Erreur : Clé API OpenAI non trouvée. Vérifiez que config.js est bien chargé.');
      return;
    }

    if (audioBlob.size === 0) {
      alert('Erreur : Aucun audio enregistré. Le fichier audio est vide.');
      return;
    }

    // Convertir en WAV pour une meilleure compatibilité
    let finalBlob;
    try {
      finalBlob = await convertToWav(audioBlob);
    } catch (error) {
      console.error('Impossible de convertir en WAV, envoi du format original');
      finalBlob = audioBlob;
    }

    const formData = new FormData();
    formData.append('file', finalBlob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');
    formData.append('response_format', 'json');

    // API Key loaded from config.js
    fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
      },
      body: formData
    })
      .then(response => {
        console.log('Statut de la réponse:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('Réponse complète de Whisper:', data);
        console.log('Texte transcrit:', data.text);

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
        } else {
          console.warn('Réponse inattendue de l\'API:', data);
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

      // Fonction pour injecter le content script si nécessaire
      const ensureContentScript = async () => {
        try {
          // Essayer d'envoyer un message de test
          await chrome.tabs.sendMessage(tab.id, { action: "ping" });
          return true;
        } catch (error) {
          // Content script non chargé, l'injecter
          console.log("Injection du content script...");
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            // Attendre un peu que le script s'initialise
            await new Promise(resolve => setTimeout(resolve, 100));
            return true;
          } catch (injectionError) {
            console.error("Impossible d'injecter le content script:", injectionError);
            return false;
          }
        }
      };

      // S'assurer que le content script est chargé
      const scriptReady = await ensureContentScript();

      if (!scriptReady) {
        console.warn("Content script non disponible, fallback clipboard");
        copyToClipboardFallback(text);
        return;
      }

      // Envoyer le message au content script qui gère la logique Google Docs/Sheets vs autres sites
      chrome.tabs.sendMessage(tab.id, { action: "paste_text", text: text }, function (response) {
        if (chrome.runtime.lastError) {
          console.error("Erreur lors de l'envoi du message:", chrome.runtime.lastError.message);
          copyToClipboardFallback(text);
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
