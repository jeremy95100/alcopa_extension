// UI Injector - Creates and manages comparison icons on Alcopa pages

function createComparisonIcons(vehicleData, vehicleElement) {
  // Create container for icons
  const container = document.createElement('div');
  container.className = 'alcopa-comparison-icons';

  // Create LeBonCoin icon
  const leboncoinBtn = createIconButton('leboncoin', vehicleData);
  container.appendChild(leboncoinBtn);

  // Create La Centrale icon
  const lacentraleBtn = createIconButton('lacentrale', vehicleData);
  container.appendChild(lacentraleBtn);

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
    // Ouvrir 2 onglets : recherche voitures filtrée + recherche globale
    const filteredUrl = buildLeBonCoinUrl(vehicleData);
    const generalUrl = buildLeBonCoinGeneralUrl(vehicleData);
    console.log('Opening LeBonCoin filtered URL:', filteredUrl);
    console.log('Opening LeBonCoin general URL:', generalUrl);
    window.open(filteredUrl, '_blank');
    window.open(generalUrl, '_blank');
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

// Construire l'URL LeBonCoin recherche générale (toutes catégories, texte + filtres km/année)
function buildLeBonCoinGeneralUrl(vehicleData) {
  const params = new URLSearchParams();

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

  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
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
