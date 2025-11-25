# Configuration de ScriptoMail

## 🔑 Configuration de la Clé API OpenAI

Pour utiliser les fonctionnalités de transcription et de génération de texte, vous devez configurer votre clé API OpenAI.

### Étapes de Configuration

1. **Copiez le fichier exemple** :
   ```bash
   cp config.example.js config.js
   ```

2. **Obtenez votre clé API OpenAI** :
   - Allez sur https://platform.openai.com/api-keys
   - Créez une nouvelle clé API
   - Copiez la clé (elle commence par `sk-proj-...`)

3. **Ajoutez votre clé dans `config.js`** :
   ```javascript
   const CONFIG = {
     OPENAI_API_KEY: 'votre-clé-api-ici'
   };
   ```

### ⚠️ Sécurité

- **NE JAMAIS** commiter le fichier `config.js` sur GitHub
- Le fichier `config.js` est déjà dans `.gitignore` pour vous protéger
- Seul `config.example.js` doit être commité (sans la vraie clé)

### 📝 Note

Si vous clonez ce projet depuis GitHub, vous devrez créer votre propre fichier `config.js` avec votre clé API personnelle.
