# ToolWeb - Extension Chrome pour formateurs

## Description
Extension Chrome (Manifest V3) fournissant des outils de productivité pour formateurs/enseignants : dictée vocale IA, traduction en temps réel, historique presse-papiers, affichage grand format, loupe numérique et tutos GIF (capture d'onglet ou d'écran → GIF animé → Google Drive).

## Architecture
- **manifest.json** : Configuration extension (Manifest V3), permissions, scripts
- **background.js** : Service worker - gestion clic icône, historique presse-papiers (chrome.storage.local, max 20 items), orchestration Tuto GIF (offscreen document, état dans chrome.storage.session) et envoi Drive
- **content.js** (~1378 lignes) : Script injecté dans les pages - sidebar, traduction, loupe, affichage grand format, insertion texte
- **sidepanel.js** (~1036 lignes) : Logique UI principale - enregistrement audio, appels API, gestion historique, navigation onglets
- **sidepanel.html** (~907 lignes) : Interface sidebar avec onglets (loupe, affichage, dictée, presse-papiers, traduction)
- **sidebar.css** : Styles sidebar, traduction, animations
- **config.js** : Clé API OpenAI (NON versionné, dans .gitignore)
- **config.example.js** : Template de configuration
- **offscreen.html / offscreen.js** : Tuto GIF - page invisible qui filme (tabCapture ou getDisplayMedia) et encode le GIF au fil de l'eau ; survit aux changements de page
- **gif-db.js** : accès IndexedDB partagé (GIF sous la clé `last-gif`)
- **gif-viewer.html / gif-viewer.js** : aperçu du GIF en grand, iframe plein écran par-dessus la page
- **lib/gifenc.esm.js** : encodeur GIF (gifenc 1.0.3, MIT, copié tel quel)
- **PLAN-tutogif.md** : plan, décisions et état d'avancement du Tuto GIF
- **popup.html/popup.js** : Interface legacy/obsolète

## Stack technique
- Vanilla HTML/CSS/JavaScript (pas de framework)
- Chrome Extension APIs (Manifest V3) : storage, tabs, scripting, activeTab, clipboard, offscreen, tabCapture, identity
- OpenAI API : Whisper (transcription audio), GPT-4 (nettoyage texte, génération emails)
- Google Translate API (gratuite, sans auth)
- Web Audio API + MediaRecorder (enregistrement)
- QR Server API (codes QR pour affichage grand format)
- Google Drive API v3 (envoi des GIF) : OAuth via `chrome.identity`, client « Extension Chrome » du projet Google Cloud `gen-lang-client-0679844807` (« ToolWeb »), portée `drive`
- Identifiant d'extension figé par le champ `key` du manifeste : `fkelkmjdffkplaldldpfelekabmblimh` (le client OAuth en dépend : ne pas retirer `key`)

## Fonctionnalités principales
1. **Dictée & Transcription** (🎤) : Enregistrement micro → WAV → Whisper → texte
2. **Nettoyage IA** (✨) : GPT-4 corrige grammaire/structure (temperature 0.2)
3. **Génération email** (📧) : GPT-4 transforme notes en email pro (temperature 0.5)
4. **Presse-papiers** (📋) : Capture copies, historique 20 items, phrases rapides
5. **Affichage grand format** (📺) : Overlay plein écran 72px + QR code
6. **Traduction** (🌐) : Clic sur mot → traduction Google (13 langues)
7. **Loupe** (🔍) : Zoom circulaire suivant le curseur (taille, obscurité, zoom configurables)
8. **Tuto GIF** (🎬, Chrome uniquement) : modes Onglet / Écran entier, décompte 3-2-1, bande Stop, halo de clic, curseur simulé (mode Onglet), miniature + aperçu en grand, téléchargement, envoi vers un dossier Drive avec copie du lien

## Communication inter-composants
- `chrome.runtime.sendMessage` : content.js ↔ background.js
- `postMessage` : content.js ↔ sidepanel.js (iframe)
- `chrome.storage.onChanged` : synchronisation état entre composants

## Conventions
- Interface et commentaires en français
- Logs console avec emojis pour le debug
- Pas de tests automatisés
- Pas de bundler/build - fichiers JS directs
- Interface : un nouvel onglet réutilise les briques des onglets existants (bandeau de titre coloré, tuiles `quick-icon-btn`, encadré `magnifier-controls` + `control-group`). Attention : une classe réutilisée peut porter un gestionnaire de clic (ex. `.quick-icon-btn` → affichage en grand, limité à `[data-display-icon]`)
- Ne pas forcer `style.display = 'block'` sur un conteneur dont le CSS est en `display: flex` (les espacements `gap` disparaissent) : remettre `''`

## Commandes
- Installation : copier `config.example.js` → `config.js`, ajouter clé OpenAI, charger dans `chrome://extensions` (mode développeur)
- Pas de commande build/test
