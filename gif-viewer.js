// gif-viewer.js — Aperçu en grand du dernier GIF (Tuto GIF 🎬).
// Page de l'extension affichée en plein écran par content.js : elle lit le GIF
// directement dans IndexedDB, ce qui évite les blocages de sécurité de certains sites.

const gifInfo = document.getElementById('info');

function closeViewer() {
  window.parent.postMessage({ type: 'toolweb_message', action: 'close_gif_preview' }, '*');
}

document.getElementById('close').addEventListener('click', closeViewer);
document.body.addEventListener('click', (event) => {
  if (event.target === document.body) closeViewer(); // clic à côté du GIF
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeViewer();
});

// Le GIF à afficher est désigné dans l'adresse : gif-viewer.html?key=gif-<date>
const gifKeyParam = new URLSearchParams(location.search).get('key');

gifDbGet(gifKeyParam)
  .then((capture) => {
    if (!capture) {
      gifInfo.textContent = 'Aucun GIF enregistré.';
      return;
    }
    const gifImage = document.createElement('img');
    gifImage.id = 'gif';
    gifImage.alt = 'Aperçu du GIF';
    gifImage.src = URL.createObjectURL(capture.blob);
    document.body.insertBefore(gifImage, gifInfo);
    const seconds = Math.round(capture.durationMs / 1000);
    gifInfo.textContent = `${capture.width} × ${capture.height} px · ${seconds} s · ${Math.round(capture.blob.size / 1024)} Ko`;
  })
  .catch((error) => {
    console.error('❌ Lecture du GIF impossible:', error);
    gifInfo.textContent = 'Impossible de lire le GIF : ' + error.message;
  });
