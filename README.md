# Alcopa Price Comparison - Extension Chrome

Extension Chrome pour les professionnels de l'automobile qui permet de comparer instantanément les prix des véhicules Alcopa Auction avec LeBonCoin et La Centrale, afin de maximiser vos marges.

## Fonctionnalités

- **Comparaison instantanée** : Cliquez sur une icône pour comparer les prix en quelques secondes
- **Sources multiples** : LeBonCoin et La Centrale
- **Top 5 prix** : Affichage des 5 prix les plus élevés pour chaque véhicule
- **Calcul de marge automatique** : Marge estimée basée sur la moyenne des prix du marché
- **Recommandations intelligentes** : Indique si c'est une bonne affaire ou non
- **Cache intelligent** : Résultats mis en cache pendant 24h pour éviter les requêtes répétées
- **Interface intuitive** : Modal élégant avec toutes les informations importantes

## Installation

### Étape 1 : Télécharger l'extension

Clonez ou téléchargez ce repository dans un dossier sur votre ordinateur.

```bash
git clone <repository-url>
cd alcopa
```

### Étape 2 : Charger l'extension dans Chrome

1. Ouvrez Chrome et naviguez vers `chrome://extensions/`
2. Activez le **Mode développeur** en haut à droite
3. Cliquez sur **Charger l'extension non empaquetée**
4. Sélectionnez le dossier `/home/ichi95/Documents/alcopa`
5. L'extension devrait maintenant apparaître dans votre barre d'outils Chrome

### Étape 3 : Vérifier l'installation

- L'icône de l'extension devrait apparaître dans la barre d'outils
- Visitez https://www.alcopa-auction.fr/salle-de-vente-encheres/marseille/10539
- Vous devriez voir des icônes LeBonCoin et La Centrale sur chaque véhicule

## Utilisation

### Comparer un véhicule

1. Naviguez vers une page de vente Alcopa (ex: `/salle-de-vente-encheres/marseille/10539`)
2. Localisez le véhicule qui vous intéresse
3. Cliquez sur l'icône **LeBonCoin** (orange) ou **La Centrale** (rouge)
4. Une fenêtre modale s'ouvre avec :
   - Prix Alcopa vs Prix Marché Moyen
   - Marge estimée (€ et %)
   - Recommandation (excellente affaire, bonne opportunité, etc.)
   - Top 5 des prix les plus élevés trouvés
   - Liens vers les annonces pour vérifier

### Paramètres

Cliquez sur l'icône de l'extension dans la barre d'outils pour accéder aux paramètres :

- **Tolérance Kilométrage** : ± 10 000, 20 000 ou 30 000 km (défaut: 20 000)
- **Tolérance Année** : ± 1, 2 ou 3 ans (défaut: 1 an)
- **Nombre de résultats** : Top 3, 5 ou 10 (défaut: 5)
- **Vider le cache** : Supprime toutes les comparaisons enregistrées

## Structure du Projet

```
alcopa/
├── manifest.json                 # Configuration Manifest V3
├── background/
│   └── service-worker.js        # Scraping et traitement en arrière-plan
├── content/
│   ├── alcopa-content.js        # Extraction des données Alcopa
│   └── ui-injector.js           # Injection des icônes et modales
├── popup/
│   ├── popup.html               # Interface popup
│   ├── popup.js                 # Logique popup
│   └── popup.css                # Styles popup
├── styles/
│   ├── icons.css                # Styles des icônes
│   └── results-modal.css        # Styles du modal de résultats
├── utils/
│   └── constants.js             # Constantes de configuration
└── assets/
    └── icons/                   # Icônes de l'extension
```

## Comment ça marche ?

### 1. Extraction des données

L'extension scanne les pages Alcopa et extrait automatiquement :
- Marque et modèle du véhicule
- Prix Alcopa
- Kilométrage
- Année de mise en circulation
- Type d'énergie (Diesel, Essence, Hybride, etc.)
- Boîte de vitesses

### 2. Scraping des sites concurrents

Lorsque vous cliquez sur une icône, l'extension :
- Construit une URL de recherche optimisée (marque + modèle + filtres)
- Récupère la page de résultats de LeBonCoin ou La Centrale
- Parse le HTML pour extraire les annonces similaires

### 3. Matching des véhicules

L'algorithme de matching attribue un score à chaque véhicule trouvé :
- **40 points** : Marque et modèle identiques (requis)
- **30 points** : Année proche (±0-2 ans)
- **20 points** : Kilométrage proche (±10-30k km)
- **10 points** : Type d'énergie identique

Seuls les véhicules avec un score ≥ 60 sont retenus.

### 4. Analyse des prix

- Calcul de la moyenne, médiane, min et max
- Calcul de la marge : `Prix Marché Moyen - Prix Alcopa`
- Recommandation basée sur le pourcentage de marge :
  - ≥ 20% : Excellente affaire
  - ≥ 10% : Bonne opportunité
  - ≥ 5% : Marge correcte
  - ≥ 0% : Faible marge
  - < 0% : Prix au-dessus du marché

### 5. Cache

Les résultats sont mis en cache pendant 24h pour :
- Réduire le nombre de requêtes
- Améliorer la vitesse de réponse
- Éviter la détection anti-bot

## Limitations actuelles

- **Scraping HTML** : Si LeBonCoin ou La Centrale changent leur structure HTML, l'extension peut cesser de fonctionner temporairement
- **Première page uniquement** : Seuls les résultats de la première page sont analysés (environ 10-20 véhicules)
- **Prix fixes uniquement** : Ne fonctionne que si le prix Alcopa est visible (pas pour les enchères en cours)
- **Pas d'API officielle** : Utilise le web scraping, ce qui peut être bloqué par des mesures anti-bot

## Dépannage

### Les icônes n'apparaissent pas

1. Vérifiez que vous êtes sur une page Alcopa (`/salle-de-vente-encheres/*` ou `/voiture-occasion/*`)
2. Ouvrez la console Chrome (F12) et vérifiez les erreurs
3. Rechargez la page (Ctrl+R ou Cmd+R)
4. Réinstallez l'extension

### "Aucun véhicule trouvé"

- Le véhicule est peut-être trop rare ou spécifique
- Essayez d'augmenter les tolérances dans les paramètres
- Vérifiez manuellement sur LeBonCoin/La Centrale

### "Impossible de se connecter"

- Vérifiez votre connexion internet
- Le site cible peut être temporairement indisponible
- Des mesures anti-bot peuvent bloquer les requêtes (attendez quelques minutes)

### Erreur de parsing

- La structure du site a peut-être changé
- Ouvrez une issue sur GitHub avec les détails de l'erreur

## Développement

### Modifier l'extension

1. Éditez les fichiers source
2. Retournez sur `chrome://extensions/`
3. Cliquez sur le bouton de rechargement de l'extension
4. Rechargez la page Alcopa pour tester

### Debug

- **Console du service worker** : `chrome://extensions/` → Extension → "Inspecter les vues : service worker"
- **Console de la page** : F12 sur la page Alcopa
- **Popup console** : Clic droit sur l'icône → Inspecter la popup

### Tests

Testez avec différents types de véhicules :
- Voitures récentes vs anciennes
- Diesel vs Essence vs Hybride vs Électrique
- Faible vs fort kilométrage
- Marques premium vs généralistes

## Améliorations futures

- [ ] Support de plus de sites (AutoScout24, Leboncoin Pro, etc.)
- [ ] Scraping multi-pages pour plus de résultats
- [ ] Graphiques d'évolution des prix
- [ ] Export des données en CSV/Excel
- [ ] Alertes automatiques pour les bonnes affaires
- [ ] Comparaison groupée (tous les véhicules de la page)
- [ ] Analyse par région
- [ ] Décodeur VIN pour specs exactes

## Licence

Usage privé uniquement. Ne pas distribuer sans autorisation.

## Support

Pour toute question ou problème, ouvrez une issue sur le repository GitHub.

---

**Développé avec ❤️ pour les professionnels de l'automobile**
