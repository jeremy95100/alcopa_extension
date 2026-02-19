// Service Worker - Background script for handling scraping and message passing

console.log('Alcopa Price Comparison service worker loaded');

// Import utilities (note: in MV3, we need to use importScripts for non-module workers)
// Since we're using type: "module", we can use import statements
// However, for now we'll keep functions inline

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCRAPE_COMPARISON') {
    handleComparison(request.vehicleData, request.source)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => {
        console.error('Error in comparison:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate async response
    return true;
  }

  if (request.action === 'CALCULATE_MARGIN') {
    handleMarginCalculation(request.vehicleData)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => {
        console.error('Error calculating margin:', error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate async response
    return true;
  }
});

async function handleComparison(vehicleData, source) {
  console.log('=== Starting comparison ===');
  console.log('Source:', source);
  console.log('Vehicle data:', vehicleData);

  try {
    // Validate input data
    if (!vehicleData.brand || !vehicleData.model) {
      throw new Error(`Données véhicule incomplètes: marque="${vehicleData.brand}", modèle="${vehicleData.model}"`);
    }

    // Step 1: Check cache first
    const cacheKey = generateCacheKey(vehicleData, source);
    const cached = await getCachedResults(cacheKey);

    if (cached) {
      console.log('✓ Returning cached results');
      return cached;
    }

    // Step 2: Scrape the comparison site
    console.log('→ Starting scraping...');
    let scrapedVehicles;
    if (source === 'leboncoin') {
      scrapedVehicles = await scrapeLeBonCoin(vehicleData);
    } else if (source === 'lacentrale') {
      scrapedVehicles = await scrapeLaCentrale(vehicleData);
    } else {
      throw new Error(`Source inconnue: ${source}`);
    }

    console.log(`✓ Scraped ${scrapedVehicles.length} vehicles from ${source}`);

    if (scrapedVehicles.length === 0) {
      const sourceName = source === 'leboncoin' ? 'LeBonCoin' : 'La Centrale';
      throw new Error(`Aucun véhicule trouvé sur ${sourceName}. La recherche pour "${vehicleData.brand} ${vehicleData.model}" n'a retourné aucun résultat.`);
    }

    // Step 3: Match vehicles
    console.log('→ Matching vehicles...');
    const matchedVehicles = matchVehicles(vehicleData, scrapedVehicles);

    console.log(`✓ Matched ${matchedVehicles.length} similar vehicles`);

    if (matchedVehicles.length === 0) {
      throw new Error(`Aucun véhicule similaire trouvé parmi les ${scrapedVehicles.length} annonces. Essayez d'élargir les critères de recherche.`);
    }

    // Step 4: Calculate price analysis
    console.log('→ Calculating price analysis...');
    const analysis = calculatePriceAnalysis(vehicleData.price, matchedVehicles);

    console.log('✓ Analysis complete:', analysis);

    // Step 5: Cache results
    await cacheResults(cacheKey, analysis);

    console.log('=== Comparison successful ===');
    return analysis;
  } catch (error) {
    console.error('❌ Error in handleComparison:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

// Cache management
function generateCacheKey(vehicleData, source) {
  return `cache_${source}_${vehicleData.brand}_${vehicleData.model}_${vehicleData.year}_${Math.floor(vehicleData.mileage / 10000)}`;
}

async function getCachedResults(cacheKey) {
  try {
    const result = await chrome.storage.local.get(cacheKey);
    if (result[cacheKey]) {
      const { data, timestamp } = result[cacheKey];
      const age = Date.now() - timestamp;
      const TTL = 24 * 60 * 60 * 1000; // 24 hours

      if (age < TTL) {
        return data;
      } else {
        // Cache expired, remove it
        await chrome.storage.local.remove(cacheKey);
      }
    }
  } catch (error) {
    console.error('Error reading cache:', error);
  }
  return null;
}

async function cacheResults(cacheKey, data) {
  try {
    await chrome.storage.local.set({
      [cacheKey]: {
        data,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error writing cache:', error);
  }
}

// LeBonCoin scraper
async function scrapeLeBonCoin(vehicleData) {
  const searchURL = buildLeBonCoinSearchURL(vehicleData);

  console.log('Fetching LeBonCoin:', searchURL);

  try {
    const response = await fetch(searchURL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return parseLeBonCoinHTML(html);
  } catch (error) {
    console.error('Error scraping LeBonCoin:', error);
    throw new Error('Impossible de se connecter à LeBonCoin');
  }
}

function buildLeBonCoinSearchURL(vehicle) {
  // Use LeBonCoin's real filter parameters (discovered from manual search)
  // Format: /recherche?category=2&u_car_brand=...&u_car_model=...&fuel=...&regdate=...&mileage=...

  const params = new URLSearchParams();

  // Category - voitures
  params.set('category', '2');

  // Brand filter
  if (vehicle.brand) {
    params.set('u_car_brand', vehicle.brand.toUpperCase());
  }

  // Model filter (format: BRAND_Model)
  if (vehicle.brand && vehicle.model) {
    // Clean model name
    let modelCleaned = vehicle.model;
    const genericWords = ['FOURGON', 'SOCIETE', 'UTILITAIRE', 'VAN', 'CHASSIS', 'CABINE'];
    genericWords.forEach(word => {
      modelCleaned = modelCleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    });
    modelCleaned = modelCleaned.trim().replace(/\s+/g, ' ');

    // Take first word of model
    const modelParts = modelCleaned.split(' ');
    const modelShort = modelParts[0] || modelCleaned;

    // Format: BRAND_Model (with capital first letter)
    const modelFormatted = modelShort.charAt(0).toUpperCase() + modelShort.slice(1).toLowerCase();
    params.set('u_car_model', `${vehicle.brand.toUpperCase()}_${modelFormatted}`);
  }

  // Fuel filter (numeric codes: 1=essence, 2=diesel, 3=gpl, 4=electric, 5=hybrid)
  if (vehicle.energyType) {
    const fuelMap = {
      'GO': '2',        // Diesel
      'DIESEL': '2',
      'ES': '1',        // Essence
      'ESSENCE': '1',
      'GPL': '3',
      'ELECTRIQUE': '4',
      'EH': '5',        // Hybrid
      'HYBRIDE': '5'
    };
    const fuelCode = fuelMap[vehicle.energyType.toUpperCase()];
    if (fuelCode) {
      params.set('fuel', fuelCode);
    }
  }

  // Year filter (format: min-max)
  if (vehicle.year) {
    const yearMin = vehicle.year - 2;
    const yearMax = vehicle.year + 2;
    params.set('regdate', `${yearMin}-${yearMax}`);
  }

  // Mileage filter (format: min-max)
  if (vehicle.mileage) {
    const kmTolerance = 30000;
    const kmMin = Math.max(0, vehicle.mileage - kmTolerance);
    const kmMax = vehicle.mileage + kmTolerance;
    params.set('mileage', `${kmMin}-${kmMax}`);
  }

  // Gearbox filter (numeric codes: 1=manual, 2=automatic)
  if (vehicle.transmission) {
    const gearboxMap = {
      'MANUELLE': '1',
      'AUTOMATIQUE': '2',
      'SEMI-AUTOMATIQUE': '2'
    };
    const gearboxCode = gearboxMap[vehicle.transmission.toUpperCase()];
    if (gearboxCode) {
      params.set('gearbox', gearboxCode);
    }
  }

  const url = `${LEBONCOIN_BASE_URL}/recherche?${params.toString()}`;
  console.log('LeBonCoin URL with REAL filters:', url);
  console.log('Applied filters:', {
    marque: params.get('u_car_brand'),
    modèle: params.get('u_car_model'),
    carburant: params.get('fuel'),
    année: params.get('regdate'),
    kilométrage: params.get('mileage'),
    boîte: params.get('gearbox')
  });

  return url;
}

function parseLeBonCoinHTML(html) {
  console.log('Parsing LeBonCoin HTML, length:', html.length);

  const vehicles = [];

  // Extract page title
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const pageTitle = titleMatch ? titleMatch[1] : 'Unknown';
  console.log('LeBonCoin page title:', pageTitle);

  // LeBonCoin uses Next.js which stores data in __NEXT_DATA__ script
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);

  if (nextDataMatch) {
    console.log('Found __NEXT_DATA__ script');
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      console.log('Parsed Next.js data');

      // Navigate through the Next.js data structure
      // The ads are typically in props.pageProps or similar
      let ads = [];

      // Try to find ads in the data structure
      const pageProps = nextData?.props?.pageProps;

      if (pageProps?.searchData?.ads) {
        ads = pageProps.searchData.ads;
      } else if (pageProps?.ads) {
        ads = pageProps.ads;
      } else if (nextData?.props?.initialState?.ads) {
        ads = nextData.props.initialState.ads;
      }

      console.log(`Found ${ads.length} ads in Next.js data`);

      // Parse each ad
      ads.forEach((ad, index) => {
        try {
          const vehicle = {
            title: ad.subject || ad.title || 'Annonce LeBonCoin',
            price: ad.price?.[0] || ad.price || null,
            mileage: extractMileageFromAd(ad),
            year: extractYearFromAd(ad),
            url: ad.url ? (LEBONCOIN_BASE_URL + ad.url) : null,
            source: 'leboncoin'
          };

          if (index < 3) {
            console.log(`Sample ad ${index + 1}:`, vehicle);
          }

          // Only add if we have at least title and price
          if (vehicle.title && vehicle.price) {
            vehicles.push(vehicle);
          }
        } catch (error) {
          console.error('Error parsing ad from Next.js data:', error);
        }
      });

      console.log(`Successfully parsed ${vehicles.length} vehicles from __NEXT_DATA__`);

      if (vehicles.length > 0) {
        return vehicles;
      }
    } catch (error) {
      console.error('Error parsing __NEXT_DATA__:', error);
      console.log('Next.js data preview:', nextDataMatch[1].substring(0, 500));
    }
  } else {
    console.warn('__NEXT_DATA__ script not found, trying regex fallback...');
  }

  // Fallback: Try regex patterns if Next.js data extraction failed
  console.warn('Trying regex fallback patterns...');

  // Try to find any price patterns in the HTML
  const priceRegex = /"price":\s*(\d+)/g;
  const subjectRegex = /"subject":\s*"([^"]+)"/g;

  let priceMatch;
  let subjectMatch;
  const prices = [];
  const subjects = [];

  while ((priceMatch = priceRegex.exec(html)) !== null) {
    prices.push(parseInt(priceMatch[1]));
  }

  while ((subjectMatch = subjectRegex.exec(html)) !== null) {
    subjects.push(subjectMatch[1]);
  }

  console.log(`Found ${prices.length} prices and ${subjects.length} subjects in HTML`);

  // Match prices with subjects
  const minLength = Math.min(prices.length, subjects.length, 20);
  for (let i = 0; i < minLength; i++) {
    vehicles.push({
      title: subjects[i] || 'Annonce LeBonCoin',
      price: prices[i],
      mileage: null,
      year: null,
      url: LEBONCOIN_BASE_URL + '/voitures',
      source: 'leboncoin'
    });
  }

  console.log(`Successfully parsed ${vehicles.length} vehicles from LeBonCoin`);

  if (vehicles.length === 0) {
    console.error('HTML preview:', html.substring(0, 1000));
    throw new Error('Aucune annonce trouvée sur LeBonCoin. Essayez avec un véhicule plus courant.');
  }

  return vehicles;
}

function extractMileageFromAd(ad) {
  // Try to find mileage in attributes
  if (ad.attributes) {
    for (const attr of ad.attributes) {
      if (attr.key === 'mileage' || attr.key === 'kilometrage') {
        return parseInt(attr.value);
      }
      if (typeof attr.value === 'string' && attr.value.match(/\d+\s*km/i)) {
        return parseMileage(attr.value);
      }
    }
  }

  // Try in body
  if (ad.body) {
    const kmMatch = ad.body.match(/(\d+\s*\d+)\s*km/i);
    if (kmMatch) {
      return parseMileage(kmMatch[0]);
    }
  }

  return null;
}

function extractYearFromAd(ad) {
  // Try to find year in attributes
  if (ad.attributes) {
    for (const attr of ad.attributes) {
      if (attr.key === 'regdate' || attr.key === 'year' || attr.key === 'annee') {
        const year = parseInt(attr.value);
        if (year >= 1900 && year <= new Date().getFullYear() + 1) {
          return year;
        }
      }
    }
  }

  // Try in body or subject
  const text = (ad.body || '') + ' ' + (ad.subject || '');
  const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 1900 && year <= new Date().getFullYear() + 1) {
      return year;
    }
  }

  return null;
}

// Helper function to strip HTML tags
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

// La Centrale scraper
async function scrapeLaCentrale(vehicleData) {
  const searchURL = buildLaCentraleSearchURL(vehicleData);

  console.log('Fetching La Centrale:', searchURL);

  try {
    const response = await fetch(searchURL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return parseLaCentraleHTML(html);
  } catch (error) {
    console.error('Error scraping La Centrale:', error);
    throw new Error('Impossible de se connecter à La Centrale');
  }
}

function buildLaCentraleSearchURL(vehicle) {
  const params = new URLSearchParams({
    makesModelsCommercialNames: `${vehicle.brand}:${vehicle.model}`,
  });

  if (vehicle.mileage) {
    params.set('mileageMin', Math.max(0, vehicle.mileage - 20000));
    params.set('mileageMax', vehicle.mileage + 20000);
  }

  if (vehicle.year) {
    params.set('yearMin', vehicle.year - 1);
    params.set('yearMax', vehicle.year + 1);
  }

  return `${LACENTRALE_BASE_URL}/listing?${params.toString()}`;
}

function parseLaCentraleHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const vehicles = [];

  // Try to find vehicle listings
  const adElements = doc.querySelectorAll('.searchCard, [class*="vehicleCard"], article, .adLineContainer');

  adElements.forEach(ad => {
    try {
      const vehicle = {
        title: ad.querySelector('.vehicleTitle, h3, .ad-title, [class*="title"]')?.textContent?.trim(),
        price: parsePrice(ad.querySelector('.priceValue, .price, [class*="price"]')?.textContent),
        mileage: parseMileage(ad.querySelector('.mileage, [class*="mileage"]')?.textContent),
        year: parseYear(ad.querySelector('.year, [class*="year"]')?.textContent),
        url: ad.href || ad.querySelector('a')?.href,
        source: 'lacentrale'
      };

      if (vehicle.title && vehicle.price) {
        vehicles.push(vehicle);
      }
    } catch (error) {
      console.error('Error parsing LC ad:', error);
    }
  });

  return vehicles;
}

// Utility parsers
function parsePrice(text) {
  if (!text) return null;
  const match = text.replace(/\s/g, '').match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function parseMileage(text) {
  if (!text) return null;
  const match = text.replace(/\s/g, '').match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function parseYear(text) {
  if (!text) return null;
  const match = text.match(/(\d{4})/);
  if (match) {
    const year = parseInt(match[1]);
    return (year >= 1900 && year <= new Date().getFullYear() + 1) ? year : null;
  }
  return null;
}

// Vehicle matching algorithm
function matchVehicles(alcopaVehicle, comparisonVehicles) {
  console.log(`→ Filtering ${comparisonVehicles.length} vehicles...`);
  console.log('Filters:', {
    marque: alcopaVehicle.brand,
    modèle: alcopaVehicle.model,
    énergie: alcopaVehicle.energyType,
    kilométrage: alcopaVehicle.mileage ? `${alcopaVehicle.mileage} km (±30000)` : 'N/A',
    année: alcopaVehicle.year ? `${alcopaVehicle.year} (±2)` : 'N/A'
  });

  const scoredVehicles = comparisonVehicles
    .map(vehicle => ({
      ...vehicle,
      score: calculateMatchScore(alcopaVehicle, vehicle)
    }))
    .filter(vehicle => {
      if (vehicle.score >= 60) {
        return true;
      }
      return false;
    })
    .sort((a, b) => b.score - a.score);

  console.log(`✓ ${scoredVehicles.length} vehicles passed filters (score ≥ 60)`);

  if (scoredVehicles.length > 0) {
    console.log('Top 3 matches:');
    scoredVehicles.slice(0, 3).forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.title} - ${v.price}€ (score: ${v.score})`);
    });
  }

  return scoredVehicles;
}

function calculateMatchScore(alcopaVehicle, comparisonVehicle) {
  let score = 0;

  // Brand + Model (required, 40 points)
  const alcBrand = normalize(alcopaVehicle.brand);
  let alcModel = normalize(alcopaVehicle.model);
  const cmpTitle = normalize(comparisonVehicle.title || '');

  // Clean model by removing generic words for better matching
  const genericWords = ['fourgon', 'societe', 'utilitaire', 'van', 'chassis', 'cabine'];
  genericWords.forEach(word => {
    alcModel = alcModel.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  });
  alcModel = alcModel.trim().replace(/\s+/g, ' ');

  // Extract first significant word from model (e.g., "JUMPY" from "JUMPY FGN M BLUEHDI")
  const modelWords = alcModel.split(' ').filter(word => word.length > 2);
  const mainModelWord = modelWords[0] || alcModel;

  // STRICT FILTER 1: Brand must match exactly (like LeBonCoin's "Marque" filter)
  if (!cmpTitle.includes(alcBrand)) {
    return 0; // Wrong brand - reject immediately
  }

  // STRICT FILTER 2: Model must match (like LeBonCoin's "Modèle" filter)
  if (!cmpTitle.includes(mainModelWord)) {
    return 0; // Wrong model - reject immediately
  }

  // If we get here, brand + model match
  score += 40;

  // FILTER 3: Energy type (like LeBonCoin's "Énergie" filter)
  // This is now a filter, not just a score bonus
  if (alcopaVehicle.energyType) {
    const energyMap = {
      'GO': ['diesel', 'dci', 'hdi', 'bluehdi', 'tdi'],
      'ES': ['essence', 'tce', 'tsi', 'vti'],
      'EH': ['hybrid', 'hybride', 'e-tech'],
      'ELECTRIQUE': ['electric', 'electrique', 'ev']
    };

    const energyKeywords = energyMap[alcopaVehicle.energyType.toUpperCase()] || [];
    const hasEnergyMatch = energyKeywords.some(keyword => cmpTitle.includes(keyword));

    if (hasEnergyMatch) {
      score += 10; // Energy matches
    } else {
      // Energy doesn't match - reduce score significantly but don't reject
      score -= 10;
    }
  }

  // Year (30 points)
  if (alcopaVehicle.year && comparisonVehicle.year) {
    const yearDiff = Math.abs(alcopaVehicle.year - comparisonVehicle.year);
    if (yearDiff === 0) score += 30;
    else if (yearDiff === 1) score += 20;
    else if (yearDiff === 2) score += 10;
  }

  // Mileage (20 points)
  if (alcopaVehicle.mileage && comparisonVehicle.mileage) {
    const kmDiff = Math.abs(alcopaVehicle.mileage - comparisonVehicle.mileage);
    if (kmDiff <= 10000) score += 20;
    else if (kmDiff <= 20000) score += 15;
    else if (kmDiff <= 30000) score += 10;
  }

  // Energy type (10 points) - check in title
  if (alcopaVehicle.energyType) {
    const energyNorm = normalize(alcopaVehicle.energyType);
    if (cmpTitle.includes(energyNorm)) {
      score += 10;
    }
  }

  return score;
}

function normalize(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// Price analysis
function calculatePriceAnalysis(alcopaPrice, matchedVehicles) {
  const prices = matchedVehicles.map(v => v.price).filter(p => p > 0).sort((a, b) => b - a);

  if (prices.length === 0) {
    throw new Error('Aucun prix valide trouvé');
  }

  const avgMarketPrice = average(prices);
  const medianPrice = median(prices);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const profitMargin = avgMarketPrice - (alcopaPrice || 0);
  const profitPercentage = alcopaPrice ? (profitMargin / alcopaPrice) * 100 : 0;

  return {
    alcopaPrice: alcopaPrice || 0,
    top5Prices: prices.slice(0, 5),
    avgMarketPrice,
    medianPrice,
    minPrice,
    maxPrice,
    profitMargin,
    profitPercentage,
    recommendation: getRecommendation(profitPercentage),
    totalMatches: matchedVehicles.length,
    matchedVehicles: matchedVehicles.slice(0, 5)
  };
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function getRecommendation(profitPct) {
  if (profitPct >= 20) return '🟢 Excellente affaire';
  if (profitPct >= 10) return '🟡 Bonne opportunité';
  if (profitPct >= 5) return '🟠 Marge correcte';
  if (profitPct >= 0) return '🔴 Faible marge';
  return '⚫ Prix au-dessus du marché';
}

// Constants (duplicated from constants.js since service worker can't easily import)
const LEBONCOIN_BASE_URL = 'https://www.leboncoin.fr';
const LACENTRALE_BASE_URL = 'https://www.lacentrale.fr';

// ==============================
// Margin Calculation Functions
// ==============================

async function handleMarginCalculation(vehicleData) {
  console.log('📊 Calculating margin from LeBonCoin...');
  console.log('Vehicle data:', vehicleData);

  // Construire les 2 URLs
  const url1 = buildLeBonCoinUrlForMargin(vehicleData);
  const url2 = buildLeBonCoinGeneralUrlWithStrategyForMargin(vehicleData, {
    modelType: 'finitionThreeWords',
    kmTolerance: 20000,
    yearTolerance: 2
  });

  console.log('URL 1 (filtered):', url1);
  console.log('URL 2 (fallback):', url2);

  // Scraper les 2 URLs
  const [prices1Raw, prices2Raw] = await Promise.all([
    scrapeLeBonCoinPricesOnly(url1),
    scrapeLeBonCoinPricesOnly(url2)
  ]);

  console.log(`Found ${prices1Raw.length} prices in tab 1 (before outlier removal)`);
  console.log(`Found ${prices2Raw.length} prices in tab 2 (before outlier removal)`);

  // Supprimer les outliers de chaque liste
  const prices1 = removeOutliers(prices1Raw);
  const prices2 = removeOutliers(prices2Raw);

  console.log(`After outlier removal: ${prices1.length} prices in tab 1, ${prices2.length} prices in tab 2`);

  // Sélectionner les 5 premiers prix en privilégiant l'onglet 1
  let selectedPrices = [];

  // Trier les prix de chaque onglet du moins cher au plus cher
  const sortedPrices1 = prices1.sort((a, b) => a - b);
  const sortedPrices2 = prices2.sort((a, b) => a - b);

  if (sortedPrices1.length >= 5) {
    // Si l'onglet 1 a au moins 5 résultats, prendre les 5 moins chers de l'onglet 1
    selectedPrices = sortedPrices1.slice(0, 5);
  } else if (sortedPrices1.length > 0) {
    // Prendre tous les prix de l'onglet 1 et compléter avec l'onglet 2
    const needed = 5 - sortedPrices1.length;
    selectedPrices = [...sortedPrices1, ...sortedPrices2.slice(0, needed)];
    // Trier le résultat final
    selectedPrices.sort((a, b) => a - b);
  } else {
    // Aucun prix dans l'onglet 1, prendre les 5 moins chers de l'onglet 2
    selectedPrices = sortedPrices2.slice(0, 5);
  }

  if (selectedPrices.length === 0) {
    throw new Error('Aucun prix trouvé sur LeBonCoin');
  }

  // Calculer la marge moyenne
  const avgMarketPrice = selectedPrices.reduce((sum, p) => sum + p, 0) / selectedPrices.length;
  const margin = avgMarketPrice - vehicleData.price;
  const allPrices = [...prices1, ...prices2].filter(p => p > 0);
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
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

async function scrapeLeBonCoinPricesOnly(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });

    if (!response.ok) {
      console.error('HTTP error:', response.status);
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

        // Debug: afficher les premiers prix
        const allPrices = ads.map(ad => ad.price?.[0] || ad.price || 0).filter(p => p > 0);
        console.log(`Found ${ads.length} ads with ${allPrices.length} prices:`, allPrices.sort((a, b) => a - b));

        // Extraire les prix et les trier par ordre décroissant
        const prices = ads
          .map(ad => ad.price?.[0] || ad.price || 0)
          .filter(p => p > 0)
          .sort((a, b) => b - a); // Tri décroissant

        console.log(`Extracted ${prices.length} prices from ${ads.length} total ads`);
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
      console.log(`Extracted ${prices.length} prices from regex fallback`);
      return prices;
    }

    return [];
  } catch (error) {
    console.error('Error scraping LeBonCoin prices:', error);
    return [];
  }
}

function buildLeBonCoinUrlForMargin(vehicleData) {
  const params = new URLSearchParams();

  // Catégorie : 2 = Voitures
  params.set('category', '2');

  // Texte de recherche : Marque + Finition complète (inclut modèle)
  if (vehicleData.brand) {
    let searchText;
    if (vehicleData.finition) {
      // Prendre les 10 premiers mots de la finition
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

function buildLeBonCoinGeneralUrlWithStrategyForMargin(vehicleData, strategy) {
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

function mapEnergyToLeBonCoin(energyType) {
  if (!energyType) return null;

  const energyMap = {
    'GO': '2',
    'DIESEL': '2',
    'ES': '1',
    'ESSENCE': '1',
    'GPL': '3',
    'ELECTRIQUE': '4',
    'EH': '6',
    'HYBRIDE': '6'
  };

  return energyMap[energyType.toUpperCase()] || null;
}

function mapGearboxToLeBonCoin(transmission) {
  if (!transmission) return null;

  const gearboxMap = {
    'MANUELLE': '1',
    'AUTOMATIQUE': '2',
    'SEMI-AUTOMATIQUE': '2'
  };

  return gearboxMap[transmission.toUpperCase()] || null;
}

// Supprimer les outliers (valeurs aberrantes) d'un tableau de prix
// Utilise une approche basée sur la médiane et l'écart-type
function removeOutliers(prices) {
  if (prices.length < 3) {
    // Pas assez de données pour détecter les outliers
    return prices;
  }

  // Calculer la médiane
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Calculer la moyenne
  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  // Calculer l'écart-type
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  // Approche combinée : supprimer les prix qui sont :
  // 1. > médiane * 2 (trop élevé par rapport à la médiane)
  // 2. < médiane * 0.4 (trop bas par rapport à la médiane)
  // 3. > moyenne + 2.5 * écart-type (statistiquement aberrant)
  const upperMedianLimit = median * 2;
  const lowerMedianLimit = median * 0.4;
  const upperStdDevLimit = mean + 2.5 * stdDev;

  const filtered = prices.filter(price => {
    if (price > upperMedianLimit) {
      console.log(`  Removing outlier ${price}€ (> ${upperMedianLimit.toFixed(0)}€, 2x median)`);
      return false;
    }
    if (price < lowerMedianLimit) {
      console.log(`  Removing outlier ${price}€ (< ${lowerMedianLimit.toFixed(0)}€, 0.4x median)`);
      return false;
    }
    if (price > upperStdDevLimit) {
      console.log(`  Removing outlier ${price}€ (> ${upperStdDevLimit.toFixed(0)}€, mean+2.5σ)`);
      return false;
    }
    return true;
  });

  console.log(`Outlier detection: median=${median}€, mean=${mean.toFixed(0)}€, stdDev=${stdDev.toFixed(0)}€`);
  console.log(`Removed ${prices.length - filtered.length} outliers out of ${prices.length} prices`);

  if (filtered.length === 0) {
    // Si tous les prix sont des outliers, garder les prix originaux
    console.warn('All prices were outliers, keeping original prices');
    return prices;
  }

  return filtered;
}
