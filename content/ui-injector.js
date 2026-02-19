// UI Injector - Creates and manages comparison icons on Alcopa pages

function createComparisonIcons(vehicleData, vehicleElement, showFees = true) {
  // Create container for icons
  const container = document.createElement('div');
  container.className = 'alcopa-comparison-icons';

  // Create LeBonCoin icon
  const leboncoinBtn = createIconButton('leboncoin', vehicleData);
  container.appendChild(leboncoinBtn);

  // Create La Centrale icon
  const lacentraleBtn = createIconButton('lacentrale', vehicleData);
  container.appendChild(lacentraleBtn);

  // Create Margin indicator icon
  const marginBtn = createMarginButton(vehicleData);
  container.appendChild(marginBtn);

  // Create Fees calculator icon (sauf vente web)
  if (showFees) {
    const feesBtn = createFeesButton(vehicleData);
    container.appendChild(feesBtn);
  }

  return container;
}

function createIconButton(source, vehicleData) {
  const button = document.createElement('button');
  button.className = `comparison-icon ${source}-icon`;
  button.dataset.source = source;
  button.dataset.vehicle = JSON.stringify(vehicleData);

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL(`assets/icons/${source}-icon.svg`);
  img.alt = `Compare on ${source === 'leboncoin' ? 'LeBonCoin' : 'La Centrale'}`;

  const tooltip = document.createElement('span');
  tooltip.className = 'tooltip';
  tooltip.textContent = `Comparer ${source === 'leboncoin' ? 'LeBonCoin' : 'La Centrale'}`;

  button.appendChild(img);
  button.appendChild(tooltip);

  // Add click event listener
  // SHIFT+Click = test mode with fake data
  button.addEventListener('click', (event) => {
    if (event.shiftKey) {
      console.log('TEST MODE: Showing fake data');
      event.preventDefault();
      event.stopPropagation();
      showTestResults(source, vehicleData);
    } else {
      handleIconClick(event);
    }
  });

  return button;
}

function showTestResults(source, vehicleData) {
  const fakeData = {
    alcopaPrice: vehicleData.price || 12400,
    avgMarketPrice: 15800,
    medianPrice: 15500,
    minPrice: 12900,
    maxPrice: 18500,
    profitMargin: 3400,
    profitPercentage: 27.4,
    recommendation: '🟢 Excellente affaire',
    totalMatches: 8,
    top5Prices: [18500, 17200, 16800, 15500, 14200],
    matchedVehicles: [
      {
        title: `${vehicleData.brand} ${vehicleData.model} Test 1`,
        price: 18500,
        mileage: (vehicleData.mileage || 45000) + 2000,
        year: vehicleData.year || 2021,
        url: 'https://www.leboncoin.fr/test1',
        score: 95
      },
      {
        title: `${vehicleData.brand} ${vehicleData.model} Test 2`,
        price: 17200,
        mileage: (vehicleData.mileage || 45000) - 5000,
        year: vehicleData.year || 2021,
        url: 'https://www.leboncoin.fr/test2',
        score: 90
      },
      {
        title: `${vehicleData.brand} ${vehicleData.model} Test 3`,
        price: 16800,
        mileage: (vehicleData.mileage || 45000) + 8000,
        year: vehicleData.year || 2021,
        url: 'https://www.leboncoin.fr/test3',
        score: 85
      },
      {
        title: `${vehicleData.brand} ${vehicleData.model} Test 4`,
        price: 15500,
        mileage: (vehicleData.mileage || 45000) + 12000,
        year: (vehicleData.year || 2021) - 1,
        url: 'https://www.leboncoin.fr/test4',
        score: 80
      },
      {
        title: `${vehicleData.brand} ${vehicleData.model} Test 5`,
        price: 14200,
        mileage: (vehicleData.mileage || 45000) - 3000,
        year: vehicleData.year || 2021,
        url: 'https://www.leboncoin.fr/test5',
        score: 75
      }
    ]
  };

  console.log('TEST DATA:', fakeData);
  showResultsModal(fakeData, source, vehicleData);
}

async function handleIconClick(event) {
  event.preventDefault();
  event.stopPropagation();

  const button = event.currentTarget;
  const source = button.dataset.source;
  const vehicleData = JSON.parse(button.dataset.vehicle);

  console.log('Icon clicked:', source);
  console.log('Vehicle data:', vehicleData);

  if (source === 'leboncoin') {
    console.log('🔍 Opening LeBonCoin tabs...');
    console.log('Vehicle data:', vehicleData);

    // Onglet 1 : Recherche filtrée complète (finition + tous les filtres)
    const filteredUrl = buildLeBonCoinUrl(vehicleData);
    console.log('Onglet 1 (filtres complets):', filteredUrl);

    // Onglet 2 : Recherche élargie (3 mots de la finition + km ±40k)
    const fallbackUrl = buildLeBonCoinGeneralUrlWithStrategy(vehicleData, {
      modelType: 'finitionThreeWords',
      kmTolerance: 20000,
      yearTolerance: 2
    });
    console.log('Onglet 2 (filtres élargis):', fallbackUrl);

    // Ouvrir les 2 onglets en même temps (pas de setTimeout pour éviter le blocage)
    window.open(filteredUrl, '_blank');
    window.open(fallbackUrl, '_blank');

    return;
  }

  // Pour La Centrale, garder l'ancien comportement (scraping)
  // Show loading state
  button.classList.add('loading');
  button.disabled = true;

  try {
    // Show loading modal
    showLoadingModal(source);

    console.log('Sending message to service worker...');

    // Send message to service worker to start scraping
    const response = await chrome.runtime.sendMessage({
      action: 'SCRAPE_COMPARISON',
      vehicleData: vehicleData,
      source: source
    });

    console.log('📬 Received response from service worker:', response);

    if (response.success) {
      console.log('✅ Success! Showing results modal...');
      console.log('Response data:', response.data);

      // Show results modal
      try {
        showResultsModal(response.data, source, vehicleData);
        console.log('✅ showResultsModal() completed');
      } catch (err) {
        console.error('❌ ERROR in showResultsModal():', err);
        console.error('Stack:', err.stack);
        throw err;
      }

      button.classList.add('success');
    } else {
      console.error('❌ Error response:', response.error);
      // Show error modal
      showErrorModal(response.error, source);
      button.classList.add('error');
    }
  } catch (error) {
    console.error('Exception during comparison:', error);
    console.error('Error stack:', error.stack);
    showErrorModal(error.message || 'Erreur inconnue', source);
    button.classList.add('error');
  } finally {
    // Remove loading state
    button.classList.remove('loading');
    button.disabled = false;

    // Remove success/error class after 3 seconds
    setTimeout(() => {
      button.classList.remove('success', 'error');
    }, 3000);
  }
}

// Fonction intelligente pour trouver la meilleure URL fallback (onglet 2)
// Enlève progressivement les filtres jusqu'à trouver des résultats
async function findBestLeBonCoinFallbackUrl(vehicleData) {
  console.log('🔍 Finding best fallback URL with progressive filter removal...');

  // Liste des stratégies à essayer dans l'ordre
  const strategies = [
    // 1. Retirer boîte de vitesse
    {
      name: 'Sans boîte de vitesse',
      buildUrl: () => buildLeBonCoinUrlWithoutFilters(vehicleData, ['gearbox'])
    },
    // 2. Retirer énergie
    {
      name: 'Sans boîte ET sans énergie',
      buildUrl: () => buildLeBonCoinUrlWithoutFilters(vehicleData, ['gearbox', 'fuel'])
    },
    // 3. Augmenter km à ±40k
    {
      name: 'Sans boîte/énergie + km ±40k',
      buildUrl: () => buildLeBonCoinUrlWithCustomFilters(vehicleData, {
        removeFilters: ['gearbox', 'fuel'],
        kmTolerance: 40000
      })
    },
    // 4. Augmenter km à ±60k
    {
      name: 'Sans boîte/énergie + km ±60k',
      buildUrl: () => buildLeBonCoinUrlWithCustomFilters(vehicleData, {
        removeFilters: ['gearbox', 'fuel'],
        kmTolerance: 60000
      })
    },
    // 5. Augmenter année à ±3
    {
      name: 'Sans boîte/énergie + km ±60k + année ±3',
      buildUrl: () => buildLeBonCoinUrlWithCustomFilters(vehicleData, {
        removeFilters: ['gearbox', 'fuel'],
        kmTolerance: 60000,
        yearTolerance: 3
      })
    },
    // 6. Marque + modèle complet seulement
    {
      name: 'Marque + modèle complet',
      buildUrl: () => buildLeBonCoinGeneralUrlWithStrategy(vehicleData, {
        modelType: 'full',
        kmTolerance: null,
        yearTolerance: null
      })
    },
    // 7. Marque + 2 mots du modèle
    {
      name: 'Marque + 2 mots du modèle',
      buildUrl: () => buildLeBonCoinGeneralUrlWithStrategy(vehicleData, {
        modelType: 'twoWords',
        kmTolerance: null,
        yearTolerance: null
      })
    },
    // 8. Marque + 1 mot du modèle
    {
      name: 'Marque + 1 mot du modèle',
      buildUrl: () => buildLeBonCoinGeneralUrlWithStrategy(vehicleData, {
        modelType: 'simplified',
        kmTolerance: null,
        yearTolerance: null
      })
    }
  ];

  // Essayer chaque stratégie
  for (const strategy of strategies) {
    console.log(`📋 Trying fallback strategy: ${strategy.name}`);
    const url = strategy.buildUrl();
    console.log(`   URL: ${url}`);

    // Vérifier si cette URL donne des résultats
    const hasResults = await checkLeBonCoinResults(url);

    if (hasResults) {
      console.log(`   ✅ Found results!`);
      return url;
    } else {
      console.log(`   ❌ No results, trying next strategy...`);
    }
  }

  console.log('❌ No fallback strategy worked');
  return null;
}

// Construire URL LeBonCoin en retirant certains filtres
function buildLeBonCoinUrlWithoutFilters(vehicleData, filtersToRemove = []) {
  const params = new URLSearchParams();
  params.set('category', '2');

  // Texte de recherche : Marque + Finition complète
  if (vehicleData.brand) {
    let searchText;
    if (vehicleData.finition) {
      const finitionWords = vehicleData.finition.trim().split(/\s+/).slice(0, 10).join(' ');
      searchText = `${vehicleData.brand} ${finitionWords}`;
    } else if (vehicleData.model) {
      searchText = `${vehicleData.brand} ${vehicleData.model}`;
    } else {
      searchText = vehicleData.brand;
    }
    params.set('text', searchText);
  }

  // Année : ± 2 ans
  if (vehicleData.year) {
    const yearMin = vehicleData.year - 2;
    const yearMax = vehicleData.year + 2;
    params.set('regdate', `${yearMin}-${yearMax}`);
  }

  // Kilométrage : ± 20 000 km
  if (vehicleData.mileage) {
    const kmMin = Math.max(0, vehicleData.mileage - 20000);
    const kmMax = vehicleData.mileage + 20000;
    params.set('mileage', `${kmMin}-${kmMax}`);
  }

  // Énergie (sauf si dans filtersToRemove)
  if (!filtersToRemove.includes('fuel')) {
    const fuelCode = mapEnergyToLeBonCoin(vehicleData.energyType);
    if (fuelCode) {
      params.set('fuel', fuelCode);
    }
  }

  // Boîte de vitesse (sauf si dans filtersToRemove)
  if (!filtersToRemove.includes('gearbox')) {
    const gearboxCode = mapGearboxToLeBonCoin(vehicleData.transmission);
    if (gearboxCode) {
      params.set('gearbox', gearboxCode);
    }
  }

  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

// Construire URL LeBonCoin avec filtres personnalisés
function buildLeBonCoinUrlWithCustomFilters(vehicleData, options = {}) {
  const {
    removeFilters = [],
    kmTolerance = 20000,
    yearTolerance = 2
  } = options;

  const params = new URLSearchParams();
  params.set('category', '2');

  // Texte de recherche : Marque + Finition complète
  if (vehicleData.brand) {
    let searchText;
    if (vehicleData.finition) {
      const finitionWords = vehicleData.finition.trim().split(/\s+/).slice(0, 10).join(' ');
      searchText = `${vehicleData.brand} ${finitionWords}`;
    } else if (vehicleData.model) {
      searchText = `${vehicleData.brand} ${vehicleData.model}`;
    } else {
      searchText = vehicleData.brand;
    }
    params.set('text', searchText);
  }

  // Année
  if (vehicleData.year) {
    const yearMin = vehicleData.year - yearTolerance;
    const yearMax = vehicleData.year + yearTolerance;
    params.set('regdate', `${yearMin}-${yearMax}`);
  }

  // Kilométrage
  if (vehicleData.mileage) {
    const kmMin = Math.max(0, vehicleData.mileage - kmTolerance);
    const kmMax = vehicleData.mileage + kmTolerance;
    params.set('mileage', `${kmMin}-${kmMax}`);
  }

  // Énergie (sauf si dans removeFilters)
  if (!removeFilters.includes('fuel')) {
    const fuelCode = mapEnergyToLeBonCoin(vehicleData.energyType);
    if (fuelCode) {
      params.set('fuel', fuelCode);
    }
  }

  // Boîte de vitesse (sauf si dans removeFilters)
  if (!removeFilters.includes('gearbox')) {
    const gearboxCode = mapGearboxToLeBonCoin(vehicleData.transmission);
    if (gearboxCode) {
      params.set('gearbox', gearboxCode);
    }
  }

  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

// Construire URL avec une stratégie spécifique
function buildLeBonCoinGeneralUrlWithStrategy(vehicleData, strategy) {
  const params = new URLSearchParams();
  params.set('category', '2');

  // Texte de recherche selon le type de modèle
  if (vehicleData.brand) {
    let searchText = vehicleData.brand;

    // Si on demande la finition avec 3 mots max
    if (strategy.modelType === 'finitionThreeWords' && vehicleData.finition) {
      const finitionWords = vehicleData.finition.trim().split(/\s+/).slice(0, 3).join(' ');
      searchText = `${vehicleData.brand} ${finitionWords}`;
    }
    // Sinon utiliser le modèle
    else if (vehicleData.model && strategy.modelType !== 'brandOnly') {
      const modelWords = vehicleData.model.trim().split(/\s+/);

      if (strategy.modelType === 'full') {
        searchText = `${vehicleData.brand} ${vehicleData.model}`;
      } else if (strategy.modelType === 'twoWords') {
        const twoWords = modelWords.slice(0, 2).join(' ');
        searchText = `${vehicleData.brand} ${twoWords}`;
      } else if (strategy.modelType === 'simplified') {
        const firstWord = modelWords[0];
        searchText = `${vehicleData.brand} ${firstWord}`;
      }
    }

    params.set('text', searchText);
  }

  // Année (si tolérance définie)
  if (strategy.yearTolerance !== null && vehicleData.year) {
    const yearMin = vehicleData.year - strategy.yearTolerance;
    const yearMax = vehicleData.year + strategy.yearTolerance;
    params.set('regdate', `${yearMin}-${yearMax}`);
  }

  // Kilométrage (si tolérance définie)
  if (strategy.kmTolerance !== null && vehicleData.mileage) {
    const kmMin = Math.max(0, vehicleData.mileage - strategy.kmTolerance);
    const kmMax = vehicleData.mileage + strategy.kmTolerance;
    params.set('mileage', `${kmMin}-${kmMax}`);
  }

  // Énergie
  const fuelCode = mapEnergyToLeBonCoin(vehicleData.energyType);
  if (fuelCode) {
    params.set('fuel', fuelCode);
  }

  // Boîte de vitesse
  const gearboxCode = mapGearboxToLeBonCoin(vehicleData.transmission);
  if (gearboxCode) {
    params.set('gearbox', gearboxCode);
  }

  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

// Compter le nombre de résultats d'une URL LeBonCoin
async function countLeBonCoinResults(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });

    if (!response.ok) {
      return 0;
    }

    const html = await response.text();

    // Vérifier s'il y a des annonces dans le HTML
    // LeBonCoin utilise Next.js, chercher le script __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);

    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const ads = nextData?.props?.pageProps?.searchData?.ads ||
                    nextData?.props?.pageProps?.ads ||
                    nextData?.props?.initialState?.ads || [];

        console.log(`   Found ${ads.length} ads in __NEXT_DATA__`);
        return ads.length;
      } catch (e) {
        console.error('   Error parsing __NEXT_DATA__:', e);
      }
    }

    // Fallback: compter les patterns de prix dans le HTML
    const priceMatches = html.match(/"price":\s*\d+/g);
    if (priceMatches) {
      console.log(`   Found ${priceMatches.length} price mentions in HTML`);
      return priceMatches.length;
    }

    // Dernier fallback: vérifier s'il n'y a pas le message "Aucune annonce"
    if (html.includes('Aucune annonce') || html.includes('No results')) {
      console.log('   Found "no results" message');
      return 0;
    }

    // Si on arrive ici sans certitude, retourner 0 par précaution
    return 0;
  } catch (error) {
    console.error('   Error counting results:', error);
    return 0;
  }
}

// Vérifier si une URL LeBonCoin retourne des résultats (au moins 1)
async function checkLeBonCoinResults(url) {
  const count = await countLeBonCoinResults(url);
  return count > 0;
}

// Construire l'URL LeBonCoin : catégorie voitures + texte + année + km + énergie + boîte
function buildLeBonCoinUrl(vehicleData) {
  const params = new URLSearchParams();

  // Catégorie : 2 = Voitures
  params.set('category', '2');

  // Texte de recherche : Marque + Finition complète (inclut modèle)
  if (vehicleData.brand) {
    let searchText;
    if (vehicleData.finition) {
      const finitionWords = vehicleData.finition.trim().split(/\s+/).slice(0, 10).join(' ');
      searchText = `${vehicleData.brand} ${finitionWords}`;
    } else if (vehicleData.model) {
      searchText = `${vehicleData.brand} ${vehicleData.model}`;
    } else {
      searchText = vehicleData.brand;
    }
    params.set('text', searchText);
  }

  // Année : ± 2 ans
  if (vehicleData.year) {
    const yearMin = vehicleData.year - 2;
    const yearMax = vehicleData.year + 2;
    params.set('regdate', `${yearMin}-${yearMax}`);
  }

  // Kilométrage : ± 20 000 km
  if (vehicleData.mileage) {
    const kmMin = Math.max(0, vehicleData.mileage - 20000);
    const kmMax = vehicleData.mileage + 20000;
    params.set('mileage', `${kmMin}-${kmMax}`);
  }

  // Énergie
  const fuelCode = mapEnergyToLeBonCoin(vehicleData.energyType);
  if (fuelCode) {
    params.set('fuel', fuelCode);
  }

  // Boîte de vitesse
  const gearboxCode = mapGearboxToLeBonCoin(vehicleData.transmission);
  if (gearboxCode) {
    params.set('gearbox', gearboxCode);
  }

  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

// Détecter le type de véhicule LeBonCoin depuis le modèle/finition Alcopa
function detectVehicleType(model, finition) {
  const modelUpper = (model || '').toUpperCase();
  const finitionUpper = (finition || '').toUpperCase();
  const combined = modelUpper + ' ' + finitionUpper;

  // Mapping mots-clés Alcopa → type LeBonCoin
  const typeMapping = [
    // Break
    { keywords: ['ESTATE', 'SW', 'BREAK', 'TOURING', 'AVANT', 'SPORTWAGON', 'ALLTRACK', 'ALLROAD'], type: 'break' },
    // SUV / 4x4
    { keywords: ['SUV', 'CROSSOVER', '4X4', 'CROSSBACK', 'SPORTBACK', 'QASHQAI', 'TUCSON', 'TIGUAN', 'CAPTUR', 'JUKE', '3008', '5008', '2008', 'KADJAR', 'ATECA', 'KAROQ', 'KODIAQ', 'T-ROC', 'TARRACO', 'KUGA', 'MOKKA', 'GRANDLAND'], type: 'suv' },
    // Cabriolet
    { keywords: ['CABRIOLET', 'CONVERTIBLE', 'ROADSTER', 'SPIDER', 'SPYDER'], type: 'cabriolet' },
    // Coupé
    { keywords: ['COUPE', 'COUPÉ'], type: 'coupe' },
    // Monospace
    { keywords: ['MONOSPACE', 'PICASSO', 'SPACETOURER', 'SCENIC', 'TOURAN', 'SHARAN', 'ALHAMBRA', 'GALAXY', 'S-MAX', 'ZAFIRA', 'C4 SPACE'], type: 'monospace' },
    // Voiture société / commerciale
    { keywords: ['SOCIETE', 'SOCIÉTÉ', 'COMMERCIALE', 'AFFAIRE'], type: 'voiture_societe' },
  ];

  for (const mapping of typeMapping) {
    for (const keyword of mapping.keywords) {
      if (combined.includes(keyword)) {
        return mapping.type;
      }
    }
  }

  // Pas de type spécifique détecté → pas de filtre
  return null;
}

// Construire le texte de recherche en comparant finition Alcopa vs titre LeBonCoin
function buildSearchTextFromFinition(model, finition) {
  const finitionUpper = (finition || '').toUpperCase();
  const modelUpper = (model || '').toUpperCase();

  // 1) Commencer avec le modèle
  let searchText = model;

  // 2) Extraire le nom de finition (trim level) depuis la finition Alcopa
  // et l'ajouter pour cibler la bonne version
  const trimName = extractTrimLevel(finitionUpper, modelUpper);
  if (trimName) {
    searchText += ` ${trimName}`;
  }

  // 3) Exclure les carrosseries absentes de la finition
  const bodyKeywords = [
    'ESTATE', 'SW', 'BREAK', 'TOURING', 'AVANT', 'ALLROAD', 'ALLTRACK',
    'SPORTWAGON', 'SPORTBACK', 'CROSSBACK', 'CROSSOVER',
    'CABRIOLET', 'CONVERTIBLE', 'COUPE',
    'PICASSO', 'SPACETOURER', 'TOURER', 'SCENIC', 'COMBI', 'MONOSPACE',
  ];

  for (const keyword of bodyKeywords) {
    if (!finitionUpper.includes(keyword)) {
      searchText += ` -${keyword}`;
    }
  }

  return searchText;
}

// Extraire le niveau de finition (trim level) de la finition Alcopa
// Ex: "CLIO IV TCE 90 INTENS" → "INTENS"
// Ex: "308 SW BLUEHDI 130 ALLURE" → "ALLURE"
function extractTrimLevel(finitionUpper, modelUpper) {
  // Liste des finitions connues (trim levels)
  const knownTrims = [
    // Renault / Dacia
    'LIFE', 'ZEN', 'INTENS', 'INITIALE', 'BUSINESS', 'EXPRESSION',
    'DYNAMIQUE', 'PRIVILEGE', 'BOSE', 'ICONIC', 'TECHNO', 'EQUILIBRE',
    'EVOLUTION', 'CONFORT', 'AUTHENTIQUE', 'LAURÉATE', 'LAUREATE',
    'STEPWAY', 'EXTREME', 'JOURNEY', 'ESSENTIAL',
    // Peugeot
    'ACTIVE', 'ALLURE', 'GT LINE', 'GT', 'FELINE', 'STYLE', 'ACCESS',
    'LIKE', 'ROADTRIP',
    // Citroën
    'FEEL', 'SHINE', 'ORIGINS', 'C-SERIES', 'DRIVER', 'CLUB',
    'CONFORT', 'LIVE', 'START', 'ATTRACTION',
    // Volkswagen
    'TRENDLINE', 'COMFORTLINE', 'HIGHLINE', 'CARAT',
    // BMW
    'LUXURY', 'LOUNGE', 'SPORT',
    // Mercedes
    'PROGRESSIVE', 'AVANTGARDE', 'FASCINATION', 'SENSATION', 'INSPIRATION',
    // Ford
    'TITANIUM', 'TREND', 'GHIA', 'VIGNALE', 'COOL',
    // Toyota
    'DYNAMIC', 'DESIGN', 'COLLECTION',
    // Hyundai / Kia
    'CREATIVE', 'EXECUTIVE', 'PREMIUM', 'MOTION',
    // Génériques
    'ELEGANCE', 'CLASSIC', 'EDITION', 'LIMITED', 'SIGNATURE',
    'EXCLUSIVE', 'SELECT', 'ADVANCE', 'TECHNO',
    // Finitions sport
    'RS LINE', 'ST LINE', 'S LINE', 'M SPORT', 'AMG LINE', 'R LINE',
    'GT PACK', 'FR', 'CUPRA', 'TYPE R', 'NISMO', 'GR SPORT',
    'N LINE', 'GT SPORT',
    // Finitions pro/société
    'GRAND CONFORT', 'PRO', 'PACK PRO', 'AIR',
  ];

  // Chercher la finition dans la chaîne (du plus long au plus court pour matcher en priorité)
  const sortedTrims = knownTrims.sort((a, b) => b.length - a.length);

  for (const trim of sortedTrims) {
    const trimUp = trim.toUpperCase();
    // Vérifier que le trim est dans la finition mais pas dans le modèle
    if (finitionUpper.includes(trimUp) && !modelUpper.includes(trimUp)) {
      return trim;
    }
  }

  return null;
}

// Extraire la puissance DIN de la finition Alcopa
// Priorité : nombre suivi de CH > nombre après moteur (BLUEHDI, TCE...) > premier nombre valide
function extractHorsePowerFromFinition(finition) {
  if (!finition) return null;

  const finitionUpper = finition.toUpperCase();

  // Priorité 1 : nombre directement suivi de "CH" (ex: "136CH", "100 CH")
  const chMatch = finitionUpper.match(/(\d+)\s*CH\b/);
  if (chMatch) {
    const power = parseInt(chMatch[1]);
    if (power >= 45 && power <= 1000) return power;
  }

  // Priorité 2 : nombre directement suivi de "CV" (ex: "136CV", "100 CV")
  const cvMatch = finitionUpper.match(/(\d+)\s*CV\b/);
  if (cvMatch) {
    const power = parseInt(cvMatch[1]);
    if (power >= 45 && power <= 1000) return power;
  }

  // Priorité 3 : nombre après un mot-clé moteur (ex: "BLUEHDI 100", "TCE 90", "PURETECH 130")
  const enginePattern = /(?:BLUEHDI|PURETECH|HDI|E-HDI|THP|VTI|DCI|BLUE\s*DCI|TCE|SCE|TDI|TSI|TFSI|MULTIJET|MULTIAIR|JTDM?|TDCI|ECOBOOST|ECOBLUE|CDI|BLUETEC|CRDI|T-GDI|D-4D)\s*(\d+)/i;
  const engineMatch = finitionUpper.match(enginePattern);
  if (engineMatch) {
    const power = parseInt(engineMatch[1]);
    if (power >= 45 && power <= 1000) return power;
  }

  // Priorité 4 : premier nombre valide (45-1000) en excluant ceux suivis de KWH
  const numbers = finitionUpper.matchAll(/(\d+)\s*(\w*)/g);
  for (const match of numbers) {
    const num = parseInt(match[1]);
    const suffix = match[2].toUpperCase();
    if (num >= 45 && num <= 1000 && suffix !== 'KWH' && suffix !== 'KW') {
      return num;
    }
  }

  return null;
}

// Extraire le nom du moteur de la finition Alcopa
function extractEngineFromFinition(finition) {
  if (!finition) return null;

  const finitionUpper = finition.toUpperCase();

  // Patterns de moteurs courants
  const enginePatterns = [
    // PSA (Peugeot, Citroën, DS, Opel)
    /BLUEHDI\s*\d+/i,
    /PURETECH\s*\d+/i,
    /HDI\s*\d+/i,
    /E-HDI\s*\d+/i,
    /THP\s*\d+/i,
    /VTI\s*\d+/i,
    // Renault, Dacia, Nissan
    /DCI\s*\d+/i,
    /BLUE\s*DCI\s*\d+/i,
    /TCE\s*\d+/i,
    /SCE\s*\d+/i,
    // Volkswagen Group (VW, Audi, Seat, Skoda)
    /TDI\s*\d+/i,
    /TSI\s*\d+/i,
    /TFSI\s*\d+/i,
    /GTI/i,
    /GTD/i,
    // Fiat, Alfa Romeo, Jeep
    /MULTIJET\s*\d*/i,
    /MULTIAIR\s*\d*/i,
    /JTDM?\s*\d+/i,
    // Ford
    /TDCI\s*\d+/i,
    /ECOBOOST\s*\d*/i,
    /ECOBLUE\s*\d*/i,
    // Mercedes
    /CDI\s*\d+/i,
    /BLUETEC\s*\d*/i,
    // BMW
    /D\s*\d{3}/i,  // ex: D 150
    /I\s*\d{3}/i,  // ex: I 150
    // Toyota, Lexus
    /D-4D\s*\d*/i,
    /HYBRID\s*\d*/i,
    // Hyundai, Kia
    /CRDI\s*\d+/i,
    /T-GDI\s*\d*/i,
    // Iveco
    /HI-MATIC/i,
    /DAILY\s*\d+\.\d+/i,
    // Générique - puissance en CV/CH
    /\d+\s*CV/i,
    /\d+\s*CH/i,
  ];

  for (const pattern of enginePatterns) {
    const match = finitionUpper.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

// Détecter si c'est un utilitaire
function isUtilitaireVehicle(vehicleData) {
  const utilitaireKeywords = ['FOURGON', 'UTILITAIRE', 'CAMION', 'BENNE', 'PLATEAU', 'DAILY', 'MASTER', 'TRAFIC', 'BOXER', 'JUMPER', 'DUCATO', 'SPRINTER', 'CRAFTER', 'TRANSIT', 'VITO', 'EXPERT', 'JUMPY', 'PROACE'];

  const modelUpper = (vehicleData.model || '').toUpperCase();
  const finitionUpper = (vehicleData.finition || '').toUpperCase();
  const typeUpper = (vehicleData.type || '').toUpperCase();

  // Vérifier le type explicite
  if (typeUpper.includes('UTILITAIRE')) {
    return true;
  }

  // Vérifier les mots-clés dans le modèle ou la finition
  return utilitaireKeywords.some(keyword =>
    modelUpper.includes(keyword) || finitionUpper.includes(keyword)
  );
}

// Construire le texte de recherche (Marque + Modèle simplifié)
function buildSearchText(vehicleData) {
  const brand = vehicleData.brand || '';
  let model = vehicleData.model || '';

  // Simplifier le modèle : prendre seulement le premier mot
  // Ex: "DAILY FOURGON" -> "DAILY"
  // Ex: "308 SW" -> "308"
  const modelWords = model.split(/\s+/);
  const simplifiedModel = modelWords[0] || '';

  return `${brand} ${simplifiedModel}`.trim();
}

// Mapper les énergies Alcopa vers les codes LeBonCoin
function mapEnergyToLeBonCoin(energyType) {
  if (!energyType) return null;

  const energyUpper = energyType.toUpperCase();

  // Codes LeBonCoin : 1=Essence, 2=Diesel, 3=GPL, 4=Électrique, 6=Hybride
  const mapping = {
    'ESSENCE': '1',
    'ES': '1',
    'DIESEL': '2',
    'GO': '2',        // Gasoil = Diesel
    'GAZOLE': '2',
    'GPL': '3',
    'ELECTRIQUE': '4',
    'ÉLECTRIQUE': '4',
    'EL': '4',
    'HYBRIDE': '6',
    'HY': '6',
    'EH': '6',        // Essence Hybride
    'GH': '6',        // Gazole Hybride
  };

  return mapping[energyUpper] || null;
}

// Mapper les boîtes de vitesse Alcopa vers les codes LeBonCoin
function mapGearboxToLeBonCoin(transmission) {
  if (!transmission) return null;

  const transUpper = transmission.toUpperCase();

  // Codes LeBonCoin : 1=Manuelle, 2=Automatique
  if (transUpper.includes('AUTO') || transUpper.includes('BVA') || transUpper.includes('ROBOTISÉE')) {
    return '2';
  } else if (transUpper.includes('MANUEL') || transUpper.includes('BVM')) {
    return '1';
  }

  return null;
}

function showLoadingModal(source) {
  console.log('⏳ showLoadingModal() called, source:', source);

  // Remove existing modal if any
  removeExistingModal();
  console.log('✓ Existing modal removed');

  const modal = document.createElement('div');
  modal.className = 'alcopa-results-modal';
  console.log('✓ Loading modal element created');

  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Comparaison ${source === 'leboncoin' ? 'LeBonCoin' : 'La Centrale'}</h2>
        <button class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p class="loading-text">Recherche de véhicules similaires...</p>
        </div>
      </div>
    </div>
  `;

  console.log('✓ Loading modal HTML built');

  // Add close button handler
  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
  console.log('✓ Close handlers attached');

  console.log('📍 Appending loading modal to body...');
  document.body.appendChild(modal);
  console.log('✅ LOADING MODAL APPENDED!');
}

function showResultsModal(analysisData, source, vehicleData) {
  console.log('🎨 showResultsModal() called');
  console.log('Analysis data:', analysisData);
  console.log('Source:', source);
  console.log('Matched vehicles count:', analysisData.matchedVehicles?.length);
  console.log('Matched vehicles:', analysisData.matchedVehicles);

  // Remove existing modal
  removeExistingModal();
  console.log('✓ Existing modal removed');

  const modal = document.createElement('div');
  modal.className = 'alcopa-results-modal';
  // Add inline styles to FORCE visibility (temporary debug)
  modal.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(0, 0, 0, 0.5) !important;
  `;
  console.log('✓ Modal element created with inline styles');

  const sourceName = source === 'leboncoin' ? 'LeBonCoin' : 'La Centrale';

  console.log('Building modal HTML...');

  // Build table rows
  const tableRows = analysisData.matchedVehicles.map((vehicle, index) => {
    console.log(`Building row ${index + 1}:`, vehicle);
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(vehicle.title || 'N/A')}</td>
        <td class="price">${formatPrice(vehicle.price)}</td>
        <td>${formatMileage(vehicle.mileage)}</td>
        <td>${vehicle.year || 'N/A'}</td>
        <td><a href="${escapeHtml(vehicle.url)}" target="_blank" rel="noopener noreferrer">Voir</a></td>
      </tr>
    `;
  }).join('');

  console.log('Table rows HTML length:', tableRows.length);
  console.log('Table rows HTML:', tableRows);

  modal.innerHTML = `
    <div class="modal-content" style="position: relative; z-index: 10; width: 90%; max-width: 900px; max-height: 90vh; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3); overflow: hidden; display: flex; flex-direction: column;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
        <h2 style="margin: 0; font-size: 24px; font-weight: 600;">Comparaison ${sourceName}</h2>
        <button class="close-btn" style="background: none; border: none; color: white; font-size: 32px; cursor: pointer; padding: 0; width: 32px; height: 32px;">×</button>
      </div>
      <div class="modal-body" style="padding: 24px; overflow-y: auto; flex: 1;">
        <div class="price-summary">
          <div class="stat-card">
            <span class="label">Prix Alcopa</span>
            <span class="value">${formatPrice(analysisData.alcopaPrice)}</span>
          </div>
          <div class="stat-card highlight">
            <span class="label">Prix Marché Moyen</span>
            <span class="value">${formatPrice(analysisData.avgMarketPrice)}</span>
          </div>
          <div class="stat-card ${analysisData.profitMargin > 0 ? 'positive' : 'negative'}">
            <span class="label">Marge Estimée</span>
            <span class="value">${formatPrice(analysisData.profitMargin)}</span>
            <span class="percentage">(${analysisData.profitPercentage.toFixed(1)}%)</span>
          </div>
          <div class="stat-card">
            <span class="label">Recommandation</span>
            <span class="value recommendation">${analysisData.recommendation}</span>
          </div>
        </div>

        <div class="top-listings">
          <h3>Top ${analysisData.top5Prices.length} Prix les Plus Élevés</h3>
          <table class="results-table">
            <thead>
              <tr>
                <th>Rang</th>
                <th>Titre</th>
                <th>Prix</th>
                <th>Kilométrage</th>
                <th>Année</th>
                <th>Lien</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <div class="all-matches">
          <p><strong>${analysisData.totalMatches}</strong> véhicules similaires trouvés sur ${sourceName}</p>
          <p>Fourchette de prix: ${formatPrice(analysisData.minPrice)} - ${formatPrice(analysisData.maxPrice)}</p>
        </div>
      </div>
    </div>
  `;

  console.log('✓ Modal HTML built');
  console.log('Modal innerHTML length:', modal.innerHTML.length);

  // Add close button handlers
  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
  console.log('✓ Close handlers attached');

  // Add ESC key handler
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  console.log('✓ ESC handler attached');

  console.log('📍 Appending modal to body...');
  document.body.appendChild(modal);
  console.log('✅ MODAL APPENDED TO DOM!');
  console.log('Modal element:', modal);
  console.log('Modal outerHTML preview:', modal.outerHTML.substring(0, 500));

  // Check visibility
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    const styles = window.getComputedStyle(modalContent);
    console.log('Modal content styles:', {
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      zIndex: styles.zIndex,
      position: styles.position,
      width: styles.width,
      height: styles.height,
      backgroundColor: styles.backgroundColor
    });
  }

  console.log('Number of .alcopa-results-modal elements in DOM:', document.querySelectorAll('.alcopa-results-modal').length);
}

function showErrorModal(errorMessage, source) {
  // Remove existing modal
  removeExistingModal();

  const modal = document.createElement('div');
  modal.className = 'alcopa-results-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Erreur de Comparaison</h2>
        <button class="close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="error-container">
          <div class="error-icon">⚠️</div>
          <p class="error-message">Impossible de récupérer les données de ${source === 'leboncoin' ? 'LeBonCoin' : 'La Centrale'}</p>
          <p class="error-details">${escapeHtml(errorMessage)}</p>
        </div>
      </div>
    </div>
  `;

  // Add close button handlers
  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());

  document.body.appendChild(modal);
}

function removeExistingModal() {
  const existing = document.querySelector('.alcopa-results-modal');
  if (existing) {
    existing.remove();
  }
}

// Utility functions
function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price)) {
    return 'N/A';
  }
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

function formatMileage(mileage) {
  if (mileage === null || mileage === undefined || isNaN(mileage)) {
    return 'N/A';
  }
  return new Intl.NumberFormat('fr-FR').format(mileage) + ' km';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==============================
// Indicateur de marge LeBonCoin
// ==============================

function createMarginButton(vehicleData) {
  const button = document.createElement('button');
  button.className = 'comparison-icon margin-icon';
  button.dataset.vehicle = JSON.stringify(vehicleData);
  button.innerHTML = '<span class="margin-loading">⏳</span>';
  button.title = 'Calcul de la marge en cours...';

  // Envoyer une requête au service worker pour calculer la marge
  chrome.runtime.sendMessage({
    action: 'CALCULATE_MARGIN',
    vehicleData: vehicleData
  }).then(response => {
    if (response.success) {
      const marginData = response.data;

      // Calculer les frais pour afficher la marge nette
      const fees = calculateFees(vehicleData.price);
      const marginNet = marginData.avgMarketPrice - fees.total;
      const isPositive = marginNet >= 0;

      // Ajouter la classe positive/negative sur le bouton lui-même
      button.classList.add(isPositive ? 'positive' : 'negative');
      button.innerHTML = `<span class="margin-value">${isPositive ? '+' : ''}${formatPrice(marginNet)}</span>`;
      button.title = `Marge nette (après frais): ${isPositive ? '+' : ''}${formatPrice(marginNet)}`;

      // Au clic, afficher les détails
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showMarginModal(marginData, vehicleData);
      });
    } else {
      throw new Error(response.error || 'Erreur inconnue');
    }
  }).catch(error => {
    console.error('Error calculating margin:', error);
    button.innerHTML = '<span class="margin-error">❌</span>';
    button.title = 'Erreur lors du calcul de la marge';
  });

  return button;
}

async function calculateMarginFromLeBonCoin(vehicleData) {
  console.log('📊 Calculating margin from LeBonCoin...');

  // Construire les 2 URLs
  const url1 = buildLeBonCoinUrl(vehicleData);
  const url2 = buildLeBonCoinGeneralUrlWithStrategy(vehicleData, {
    modelType: 'twoWords',
    kmTolerance: 40000,
    yearTolerance: 2
  });

  // Scraper les 2 URLs
  const [prices1, prices2] = await Promise.all([
    scrapeLeBonCoinPrices(url1),
    scrapeLeBonCoinPrices(url2)
  ]);

  console.log(`Found ${prices1.length} prices in tab 1`);
  console.log(`Found ${prices2.length} prices in tab 2`);

  // Sélectionner les 5 premiers prix selon la logique demandée
  let selectedPrices = [];
  if (prices1.length > 0) {
    // Prendre les prix de l'onglet 1 (max 5)
    selectedPrices = prices1.slice(0, 5);
  } else if (prices2.length > 0) {
    // Sinon prendre les 5 premiers de l'onglet 2
    selectedPrices = prices2.slice(0, 5);
  }

  if (selectedPrices.length === 0) {
    throw new Error('Aucun prix trouvé sur LeBonCoin');
  }

  // Calculer la marge moyenne
  const avgMarketPrice = selectedPrices.reduce((sum, p) => sum + p, 0) / selectedPrices.length;
  const margin = avgMarketPrice - vehicleData.price;
  const minPrice = Math.min(...[...prices1, ...prices2]);
  const maxPrice = Math.max(...[...prices1, ...prices2]);
  const totalAds = prices1.length + prices2.length;

  return {
    margin,
    avgMarketPrice,
    alcopaPrice: vehicleData.price,
    top5Prices: selectedPrices,
    minPrice,
    maxPrice,
    totalAds,
    pricesTab1: prices1.length,
    pricesTab2: prices2.length
  };
}

async function scrapeLeBonCoinPrices(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();

    // Parser le HTML pour extraire les prix
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);

    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const ads = nextData?.props?.pageProps?.searchData?.ads ||
                    nextData?.props?.pageProps?.ads ||
                    nextData?.props?.initialState?.ads || [];

        // Extraire les prix et les trier par ordre décroissant
        const prices = ads
          .map(ad => ad.price?.[0] || ad.price || 0)
          .filter(p => p > 0)
          .sort((a, b) => b - a); // Tri décroissant

        return prices;
      } catch (e) {
        console.error('Error parsing __NEXT_DATA__:', e);
      }
    }

    // Fallback: extraire les prix avec regex
    const priceMatches = html.match(/"price":\s*(\d+)/g);
    if (priceMatches) {
      const prices = priceMatches
        .map(m => parseInt(m.match(/\d+/)[0]))
        .filter(p => p > 0)
        .sort((a, b) => b - a);
      return prices;
    }

    return [];
  } catch (error) {
    console.error('Error scraping LeBonCoin prices:', error);
    return [];
  }
}

function showMarginModal(marginData, vehicleData) {
  removeExistingModal();

  const modal = document.createElement('div');
  modal.className = 'alcopa-results-modal';
  modal.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(0, 0, 0, 0.5) !important;
  `;

  // Calculer les frais Alcopa
  const fees = calculateFees(marginData.alcopaPrice);
  const marginWithFees = marginData.avgMarketPrice - fees.total;
  const isPositiveWithFees = marginWithFees >= 0;

  modal.innerHTML = `
    <div class="modal-content" style="position: relative; z-index: 10; width: 90%; max-width: 500px; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3); overflow: hidden; display: flex; flex-direction: column;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: linear-gradient(135deg, ${isPositiveWithFees ? '#4CAF50' : '#f44336'} 0%, ${isPositiveWithFees ? '#388E3C' : '#c62828'} 100%); color: white;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 600;">Marge LeBonCoin</h2>
        <button class="close-btn" style="background: none; border: none; color: white; font-size: 32px; cursor: pointer; padding: 0; width: 32px; height: 32px;">×</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; font-weight: 700; color: ${isPositiveWithFees ? '#4CAF50' : '#f44336'};">
            ${isPositiveWithFees ? '+' : ''}${formatPrice(marginWithFees)}
          </div>
          <div style="font-size: 16px; color: #666; margin-top: 8px;">
            Marge nette (après frais)
          </div>
        </div>

        <div style="margin-bottom: 20px; padding: 12px; background: #f5f5f5; border-radius: 8px; text-align: center;">
          <div style="font-size: 18px; font-weight: 600; color: #333;">
            ${marginData.totalAds} annonces
          </div>
          <div style="font-size: 13px; color: #666; margin-top: 4px;">
            ${marginData.pricesTab1} prix (onglet 1) + ${marginData.pricesTab2} prix (onglet 2)
          </div>
        </div>

        <div>
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #333;">Top 5 Prix</h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${marginData.top5Prices.map((price, i) => `
              <div style="display: flex; justify-content: space-between; padding: 10px 14px; background: #f5f5f5; border-radius: 6px;">
                <span style="font-weight: 500; color: #666;">#${i + 1}</span>
                <span style="font-weight: 600; color: #2196F3; font-size: 15px;">${formatPrice(price)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(modal);
}

// ==============================
// Calcul des frais Alcopa
// ==============================

function createFeesButton(vehicleData) {
  const button = document.createElement('button');
  button.className = 'comparison-icon calculator-icon';
  button.dataset.vehicle = JSON.stringify(vehicleData);

  // Calculer les frais et afficher le prix TTC directement
  const fees = calculateFees(vehicleData.price);
  const priceText = document.createElement('span');
  priceText.className = 'fees-price-value';
  priceText.textContent = formatPrice(fees.total);
  priceText.title = 'Prix TTC avec frais';

  button.appendChild(priceText);

  // Hover : afficher le détail des frais directement
  let hoverPopup = null;

  button.addEventListener('mouseenter', () => {
    const data = JSON.parse(button.dataset.vehicle);
    const price = data.price;
    if (!price || price <= 0) return;

    const fees = calculateFees(price);
    const commissionLabel = fees.isMinimum
      ? 'Commission (min. 360\u00A0€)'
      : 'Commission (14,4%)';

    hoverPopup = document.createElement('div');
    hoverPopup.className = 'alcopa-fees-hover-popup';
    hoverPopup.style.cssText = `
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: 8px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      padding: 12px 16px;
      z-index: 100000;
      min-width: 270px;
      font-size: 13px;
      color: #333;
      pointer-events: none;
    `;

    hoverPopup.innerHTML = `
      <div style="font-weight:700; font-size:14px; margin-bottom:8px; color:#1565C0;">Calcul des Frais TTC</div>
      <table style="width:100%; border-collapse:collapse;">
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:4px 0;">Prix d'adjudication</td>
          <td style="padding:4px 0; text-align:right; font-weight:600;">${formatPrice(fees.price)}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:4px 0; color:#666;">${commissionLabel}</td>
          <td style="padding:4px 0; text-align:right; color:#e53935;">${formatPrice(fees.commission)}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:4px 0; color:#666;">Frais de vente</td>
          <td style="padding:4px 0; text-align:right; color:#e53935;">${formatPrice(fees.fraisFixes)}</td>
        </tr>
        <tr style="border-bottom:2px solid #1565C0;">
          <td style="padding:4px 0; color:#666;">Frais LIVE</td>
          <td style="padding:4px 0; text-align:right; color:#e53935;">${formatPrice(fees.fraisLive)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-weight:700; font-size:15px;">TOTAL TTC</td>
          <td style="padding:6px 0; text-align:right; font-weight:700; font-size:15px; color:#1565C0;">${formatPrice(fees.total)}</td>
        </tr>
      </table>
      ${fees.isMinimum ? '<div style="margin-top:6px; font-size:11px; color:#e65100; background:#fff3e0; padding:4px 6px; border-radius:4px;">Min. forfaitaire appliqué (14,4% = ' + formatPrice(fees.price * fees.commissionRate) + ' &lt; 360\u00A0€)</div>' : ''}
    `;

    button.appendChild(hoverPopup);
  });

  button.addEventListener('mouseleave', () => {
    if (hoverPopup) {
      hoverPopup.remove();
      hoverPopup = null;
    }
  });

  // Click : ouvre aussi la modale complète
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const data = JSON.parse(button.dataset.vehicle);
    const price = data.price;
    if (price && price > 0) {
      showFeesModal(price);
    } else {
      showFeesModal(0);
    }
  });

  return button;
}

function calculateFees(price) {
  const commissionRate = 0.144; // 14,4% TTC
  const commissionMin = 360;    // Minimum 360 EUR TTC
  const commission = Math.max(price * commissionRate, commissionMin);
  const fraisFixes = 140;       // Frais de vente fixes TTC
  const fraisLive = 40;         // Frais Alcopa LIVE TTC
  const totalFrais = commission + fraisFixes + fraisLive;
  const total = price + totalFrais;
  const isMinimum = (price * commissionRate) < commissionMin;

  return {
    price,
    commission: Math.round(commission * 100) / 100,
    commissionRate,
    isMinimum,
    fraisFixes,
    fraisLive,
    totalFrais: Math.round(totalFrais * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

function showFeesModal(price) {
  removeExistingModal();

  const fees = calculateFees(price);
  const modal = document.createElement('div');
  modal.className = 'alcopa-results-modal';
  modal.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(0, 0, 0, 0.5) !important;
  `;

  const commissionLabel = fees.isMinimum
    ? 'Commission (minimum forfaitaire)'
    : `Commission (14,4%)`;

  modal.innerHTML = `
    <div class="modal-content" style="position: relative; z-index: 10; width: 90%; max-width: 500px; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3); overflow: hidden; display: flex; flex-direction: column;">
      <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: linear-gradient(135deg, #2196F3 0%, #1565C0 100%); color: white;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 600;">Calcul des Frais TTC</h2>
        <button class="close-btn" style="background: none; border: none; color: white; font-size: 32px; cursor: pointer; padding: 0; width: 32px; height: 32px;">×</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
          <tbody>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 12px 8px; font-weight: 500;">Prix d'adjudication</td>
              <td style="padding: 12px 8px; text-align: right; font-weight: 600;">${formatPrice(fees.price)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 12px 8px; color: #666;">${commissionLabel}</td>
              <td style="padding: 12px 8px; text-align: right; color: #e53935;">${formatPrice(fees.commission)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 12px 8px; color: #666;">Frais de vente</td>
              <td style="padding: 12px 8px; text-align: right; color: #e53935;">${formatPrice(fees.fraisFixes)}</td>
            </tr>
            <tr style="border-bottom: 2px solid #1565C0;">
              <td style="padding: 12px 8px; color: #666;">Frais Alcopa LIVE</td>
              <td style="padding: 12px 8px; text-align: right; color: #e53935;">${formatPrice(fees.fraisLive)}</td>
            </tr>
            <tr>
              <td style="padding: 16px 8px; font-size: 18px; font-weight: 700;">TOTAL TTC</td>
              <td style="padding: 16px 8px; text-align: right; font-size: 22px; font-weight: 700; color: #1565C0;">${formatPrice(fees.total)}</td>
            </tr>
          </tbody>
        </table>
        ${fees.isMinimum ? '<p style="margin-top: 12px; padding: 10px; background: #fff3e0; border-radius: 6px; font-size: 13px; color: #e65100;">Le minimum forfaitaire de commission (360 €) s\'applique car 14,4% du prix (' + formatPrice(fees.price * fees.commissionRate) + ') est inférieur à 360 €.</p>' : ''}
        <p style="margin-top: 12px; font-size: 13px; color: #999; text-align: center;">Total des frais : ${formatPrice(fees.totalFrais)} (${(fees.totalFrais / fees.price * 100).toFixed(1)}% du prix)</p>
      </div>
    </div>
  `;

  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(modal);
}

// Injecter le prix total TTC directement sur la page, à droite du "?" d'aide
function injectTotalPriceLabel(price) {
  if (!price || price <= 0) return;

  // Éviter les doublons
  if (document.querySelector('.alcopa-total-price-label')) return;

  const fees = calculateFees(price);

  let targetElement = null;

  // Stratégie 1 : Trouver le "?" d'aide proche du prix (Mise à prix / Enchère courante)
  const candidates = document.querySelectorAll('a, button, span, i, div, small');
  for (const el of candidates) {
    const text = el.textContent.trim();
    if (text === '?' || text === '(?)' || el.classList.contains('help') || el.classList.contains('aide')) {
      // Vérifier le contexte parent : est-ce près d'un prix ?
      const parentText = (el.closest('div, section, td, tr, p') || el.parentElement || {}).textContent || '';
      if (parentText.match(/Mise\s+.?\s*prix/i) || parentText.match(/Ench.re\s+courante/i) || parentText.includes('€')) {
        targetElement = el;
        break;
      }
    }
  }

  // Stratégie 2 : Trouver n'importe quel "?" sur la page
  if (!targetElement) {
    for (const el of candidates) {
      const text = el.textContent.trim();
      if (text === '?' || text === '(?)') {
        targetElement = el;
        break;
      }
    }
  }

  // Stratégie 3 : Fallback - chercher l'élément prix avec "Mise à prix" ou "Enchère courante"
  if (!targetElement) {
    const allElements = document.body.querySelectorAll('*');
    for (const el of allElements) {
      if (el.children.length > 5) continue;
      const text = el.textContent.trim();
      if ((text.match(/Ench.re\s+courante/i) || text.match(/Mise\s+.?\s*prix/i)) && text.includes('€')) {
        targetElement = el;
        break;
      }
    }
  }

  if (!targetElement) {
    console.log('[Alcopa] No target element found to inject total price label');
    return;
  }

  const label = document.createElement('span');
  label.className = 'alcopa-total-price-label';
  label.style.cssText = `
    display: inline-block;
    margin-left: 10px;
    padding: 4px 10px;
    background: linear-gradient(135deg, #2196F3, #1565C0);
    color: white;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
    vertical-align: middle;
    white-space: nowrap;
  `;
  label.textContent = `Total TTC : ${formatPrice(fees.total)}`;
  label.title = 'Cliquez pour voir le détail des frais';

  // Au clic, ouvrir la modale détaillée
  label.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showFeesModal(price);
  });

  // Insérer juste après l'élément cible (à droite du "?")
  targetElement.insertAdjacentElement('afterend', label);
  console.log(`[Alcopa] Injected total price label: ${formatPrice(fees.total)} next to help icon`);
}
