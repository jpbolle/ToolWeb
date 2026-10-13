// offscreen.js — Enregistrement de l'onglet ou de l'écran et fabrication du GIF (Tuto GIF 🎬).
// Tourne dans un offscreen document (page invisible de l'extension) : contrairement à la
// barre latérale (iframe dans la page), il ne meurt pas quand on change de page.
// Les images sont converties en GIF au fil de l'eau : rien ne s'accumule en mémoire.

import { GIFEncoder, quantize, applyPalette } from './lib/gifenc.esm.js';

// Réglages par défaut, remplacés par ceux de l'onglet 🎬 (⚙️ Réglages) à chaque démarrage
const DEFAULT_SETTINGS = { fps: 8, maxWidth: 960, maxDurationS: 60 };
let frameInterval = 1000 / DEFAULT_SETTINGS.fps;   // écart entre deux images, en ms
let maxWidth = DEFAULT_SETTINGS.maxWidth;          // largeur maximale du GIF, en pixels
let maxDurationMs = DEFAULT_SETTINGS.maxDurationS * 1000; // au-delà : arrêt automatique
const COLOR_FORMAT = 'rgb444';    // le plus rapide, suffisant pour des captures d'écran
const COUNTDOWN_MS = 3000;        // compte à rebours 3-2-1 affiché par content.js, non filmé

let stream = null;
let reader = null;
let gif = null;
let canvas = null;
let ctx = null;
let width = 0;
let height = 0;
let pending = null;     // dernière image, écrite quand on connaît sa durée d'affichage
let startedAt = 0;       // début réel du GIF (après le compte à rebours), horloge performance.now()
let lastSampleAt = 0;
let preFrame = null;     // dernière image reçue pendant le compte à rebours (début du GIF)
let cropRight = 0;       // part de la largeur à rogner à droite (bande Stop, mode Onglet)
let frameCount = 0;
let captureMode = null;
let stopping = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  if (message.action === 'start_capture') {
    startCapture(message.streamId, message.mode, message.cropRight || 0, message.settings, message.captureSize)
      .then((startAt) => sendResponse({ ok: true, startAt }))
      .catch((error) => {
        console.error('❌ Démarrage de la capture impossible:', error);
        cleanup();
        sendResponse({ ok: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.action === 'stop_capture') {
    stopCapture();
    sendResponse({ ok: true });
  }
});

// Renvoie l'heure (Date.now) où le GIF commence vraiment, à la fin du compte à rebours
async function startCapture(streamId, mode, crop, settings, captureSize) {
  if (stream) throw new Error('Un enregistrement est déjà en cours');

  const chosen = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  frameInterval = 1000 / chosen.fps;
  maxWidth = chosen.maxWidth;
  maxDurationMs = chosen.maxDurationS * 1000;

  if (mode === 'tab') {
    // Flux de l'onglet, obtenu par background.js via chrome.tabCapture.
    // Taille imposée = taille réelle de l'onglet : sinon 640 × 480 avec bandes noires.
    const mandatory = { chromeMediaSource: 'tab', chromeMediaSourceId: streamId };
    if (captureSize) {
      Object.assign(mandatory, {
        minWidth: captureSize.width, maxWidth: captureSize.width,
        minHeight: captureSize.height, maxHeight: captureSize.height
      });
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory } });
  } else {
    // Écran : la page invisible demande elle-même (fenêtre de choix de Chrome).
    // Un flux choisi ailleurs (barre latérale) ne peut pas lui être transmis.
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: { displaySurface: 'monitor' }
    });
  }

  const track = stream.getVideoTracks()[0];
  // Bouton « Arrêter le partage » de Chrome → on arrête proprement
  track.addEventListener('ended', stopCapture);

  captureMode = mode;
  cropRight = crop;
  gif = GIFEncoder();
  pending = null;
  preFrame = null;
  frameCount = 0;
  width = 0;
  stopping = false;
  // Le compte à rebours démarre une fois le flux obtenu (après la fenêtre de choix en mode Écran)
  startedAt = performance.now() + COUNTDOWN_MS;
  lastSampleAt = -Infinity;
  const startAt = Date.now() + COUNTDOWN_MS;

  // Lecteur d'images du flux (créé ici : une erreur remonte à la barre latérale)
  reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
  readFrames();
  console.log('🎬 Capture démarrée, mode:', mode);
  return startAt;
}

// Lit les images du flux vidéo au rythme où Chrome les produit, et en garde « fps » par seconde
async function readFrames() {
  try {
    while (true) {
      const { value: frame, done } = await reader.read();
      if (done) break;
      const now = performance.now();

      // Pendant le compte à rebours : on garde seulement la dernière image, qui ouvrira le GIF
      // (une page immobile ne produit pas d'image nouvelle après le décompte)
      if (now < startedAt) {
        if (preFrame) preFrame.close();
        preFrame = frame;
        continue;
      }
      flushPreFrame();

      if (now - lastSampleAt >= frameInterval) {
        lastSampleAt = now;
        try {
          addFrame(frame, now);
        } catch (error) {
          console.error('❌ Image ignorée:', error);
        }
      }
      frame.close();
      if (now - startedAt >= maxDurationMs) {
        console.log('⏱️ Durée maximale atteinte, arrêt automatique');
        stopCapture();
      }
    }
  } catch (error) {
    console.warn('⚠️ Lecture du flux interrompue:', error);
  }
  await finishGif();
}

function flushPreFrame() {
  if (!preFrame) return;
  try {
    addFrame(preFrame, startedAt);
    lastSampleAt = startedAt;
  } catch (error) {
    console.error('❌ Image de départ ignorée:', error);
  }
  preFrame.close();
  preFrame = null;
}

function addFrame(frame, now) {
  // Zone source : l'image entière, moins la bande Stop à droite en mode Onglet
  const sourceWidth = Math.round(frame.displayWidth * (1 - cropRight));
  const sourceHeight = frame.displayHeight;

  if (!width) {
    // Taille fixée sur la première image, réduite à maxWidth en gardant les proportions
    const scale = Math.min(1, maxWidth / sourceWidth);
    width = Math.round(sourceWidth * scale);
    height = Math.round(sourceHeight * scale);
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }

  ctx.drawImage(frame, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const palette = quantize(data, 256, { format: COLOR_FORMAT });
  const index = applyPalette(data, palette, COLOR_FORMAT);

  writePending(now);
  pending = { index, palette, at: now };
}

// Écrit l'image en attente, avec le temps réellement écoulé jusqu'à la suivante
// (une page immobile ne produit pas d'images : la précédente reste affichée)
function writePending(until) {
  if (!pending) return;
  gif.writeFrame(pending.index, width, height, {
    palette: pending.palette,
    delay: Math.max(20, Math.round(until - pending.at))
  });
  frameCount++;
  pending = null;
}

function stopCapture() {
  if (!stream || stopping) return;
  stopping = true;
  stream.getTracks().forEach((track) => track.stop());
  if (reader) reader.cancel().catch(() => {});
}

async function finishGif() {
  const durationMs = Math.max(0, performance.now() - startedAt);
  if (performance.now() >= startedAt) flushPreFrame();
  writePending(performance.now());

  try {
    if (frameCount === 0) throw new Error('Aucune image capturée (arrêt pendant le compte à rebours ?)');
    gif.finish();
    const blob = new Blob([gif.bytes()], { type: 'image/gif' });
    const capture = { blob, mode: captureMode, width, height, frameCount, durationMs, createdAt: Date.now() };
    await gifDbPut(gifKey(capture.createdAt), capture);
    await gifHistoryPrune(); // historique limité aux GIF_HISTORY_MAX plus récents
    console.log('💾 GIF enregistré:', frameCount, 'images,', Math.round(blob.size / 1024), 'Ko');
    chrome.runtime.sendMessage({ action: 'gif_capture_saved', key: gifKey(capture.createdAt), size: blob.size, durationMs });
  } catch (error) {
    console.error('❌ Fabrication du GIF impossible:', error);
    chrome.runtime.sendMessage({ action: 'gif_capture_failed', error: error.message || String(error) });
  } finally {
    cleanup();
  }
}

function cleanup() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  reader = null;
  gif = null;
  pending = null;
  if (preFrame) preFrame.close();
  preFrame = null;
  canvas = null;
  ctx = null;
  stopping = false;
}
