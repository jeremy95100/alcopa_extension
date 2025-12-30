# Guide de Test Rapide

## NOUVELLES Modifications (Version actuelle)

### 1. Fix de l'écran noir - Version améliorée
- **Styles inline forcés** sur la modal pour garantir la visibilité
- Flexbox avec `display: flex` + `align-items: center` + `justify-content: center`
- `z-index: 999999` pour être au-dessus de tout
- Background blanc avec ombre pour le contenu

### 2. Logs de débogage ultra-détaillés
- Logs de chaque ligne du tableau générée
- Logs des styles CSS appliqués
- Logs du HTML généré (preview)
- Logs du nombre de véhicules matchés
- Vérification du nombre d'éléments modal dans le DOM

### 3. Mode TEST avec données fictives
- **SHIFT + Clic** sur une icône = affiche des données de test sans scraping
- Permet de vérifier que la modal fonctionne avant de tester le scraping

### 4. Affichage garanti
- Même si le CSS externe ne se charge pas, la modal DOIT être visible grâce aux styles inline
- Fond gris semi-transparent
- Contenu blanc centré
- Header violet avec gradient

## Instructions de Test

### ÉTAPE 1 : Recharger l'extension
```
1. chrome://extensions/
2. Bouton de rechargement (⟳) sur "Alcopa Price Comparison"
```

### ÉTAPE 2 : Tester la modal avec données fictives (MODE TEST)

1. Sur la page Alcopa du véhicule
2. **SHIFT + Clic** sur l'icône LeBonCoin (ou La Centrale)
3. Une modal devrait s'afficher IMMÉDIATEMENT avec :
   - **Fond gris semi-transparent** sur toute la page
   - **Boîte blanche centrée** au milieu de l'écran
   - **Header violet avec gradient** "Comparaison LeBonCoin"
   - **Bouton X blanc** en haut à droite
   - **4 cartes de statistiques** :
     * Prix Alcopa: 12 400 €
     * Prix Marché Moyen: 15 800 €
     * Marge Estimée: 3 400 € (27.4%)
     * Recommandation: 🟢 Excellente affaire
   - **Tableau avec 5 lignes** de véhicules de test avec colonnes :
     * Rang | Titre | Prix | Kilométrage | Année | Lien
   - **Footer** : "8 véhicules similaires trouvés"

**Ce que vous DEVEZ voir** ✅
- La modal doit être **IMPOSSIBLE À MANQUER** car elle couvre tout l'écran
- Le fond gris doit rendre le reste de la page flou/sombre
- La boîte blanche doit être centrée et bien visible
- Vous devez pouvoir cliquer sur les liens "Voir" dans le tableau
- Cliquer sur X, ESC, ou le fond gris doit fermer la modal

**Si la modal ne s'affiche toujours PAS** ❌
→ Ouvrez la console (F12) et envoyez-moi:
  1. Tous les logs (cherchez les émojis 🎨 ✓ ✅)
  2. Le "Modal outerHTML preview"
  3. Le "Modal content styles"
  4. Captures d'écran de la page

### ÉTAPE 3 : Tester le scraping réel

1. **Ouvrir la console du Service Worker**
   - chrome://extensions/
   - "Inspecter les vues : service worker" sous l'extension

2. **Ouvrir la console de la page**
   - F12 sur la page Alcopa

3. **Clic normal** (sans SHIFT) sur l'icône LeBonCoin

4. **Observer les deux consoles**

#### Console de la page (F12) :
```
Icon clicked: leboncoin
Vehicle data: {brand: "CITROEN", model: "JUMPER FOURGON", ...}
Sending message to service worker...
Received response from service worker: {success: true/false, ...}
```

#### Console du Service Worker :
```
=== Starting comparison ===
Source: leboncoin
Vehicle data: {...}
→ Starting scraping...
LeBonCoin URL: https://www.leboncoin.fr/recherche?text=CITROEN+JUMPER&category=2&sort=time&shippable=1
Fetching LeBonCoin: ...
Parsing LeBonCoin HTML, length: [nombre]
LeBonCoin page title: [titre]
Found X ads using selector: [sélecteur]
Sample ad 1: {...}
Sample ad 2: {...}
Sample ad 3: {...}
✓ Scraped X vehicles from leboncoin
→ Matching vehicles...
✓ Matched X similar vehicles
→ Calculating price analysis...
✓ Analysis complete: {...}
=== Comparison successful ===
```

### ÉTAPE 4 : Diagnostic des erreurs

#### Si "Aucune annonce trouvée"
```
No ad elements found. HTML preview: ...
```
→ Copiez le "HTML preview" et envoyez-le moi
→ La structure de LeBonCoin a changé, je dois ajuster les sélecteurs

#### Si "Impossible de se connecter"
→ Problème réseau ou LeBonCoin bloque les requêtes
→ Testez l'URL manuellement (copiez l'URL de la console et ouvrez-la dans un nouvel onglet)

#### Si "Aucun véhicule similaire"
→ Le scraping a marché mais aucun match
→ Vérifiez les "Sample ad" dans la console
→ Vérifiez les données du véhicule Alcopa

## Test Manuel de l'URL

1. Copiez l'URL affichée dans la console du service worker :
   ```
   LeBonCoin URL: https://www.leboncoin.fr/recherche?text=CITROEN+JUMPER&...
   ```

2. Ouvrez cette URL dans un nouvel onglet

3. **Si des annonces s'affichent** ✅
   → Le problème vient du parsing HTML
   → Envoyez-moi une capture de la page

4. **Si aucune annonce** ❌
   → Le problème vient de la requête/paramètres
   → LeBonCoin n'a peut-être pas de résultats pour cette recherche

## Ce qu'il faut m'envoyer si ça ne marche pas

1. **Console du Service Worker** (tout le contenu)
2. **Console de la page** (logs d'erreur)
3. **Capture d'écran** de ce que vous voyez
4. **L'URL LeBonCoin** générée
5. **Capture de la page LeBonCoin** si vous l'ouvrez manuellement

## Commandes utiles

### Nettoyer le cache
```javascript
// Dans la console du service worker
chrome.storage.local.clear().then(() => console.log('Cache cleared'));
```

### Voir le cache
```javascript
// Dans la console du service worker
chrome.storage.local.get(null).then(data => console.log('Cache:', data));
```

## Raccourcis

- **Clic normal** = Scraping réel
- **SHIFT + Clic** = Données de test (pas de scraping)
- **X (bouton)** = Fermer la modal
- **ESC** = Fermer la modal
- **Clic sur le fond noir** = Fermer la modal

## Prochaines étapes

Une fois que le test avec données fictives fonctionne :
1. Tester le scraping LeBonCoin
2. Analyser les erreurs et ajuster les sélecteurs
3. Faire pareil pour La Centrale
4. Optimiser le matching
5. Améliorer l'affichage
