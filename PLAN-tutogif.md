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

1. Dans l'onglet 🎬 de la barre latérale → bouton **« Enregistrer »**.
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

**D2. Bibliothèque d'encodage GIF** (= ajout d'une dépendance → accord obligatoire)

| Option | Commentaire |
|---|---|
| **`gifenc`** (mattdesl, licence MIT) — *recommandée* | Un seul petit fichier, rapide, maintenu, se copie dans `lib/` |
| `gif.js` | Ancienne, plusieurs fichiers (*workers*, des scripts qui calculent en arrière-plan) |

**D3. Envoi Drive : automatique dès l'arrêt, ou sur clic d'un bouton ?**
Recommandation : un **bouton**, car on voudra souvent jeter une prise ratée.

**D4. Quel projet Google Cloud** porte l'identifiant OAuth (l'autorisation d'accès à
Drive) ? Réutiliser un projet existant (Firebase de l'utilisateur) ou en créer un dédié.
Le compte est `cnddinant.be` (Google Workspace) → écran de consentement en mode
**« Interne »**, sans validation par Google. Droit demandé : `drive.file` (l'extension ne
voit que les fichiers qu'elle a créés elle-même).

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

## 8. Points de vigilance

- **Poids des GIF** : 256 couleurs, pas de son, lourd au-delà de 30 à 60 s. Limiter la
  durée, la largeur et la fréquence d'images (réglages du §3).
- **Mémoire** : les images sont gardées jusqu'à l'encodage → plafond de durée obligatoire.
- **Mise à jour de l'extension** : Chrome peut demander d'accepter les nouvelles
  permissions au rechargement.
- `AGENTS.md` sera à mettre à jour (nouvel onglet 🎬, offscreen document, Drive).

## 9. État du dépôt à la fin de cette session (2026-10-13)

- 🚨 **Clé OpenAI exposée** : elle était écrite en clair dans `popup.js` et
  `firefox/popup.js` (fichiers « legacy », non utilisés par le manifeste), publiés sur le
  dépôt **public** `jpbolle/ToolWeb` depuis le premier commit.
  - ✅ Corrigé dans le code : les deux fichiers lisent désormais `CONFIG.OPENAI_API_KEY`
    depuis `config.js` (ajouté dans `popup.html` et `firefox/popup.html`). `config.js`
    était déjà exclu par le `.gitignore`.
  - ⏳ **L'utilisateur révoque la clé** chez OpenAI (elle reste lisible dans l'historique
    git : seule la révocation la neutralise), puis en crée une nouvelle **uniquement dans
    `config.js`**.
  - ⚠️ Pas de `config.js` sur le Mac utilisé pour cette session → la dictée n'y
    fonctionne pas tant qu'il n'est pas recréé.
- Modifications **non commitées** : `popup.js`, `popup.html`, `firefox/popup.js`,
  `firefox/popup.html`, et ce fichier. Le commit revient à l'utilisateur.
- La copie inutile `~/Documents/ToolWeb-main` a été mise à la Corbeille.
