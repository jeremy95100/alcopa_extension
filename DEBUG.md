# Guide de Débogage - Alcopa Price Comparison

## Étape 1 : Recharger l'extension

1. Allez sur `chrome://extensions/`
2. Trouvez "Alcopa Price Comparison"
3. Cliquez sur le bouton de rechargement (⟳)

## Étape 2 : Ouvrir la console du Service Worker

1. Sur `chrome://extensions/`
2. Sous "Alcopa Price Comparison", cliquez sur **"Inspecter les vues : service worker"**
3. Une console DevTools s'ouvre - c'est là que vous verrez tous les logs de scraping

## Étape 3 : Ouvrir la console de la page

1. Sur la page Alcopa, appuyez sur **F12** (ou Ctrl+Shift+I)
2. Allez dans l'onglet **Console**

## Étape 4 : Tester l'extension

1. Sur la page Alcopa, vous devriez voir les icônes en haut à droite
2. Cliquez sur l'icône **LeBonCoin**
3. Observez les deux consoles :

### Dans la console de la page (F12) :
```
Alcopa Price Comparison extension loaded
Page type - Detail: true, List: false
Processing detail page...
Extracted vehicle data: {brand: "CITROEN", model: "JUMPER", ...}
Injected icons for: CITROEN JUMPER FOURGON
```

### Dans la console du Service Worker :
```
=== Starting comparison ===
Source: leboncoin
Vehicle data: {brand: "CITROEN", model: "JUMPER FOURGON", ...}
→ Starting scraping...
LeBonCoin URL: https://www.leboncoin.fr/recherche?text=CITROEN+JUMPER+FOURGON&category=2&sort=time&shippable=1
Fetching LeBonCoin: ...
Parsing LeBonCoin HTML, length: 123456
LeBonCoin page title: ...
Found X ads using selector: ...
Sample ad 1: {...}
✓ Scraped X vehicles from leboncoin
→ Matching vehicles...
✓ Matched X similar vehicles
→ Calculating price analysis...
✓ Analysis complete: {...}
=== Comparison successful ===
```

## Si vous voyez une erreur

### Erreur : "Aucune annonce trouvée sur LeBonCoin"

Cela signifie que le parser ne trouve pas les annonces. Dans la console du service worker, cherchez :
```
No ad elements found. HTML preview: ...
```

Copiez le HTML preview et envoyez-le moi pour que j'ajuste les sélecteurs.

### Erreur : "Impossible de se connecter à LeBonCoin"

Problème de réseau ou LeBonCoin bloque les requêtes. Vérifiez :
- Votre connexion internet
- Si LeBonCoin est accessible dans un onglet normal

### Erreur : "Aucun véhicule similaire trouvé"

Le scraping a fonctionné mais aucun véhicule ne correspond. Vérifiez :
- Les données extraites du véhicule Alcopa
- Les véhicules trouvés sur LeBonCoin (sample ad 1, 2, 3)

### Erreur : "Données véhicule incomplètes"

Les données n'ont pas été extraites correctement d'Alcopa. Vérifiez :
- Dans la console de la page : "Extracted vehicle data: ..."
- Si `brand` ou `model` est null, le problème vient de l'extraction

## Tests manuels

Vous pouvez aussi tester l'URL de recherche manuellement :

1. Dans la console du service worker, copiez l'URL affichée :
   ```
   LeBonCoin URL: https://www.leboncoin.fr/recherche?text=CITROEN+JUMPER+FOURGON&category=2&sort=time&shippable=1
   ```

2. Ouvrez cette URL dans un nouvel onglet

3. Vérifiez que des annonces s'affichent

4. Si aucune annonce : le problème vient de la recherche (paramètres incorrects)

5. Si des annonces s'affichent : le problème vient du parsing HTML

## Captures d'écran utiles

Pour m'aider à déboguer, envoyez-moi :

1. **Console du Service Worker** (toute la sortie)
2. **Console de la page** (logs d'extraction)
3. **La page LeBonCoin** ouverte manuellement avec l'URL de recherche
4. **Le message d'erreur** affiché dans la modal

## Commandes utiles

Pour nettoyer le cache et recommencer :
```javascript
// Dans la console du service worker
chrome.storage.local.clear().then(() => console.log('Cache cleared'));
```

Pour voir toutes les données en cache :
```javascript
// Dans la console du service worker
chrome.storage.local.get(null).then(data => console.log('Cache:', data));
```
