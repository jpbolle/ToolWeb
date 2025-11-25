# ![ScriptOmail Icon](icon.png) ScriptOmail

ScriptOmail est une extension Chrome puissante conçue pour améliorer votre productivité en facilitant la dictée, la transcription, le nettoyage de texte et la rédaction d'emails assistée par l'IA.

## Fonctionnalités

*   **Dictée et Transcription** : Enregistrez votre voix et transcrivez-la automatiquement en texte grâce à l'API OpenAI Whisper.
*   **Nettoyage de Texte par IA** : Corrigez la grammaire, le formatage et la structure de vos textes brouillons en un clic, propulsé par GPT-4.
*   **Génération d'Emails** : Transformez des notes rapides ou un texte dicté en un email professionnel complet et bien rédigé.
*   **Historique du Presse-papiers** : Gardez une trace de vos textes copiés (jusqu'à 20 éléments) et collez-les facilement dans n'importe quel champ de texte.
*   **Interface Panneau Latéral** : Accédez à tous les outils confortablement depuis le panneau latéral de Chrome sans quitter votre onglet actuel.

## Installation

1.  Clonez ce dépôt ou téléchargez les fichiers source.
2.  Ouvrez Google Chrome et accédez à `chrome://extensions/`.
3.  Activez le **Mode développeur** en haut à droite.
4.  Cliquez sur **Charger l'extension non empaquetée**.
5.  Sélectionnez le dossier contenant les fichiers de l'extension.

## Configuration

**Important** : Cette extension utilise les API d'OpenAI.
Actuellement, la clé API est codée en dur dans le fichier `sidepanel.js`. Pour une utilisation personnelle ou sécurisée, il est recommandé de remplacer cette clé par la vôtre ou d'implémenter un système de gestion de clé plus sécurisé (par exemple, une page d'options).

## Utilisation

1.  Cliquez sur l'icône de l'extension pour ouvrir le panneau latéral.
2.  **Enregistrement** : Cliquez sur "Démarrer l'enregistrement" pour dicter votre texte. Cliquez sur "Arrêter" pour lancer la transcription.
3.  **Nettoyage** : Une fois le texte transcrit (ou collé), cliquez sur "Nettoyer le texte" pour l'améliorer.
4.  **Email** : Cliquez sur "Rédiger un email" pour générer un brouillon d'email à partir du contenu actuel.
5.  **Historique** : Consultez la liste des textes copiés récemment en bas du panneau et cliquez sur "Coller" pour les insérer dans la page active.

## Structure des Fichiers

*   `manifest.json` : Configuration de l'extension.
*   `background.js` : Gestionnaire d'événements en arrière-plan (ouverture du panneau, historique).
*   `content.js` : Script injecté dans les pages pour détecter la copie et insérer le texte.
*   `sidepanel.html` / `sidepanel.js` : Interface utilisateur principale et logique de l'extension.
*   `popup.html` / `popup.js` : (Ancienne interface, potentiellement obsolète au profit du panneau latéral).

## Avertissement

Cette extension envoie des données audio et textuelles aux serveurs d'OpenAI pour traitement. Assurez-vous de respecter les conditions d'utilisation d'OpenAI et de ne pas traiter de données sensibles sans précaution.
