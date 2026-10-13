document.addEventListener('DOMContentLoaded', function () {
  console.log('popup.js chargé et DOMContentLoaded déclenché');

  const startBtn = document.getElementById('startRecording');
  const stopBtn = document.getElementById('stopRecording');
  const copyBtn = document.getElementById('copyText');
  const cleanBtn = document.getElementById('cleanText');
  const restartBtn = document.getElementById('restartRecording');
  const transcribedText = document.getElementById('transcribedText');
  const writeEmailBtn = document.getElementById('writeEmail');
  let mediaRecorder;
  let audioChunks = [];
  let cursorPosition = 0;

  // Vérifie si les boutons existent avant de poursuivre
  if (!startBtn || !stopBtn || !copyBtn || !cleanBtn || !restartBtn || !writeEmailBtn) {
    console.error('Un ou plusieurs éléments nécessaires n\'ont pas été trouvés dans le DOM.');
    return;
  }

  if (!transcribedText) {
    console.error('L\'élément transcribedText n\'a pas été trouvé.');
    return;
  }

  // Gestion du curseur dans le champ de texte
  transcribedText.addEventListener('click', function() {
    cursorPosition = this.selectionStart;
  });

  transcribedText.addEventListener('keyup', function() {
    cursorPosition = this.selectionStart;
  });

  // Vérifiez si restartBtn n'est pas null avant d'ajouter l'écouteur d'événements
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

  // Fonction pour démarrer l'enregistrement
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

        // Arrêter l'enregistrement après 2 minutes
        setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === "recording") {
            console.log('Arrêt automatique de l\'enregistrement après 2 minutes...');
            stopRecording();
          }
        }, 120000); // 2 minutes
      })
      .catch(error => {
        console.error('Erreur lors de l\'accès au microphone:', error);
        console.error('Nom de l\'erreur:', error.name);
        console.error('Message:', error.message);
        let errorMsg = `Erreur : ${error.name}\n${error.message}`;
        if (error.name === 'NotAllowedError') {
          errorMsg += '\n\nVeuillez autoriser l\'accès au microphone dans les paramètres de Chrome.';
        } else if (error.name === 'NotFoundError') {
          errorMsg += '\n\nAucun microphone détecté sur votre appareil.';
        }
        alert(errorMsg);
        startBtn.disabled = false; // Réactiver le bouton en cas d'erreur
      });
  }

  // Fonction pour arrêter l'enregistrement
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

        // Arrêter toutes les pistes audio
        if (mediaRecorder.stream) {
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }

        // Réactiver le bouton de démarrage
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

    fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
        // Ne définissez pas 'Content-Type' lors de l'envoi de FormData
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
          let errorMessage = 'Erreur de transcription';
          
          if (data.error.code === 'insufficient_quota') {
            errorMessage = '⚠️ QUOTA OPENAI DÉPASSÉ\n\n' +
                          'Votre compte OpenAI n\'a plus de crédits disponibles.\n\n' +
                          'Solutions :\n' +
                          '1. Visitez https://platform.openai.com/account/billing\n' +
                          '2. Ajoutez des crédits à votre compte\n' +
                          '3. Vérifiez votre plan d\'abonnement\n\n' +
                          'Détails : ' + data.error.message;
          } else {
            errorMessage = 'Erreur lors de la transcription :\n' + 
                          (data.error.message || JSON.stringify(data));
          }
          
          alert(errorMessage);
        } else {
          console.error('Erreur lors de la transcription:', data);
          alert('Erreur lors de la transcription : ' + JSON.stringify(data));
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
            {
              role: 'system',
              content: 'You are a helpful assistant.'
            },
            {
              role: 'user',
              content: `Corrige ce texte pour qu'il soit grammaticalement correct et bien formaté. N'hésite pas à réorganiser les idées en paragraphes, mais n'ajoute pas de nouvelles phrases :\n\n${text}`
            }
          ],
          max_tokens: 1000,
          temperature: 0.2,
          n: 1
        })
      });

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        console.log('Texte nettoyé avec succès par l\'API.');
        return data.choices[0].message.content.trim();
      } else if (data.error) {
        console.error('Erreur lors du nettoyage du texte:', data);
        let errorMessage = 'Erreur de nettoyage du texte';
        
        if (data.error.code === 'insufficient_quota') {
          errorMessage = '⚠️ QUOTA OPENAI DÉPASSÉ\n\n' +
                        'Votre compte OpenAI n\'a plus de crédits disponibles.\n\n' +
                        'Solutions :\n' +
                        '1. Visitez https://platform.openai.com/account/billing\n' +
                        '2. Ajoutez des crédits à votre compte\n' +
                        '3. Vérifiez votre plan d\'abonnement\n\n' +
                        'Détails : ' + data.error.message;
        } else {
          errorMessage = 'Erreur lors du nettoyage du texte :\n' + 
                        (data.error.message || JSON.stringify(data));
        }
        
        alert(errorMessage);
        return text;
      } else {
        console.error('Erreur lors du nettoyage du texte:', data);
        alert('Erreur lors du nettoyage du texte : ' + JSON.stringify(data));
        return text;
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'API:', error);
      alert('Erreur lors de l\'appel à l\'API : ' + error.message);
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
            {
              role: 'system',
              content: 'You are a helpful assistant specifically tailored for email generation.'
            },
            {
              role: 'user',
              content: `À partir du texte suivant, écris un email professionnel :\n\n${text}`
            }
          ],
          max_tokens: 1000,
          temperature: 0.5
        })
      });

      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        console.log('Email généré avec succès par l\'API.');
        return data.choices[0].message.content.trim();
      } else if (data.error) {
        console.error('Erreur lors de la génération de l\'email:', data);
        let errorMessage = 'Erreur de génération de l\'email';
        
        if (data.error.code === 'insufficient_quota') {
          errorMessage = '⚠️ QUOTA OPENAI DÉPASSÉ\n\n' +
                        'Votre compte OpenAI n\'a plus de crédits disponibles.\n\n' +
                        'Solutions :\n' +
                        '1. Visitez https://platform.openai.com/account/billing\n' +
                        '2. Ajoutez des crédits à votre compte\n' +
                        '3. Vérifiez votre plan d\'abonnement\n\n' +
                        'Détails : ' + data.error.message;
        } else {
          errorMessage = 'Erreur lors de la génération de l\'email :\n' + 
                        (data.error.message || JSON.stringify(data));
        }
        
        alert(errorMessage);
        return '';
      } else {
        console.error('Erreur lors de la génération de l\'email:', data);
        alert('Erreur lors de la génération de l\'email : ' + JSON.stringify(data));
        return '';
      }
    } catch (error) {
      console.error('Erreur lors de l\'appel à l\'API:', error);
      alert('Erreur lors de l\'appel à l\'API : ' + error.message);
      return '';
    }
  }
});
