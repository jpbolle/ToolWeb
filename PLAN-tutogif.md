# Plan — Onglet « Tuto GIF » 🎬 dans ToolWeb

> Rédigé le 2026-10-13 (session ouverte depuis `~/Documents/tutogif`, dossier vide abandonné).
> **Statut : plan à valider — aucune ligne de code écrite pour la fonction GIF.**
> La prochaine session repart d'ici, depuis le dossier `ToolWeb`.

## 1. Objectif

Un outil à la LICEcap intégré à ToolWeb : le formateur filme ce qu'il fait dans Chrome, et
ToolWeb produit un **GIF animé** qui met **les clics en évidence**. Le GIF peut ensuite
être **envoyé automatiquement dans un dossier Google Drive**.

- **Chrome uniquement** : la fonction ne sera pas portée dans `firefox/`.
- **Usage personnel** (extension locale, non publiée) : la clé OpenAI dans `config.js` ne
  pose pas de problème.

## 2. Déroulé voulu par l'utilisateur (non négociable)

1. Dans l'onglet 🎬 de la barre latérale → bouton **« Onglet »** ou **« Écran entier »**
   (cf. D1).
2. La barre latérale **se réduit** à sa bande étroite (40 px). Cette bande contient un
   **bouton Stop** (avec un chrono) et rien d'autre d'utile.
3. Le formateur fait sa démonstration.
4. Clic sur **Stop** → la barre latérale **réapparaît**, avec l'onglet 🎬 **actif**.
5. L'onglet affiche la **miniature** du GIF qui vient d'être produit.
6. Clic sur la miniature → **grande fenêtre d'aperçu** (dans la page, comme l'affichage
   grand format 📺) pour bien voir le GIF.

## 3. Fonctionnalités proposées en plus (à confirmer)

| Fonction | Commentaire |
|---|---|
| **Envoi vers Google Drive** | Dans un dossier choisi une fois pour toutes (réglage) |
| **Copier le lien Drive** | Directement dans le presse-papiers → le coller dans Classroom ou un support |
| **Nommer le GIF** avant l'envoi | Nom par défaut : `tuto-AAAA-MM-JJ-HHhMM.gif` |
| **Télécharger** en local | Secours si Drive n'est pas configuré |
| **Historique** des 10 derniers GIF | Miniatures dans l'onglet 🎬 ; état « envoyé / pas envoyé » |
| **Compte à rebours** 3-2-1 | Laisse le temps de se placer avant que la capture démarre |
| **Halo de clic** | Cercle coloré qui s'élargit à chaque clic (activable ou non) |
| **Réglages** | Images par seconde (8 par défaut), largeur maximale (960 px), durée maximale (60 s) |

## 4. Architecture technique

### Pourquoi l'enregistrement ne peut pas tourner dans la barre latérale

La barre latérale est un **iframe** (une page de l'extension incrustée dans le site
visité ; cf. `content.js` → `createSidebar()`). Si l'enregistrement tournait dedans, il
**mourrait au premier changement de page**. L'enregistrement vivra donc dans un
**offscreen document** (une page invisible de l'extension, qui survit à la navigation,
API `chrome.offscreen`).

### Qui fait quoi

| Composant | Rôle pour le GIF |
|---|---|
| `sidepanel.html` / `sidepanel.js` | Nouvel onglet 🎬 : bouton Enregistrer, miniatures, envoi Drive, réglages |
| `content.js` | Réduit la barre latérale pendant la capture, place le bouton Stop dans la bande, dessine le **halo de clic** (et le curseur simulé si capture d'onglet, voir D1), affiche l'**aperçu en grand** |
| `background.js` | Chef d'orchestre : reçoit « start » / « stop », crée l'offscreen document, obtient le flux vidéo, relaie les messages |
| **`offscreen.html` / `offscreen.js`** (nouveaux) | Reçoit le flux vidéo, prélève N images par seconde dans un `canvas`, encode le GIF à l'arrêt |
| **`lib/<encodeur>.js`** (nouveau) | Bibliothèque d'encodage GIF, copiée telle quelle car le projet n'a pas de *bundler* (outil qui assemble les fichiers JS) |
| `manifest.json` | Nouvelles permissions : `offscreen`, `tabCapture` **ou** `desktopCapture` (cf. D1), `identity` + bloc `oauth2` (Drive), `unlimitedStorage`, et un champ `key` (cf. §6) |
| `sidebar.css` | Styles de la bande en mode enregistrement (bouton Stop rouge, chrono) |

### Circuit des messages

```
onglet 🎬 (iframe) ──start──► background.js ──► offscreen.js (capture + images)
bande réduite : Stop ──► content.js ──stop──► background.js ──► offscreen.js (encodage GIF)
offscreen.js ──GIF prêt──► stockage IndexedDB ──► content.js ré-ouvre la barre
                                               └─► sidepanel.js affiche la miniature
```

- Les GIF sont stockés dans **IndexedDB** (base de données du navigateur, propre à
  l'extension), car `chrome.storage` n'est pas fait pour des fichiers de plusieurs Mo.
- **La bande réduite apparaîtra dans le GIF** (elle fait partie de la page) → la rogner
  (40 px à droite) au moment de l'encodage.

## 5. Décisions à faire trancher — UNE À LA FOIS, dans cet ordre

> Règle de méthode : présenter une décision, attendre la réponse, passer à la suivante.

**D1. Que filme-t-on ?**

| Option | Pour | Contre |
|---|---|---|
| **A. L'onglet** (`chrome.tabCapture`) — *recommandée* | Pas de fenêtre de choix à chaque fois, l'image suit l'onglet d'une page à l'autre, cadrage net sur la page | **Le vrai curseur n'est pas filmé** → `content.js` doit dessiner un curseur simulé (il connaît déjà la position de la souris, cf. la loupe) |
| B. L'écran ou une fenêtre (`chrome.desktopCapture`) | Vrai curseur ; peut filmer autre chose que Chrome | Fenêtre de choix Chrome à chaque enregistrement ; les clics hors page web ne sont pas mis en évidence |

À vérifier en phase 0 : avec l'option A, Chrome exige que la capture soit déclenchée par
un geste de l'utilisateur sur l'extension. Il faut tester qu'un clic dans l'iframe suffit.

> ✅ **Tranché le 2026-10-13 : les deux, au choix à chaque enregistrement.** L'onglet 🎬
> propose deux boutons : **« Onglet »** (option A, sans fenêtre de choix, curseur dessiné
> par ToolWeb) et **« Écran entier »** (option B, préférence de l'utilisateur pour « voir
> large » ; Chrome affiche sa fenêtre de choix, vrai curseur filmé).
> Conséquences :
> - permission `tabCapture` (mode Onglet) ; en mode Écran, `getDisplayMedia()` est appelé **dans l'offscreen document** (un flux choisi dans la barre latérale ne peut pas lui être transmis — essai du 2026-10-13 : « Error starting tab capture ») ;
> - en mode Écran, macOS demande une fois d'autoriser Chrome dans **Réglages Système →
>   Confidentialité → Enregistrement de l'écran** (sur les deux Mac) ;
> - le halo de clic ne s'affiche que dans les pages web, pas sur le reste de l'écran ;
> - le rognage de la bande de 40 px ne vaut qu'en mode Onglet (en mode Écran, sa
>   position dépend de la fenêtre) ;
> - phase 0 : vérifier que le flux « Écran » peut être repris par l'offscreen document.

**D2. Bibliothèque d'encodage GIF** (= ajout d'une dépendance → accord obligatoire)

| Option | Commentaire |
|---|---|
| **`gifenc`** (mattdesl, licence MIT) — *recommandée* | Un seul petit fichier, rapide, maintenu, se copie dans `lib/` |
| `gif.js` | Ancienne, plusieurs fichiers (*workers*, des scripts qui calculent en arrière-plan) |

> ✅ **Tranché le 2026-10-13 : `gifenc`**, copié dans `lib/`.

**D3. Envoi Drive : automatique dès l'arrêt, ou sur clic d'un bouton ?**
Recommandation : un **bouton**, car on voudra souvent jeter une prise ratée.

> ✅ **Tranché le 2026-10-13 : bouton « Envoyer vers Drive »**, après l'aperçu.

**D4. Quel projet Google Cloud** porte l'identifiant OAuth (l'autorisation d'accès à
Drive) ? Réutiliser un projet existant (Firebase de l'utilisateur) ou en créer un dédié.
Le compte est `cnddinant.be` (Google Workspace) → écran de consentement en mode
**« Interne »**, sans validation par Google. Droit demandé : `drive.file` (l'extension ne
voit que les fichiers qu'elle a créés elle-même).

> ✅ **Tranché le 2026-10-13 : projet `gen-lang-client-0679844807`**, renommé de
> « hgjhessai » en **« ToolWeb »** (organisation `cnddinant.be`, facturation active).
> Il contient aussi une **clé API Gemini** (créée le 2026-03-05) qu'une autre app utilise
> peut-être → ne jamais supprimer ce projet ni cette clé sans vérifier.

**D5. Connexion Google et dossier Drive** — ✅ tranché le 2026-10-13 :
- Chrome est connecté avec le compte `@cnddinant.be` sur les deux Mac → `chrome.identity.getAuthToken`
  (pas de fenêtre de connexion), client OAuth de type « Extension Chrome ».
- Dossier **existant et public** (« accès anonyme public », choix assumé : « un tuto, cela se
  partage ») → les GIF héritent du partage public. Le lien du dossier se colle dans un réglage
  de l'onglet 🎬.
- Portée **`drive` complète** (choix de l'utilisateur : extension locale, non déployée), plutôt
  que `drive.file` + dossier créé par ToolWeb.
- Identifiant d'extension figé par le champ `key` du manifeste : **`fkelkmjdffkplaldldpfelekabmblimh`**.
  Clé privée : `~/Documents/toolweb-key.pem`, **hors du dossier** de l'extension (Chrome avertit sinon) ; inutile pour l'extension non empaquetée.
- API Google Drive activée dans le projet le 2026-10-13.
- Écran de consentement « Interne » configuré ; client OAuth « Extension Chrome » créé :
  `1045022749271-bn95r5mkjv8mnhgtsgsji7fv5788u2s5.apps.googleusercontent.com` (bloc `oauth2` du manifeste).

## 6. Manipulations à la charge de l'utilisateur

> À donner **une étape à la fois**, avec attente du « ok » entre chaque.

- Figer l'**identifiant de l'extension** : une extension chargée « non empaquetée » change
  d'identifiant selon son dossier, donc selon le Mac. Or l'autorisation Google est liée à
  cet identifiant → ajouter un champ `key` au `manifest.json` (l'agent génère la clé).
- Google Cloud Console : activer l'**API Google Drive**, configurer l'écran de consentement
  (Interne), créer un **identifiant OAuth de type « Extension Chrome »** avec l'ID figé.
- Recharger l'extension dans `chrome://extensions` sur **les deux Mac**.

## 7. Phases de réalisation

| Phase | Contenu | Résultat visible |
|---|---|---|
| **0. Preuve de faisabilité** | Capture selon D1 depuis l'offscreen document, vérifier le déclenchement depuis l'iframe | Une vidéo brute s'enregistre et survit à un changement de page |
| **1. GIF local** | Onglet 🎬, réduction en bande + Stop, encodage, miniature, aperçu en grand, téléchargement | Le déroulé du §2 fonctionne de bout en bout, sans Drive |
| **2. Habillage** | Halo de clic, curseur simulé (si D1 = A), compte à rebours, rognage de la bande | GIF lisible comme un vrai tuto |
| **3. Drive** | Manipulations du §6, envoi, copie du lien, choix du dossier | Le GIF arrive dans Drive, lien dans le presse-papiers |
| **4. Confort** | Historique, nommage, réglages | — |

Chaque phase se termine par un test réel dans Chrome avant de passer à la suivante.

> ✅ **Phase 0 — validée le 2026-10-13** par test réel (modes Onglet et Écran entier). Fichiers : `offscreen.html`,
> `offscreen.js`, `gif-db.js` (accès IndexedDB partagé) ; modifiés : `background.js`,
> `manifest.json`, `sidepanel.html`, `sidepanel.js`. La vidéo brute (WebM) est gardée
> dans IndexedDB sous la clé `last-raw`, avec aperçu et téléchargement dans l'onglet 🎬.
>
> ✅ **Phase 1 — validée le 2026-10-13** par test réel (Onglet et Écran entier). ⏳ À vérifier
> plus tard : impression que le GIF « va vite » → test du chronomètre (enregistrer un
> chronomètre en ligne 15 s, comparer). Le code garde la durée réelle de chaque image.
> Encodage au fil de l'eau
> dans `offscreen.js` (lecture des images par `MediaStreamTrackProcessor`, 8 im/s, 960 px,
> 60 s max, palette `rgb444`) → GIF stocké sous la clé `last-gif`. Bande Stop gérée par
> `content.js` (état lu dans `chrome.storage.session`, ouvert aux content scripts par
> `background.js`) ; aperçu en grand = `gif-viewer.html` en iframe plein écran ;
> bibliothèque `lib/gifenc.esm.js` (v1.0.3, intégrité npm vérifiée).
>
> ✅ **Phase 2 — validée le 2026-10-13** en mode Onglet (décompte, halo, curseur, rognage).
> Mode Écran entier non re-testé après la phase 2 (choix de l'utilisateur, à vérifier à l'occasion).
> Décompte 3-2-1 affiché par
> `content.js`, non filmé (`offscreen.js` ignore les images avant `startedAt` et ouvre le GIF
> sur la dernière image du décompte) ; halo orange au `mousedown` dans tous les cadres
> (interrupteur mémorisé `gifClickHalo`) ; curseur simulé en mode Onglet ; bande Stop rognée
> en mode Onglet (40 px / largeur de l'onglet, calculé par `background.js`).
>
> ✅ **Phase 3 — validée le 2026-10-13** : GIF envoyé dans le dossier Drive public par test réel.
> Envoi par `background.js` (`uploadGifToDrive`, multipart, nouvel essai si jeton expiré) ;
> lien copié automatiquement ; dossier mémorisé dans `chrome.storage.local` (`gifDriveFolderId`).
>
> ✅ **Phase 4 — validée le 2026-10-13** (interface approuvée après plusieurs passes). Historique des 10 derniers GIF
> (clés `gif-<date>` dans IndexedDB, `gifHistoryPrune` ; l'ancien `last-gif` est repris),
> renommage (champ sous la miniature, nom gardé avec le GIF), 🗑️ du GIF actif (second clic
> pour confirmer, sans popup ; le fichier Drive reste), réglages en curseurs (`gifSettings`).
> Interface de l'onglet 🎬 refaite **avec les briques des autres onglets** (demande de
> l'utilisateur) : bandeau + toggle Halo, tuiles emoji, bouton pointillé ⚙️, encadré de curseurs.
> Corrigé au passage : miniature limitée à 60 % (règle globale `img`) et capture d'onglet en
> 640 × 480 avec bandes noires (taille de l'onglet désormais imposée).
>
> **Reste à vérifier** : disparition des bandes noires sur un nouveau GIF « Onglet » ; test du
> chronomètre (vitesse) ; essai « Écran entier » depuis la phase 2. **Autre Mac** : recréer
> `config.js`, coller le lien du dossier Drive dans ⚙️. **Version** : passée en 2.4 (accord du 2026-10-13).

## 8. Points de vigilance

- **Poids des GIF** : 256 couleurs, pas de son, lourd au-delà de 30 à 60 s. Limiter la
  durée, la largeur et la fréquence d'images (réglages du §3).
- **Mémoire** : les images sont gardées jusqu'à l'encodage → plafond de durée obligatoire.
- **Mise à jour de l'extension** : Chrome peut demander d'accepter les nouvelles
  permissions au rechargement.
- ✅ `AGENTS.md` mis à jour le 2026-10-13 (onglet 🎬, offscreen document, Drive).

## 9. État du dépôt (mis à jour le 2026-10-13, session suivante)

- 🚨 **Clé OpenAI exposée** : elle était écrite en clair dans `popup.js` et
  `firefox/popup.js` (fichiers « legacy », non utilisés par le manifeste), publiés sur le
  dépôt **public** `jpbolle/ToolWeb` depuis le premier commit.
  - ✅ Corrigé dans le code : les deux fichiers lisent désormais `CONFIG.OPENAI_API_KEY`
    depuis `config.js` (ajouté dans `popup.html` et `firefox/popup.html`). `config.js`
    était déjà exclu par le `.gitignore`.
  - ✅ **Ancienne clé révoquée** chez OpenAI (elle reste lisible dans l'historique git,
    mais ne sert plus à rien).
  - ✅ Nouvelle clé placée dans `config.js`, testée le 2026-10-13 (réponse OpenAI 200).
  - ⚠️ `config.js` n'étant pas versionné, il faut le recréer à la main sur **l'autre
    Mac**. `firefox/config.js` existe mais contient encore le texte du modèle.
- Corrections commitées dans `edd25e4`.
- La copie inutile `~/Documents/ToolWeb-main` a été mise à la Corbeille.
