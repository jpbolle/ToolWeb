# ToolWeb - Extension Chrome pour formateurs

## Description
Extension Chrome (Manifest V3) fournissant des outils de productivité pour formateurs/enseignants : dictée vocale IA, traduction en temps réel, historique presse-papiers, affichage grand format, et loupe numérique.

## Architecture
- **manifest.json** : Configuration extension (Manifest V3), permissions, scripts
- **background.js** : Service worker - gestion clic icône, historique presse-papiers (chrome.storage.local, max 20 items)
- **content.js** (~1378 lignes) : Script injecté dans les pages - sidebar, traduction, loupe, affichage grand format, insertion texte
- **sidepanel.js** (~1036 lignes) : Logique UI principale - enregistrement audio, appels API, gestion historique, navigation onglets
- **sidepanel.html** (~907 lignes) : Interface sidebar avec onglets (loupe, affichage, dictée, presse-papiers, traduction)
- **sidebar.css** : Styles sidebar, traduction, animations
- **config.js** : Clé API OpenAI (NON versionné, dans .gitignore)
- **config.example.js** : Template de configuration
- **popup.html/popup.js** : Interface legacy/obsolète

## Stack technique
- Vanilla HTML/CSS/JavaScript (pas de framework)
- Chrome Extension APIs (Manifest V3) : storage, tabs, scripting, activeTab, clipboard
- OpenAI API : Whisper (transcription audio), GPT-4 (nettoyage texte, génération emails)
- Google Translate API (gratuite, sans auth)
- Web Audio API + MediaRecorder (enregistrement)
- QR Server API (codes QR pour affichage grand format)

## Fonctionnalités principales
1. **Dictée & Transcription** (🎤) : Enregistrement micro → WAV → Whisper → texte
2. **Nettoyage IA** (✨) : GPT-4 corrige grammaire/structure (temperature 0.2)
3. **Génération email** (📧) : GPT-4 transforme notes en email pro (temperature 0.5)
4. **Presse-papiers** (📋) : Capture copies, historique 20 items, phrases rapides
5. **Affichage grand format** (📺) : Overlay plein écran 72px + QR code
6. **Traduction** (🌐) : Clic sur mot → traduction Google (13 langues)
7. **Loupe** (🔍) : Zoom circulaire suivant le curseur (taille, obscurité, zoom configurables)

## Communication inter-composants
- `chrome.runtime.sendMessage` : content.js ↔ background.js
- `postMessage` : content.js ↔ sidepanel.js (iframe)
- `chrome.storage.onChanged` : synchronisation état entre composants

## Conventions
- Interface et commentaires en français
- Logs console avec emojis pour le debug
- Pas de tests automatisés
- Pas de bundler/build - fichiers JS directs

## Commandes
- Installation : copier `config.example.js` → `config.js`, ajouter clé OpenAI, charger dans `chrome://extensions` (mode développeur)
- Pas de commande build/test
