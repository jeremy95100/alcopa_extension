// Alcopa Content Script - Extracts vehicle data and injects comparison icons

console.log('Alcopa Price Comparison extension loaded');

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

function initialize() {
  console.log('Initializing Alcopa Price Comparison...');

  // Detect page type
  const isDetailPage = window.location.pathname.includes('/voiture-occasion/') &&
                       !window.location.pathname.endsWith('/voiture-occasion');
  const isListPage = window.location.pathname.includes('/salle-de-vente-encheres/');

  console.log(`Page type - Detail: ${isDetailPage}, List: ${isListPage}`);

  if (isDetailPage) {
    // Single vehicle detail page
    processDetailPage();
  } else if (isListPage) {
    // Multiple vehicles list page
    processVehicles();
    // Watch for dynamically loaded vehicles
    observePageChanges();
  } else {
    console.log('Unknown page type, trying to process vehicles...');
    processVehicles();
    observePageChanges();
  }
}

function processDetailPage() {
  console.log('Processing detail page...');

  // Check if icons already injected
  if (document.querySelector('.alcopa-comparison-icons')) {
    console.log('Icons already injected');
    return;
  }

  try {
    // Extract vehicle data from the detail page
    const vehicleData = extractDetailPageData();

    console.log('Extracted vehicle data:', vehicleData);

    if (vehicleData && vehicleData.brand && vehicleData.model) {
      // Create comparison icons
      const iconsContainer = createComparisonIcons(vehicleData, document.body);

      // Find a good place to inject icons (near the price or title)
      const priceElement = document.querySelector('.btn-primary, [class*="prix"], h1');
      if (priceElement) {
        const targetContainer = priceElement.parentElement || document.querySelector('.container');
        if (targetContainer) {
          // Create a wrapper with better positioning
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 10000;';
          wrapper.appendChild(iconsContainer);
          document.body.appendChild(wrapper);

          console.log(`Injected icons for: ${vehicleData.brand} ${vehicleData.model}`);
        }
      }
    } else {
      console.warn('Incomplete vehicle data:', vehicleData);
    }
  } catch (error) {
    console.error('Error processing detail page:', error);
  }
}

function processVehicles() {
  // Find all vehicle cards on the page
  const vehicleCards = findVehicleCards();

  console.log(`Found ${vehicleCards.length} vehicle cards`);

  vehicleCards.forEach((card, index) => {
    // Check if icons already injected
    if (card.querySelector('.alcopa-comparison-icons')) {
      return;
    }

    try {
      // Extract vehicle data from the card
      const vehicleData = extractVehicleData(card);

      if (vehicleData && vehicleData.brand && vehicleData.model) {
        // Create and inject comparison icons
        const iconsContainer = createComparisonIcons(vehicleData, card);
        injectIcons(card, iconsContainer);

        console.log(`Injected icons for: ${vehicleData.brand} ${vehicleData.model}`);
      } else {
        console.warn('Incomplete vehicle data for card', index, vehicleData);
      }
    } catch (error) {
      console.error('Error processing vehicle card', index, error);
    }
  });
}

function findVehicleCards() {
  // Try multiple selectors to find vehicle cards
  // These will need to be adjusted based on actual Alcopa DOM structure

  let cards = [];

  // Try common selectors for vehicle listings
  const selectors = [
    'article[class*="vehicle"]',
    'div[class*="vehicle-card"]',
    'div[class*="lot"]',
    'a[href*="/voiture-occasion/"]',
    '[data-vehicle]',
    '.vehicle-item',
    '.lot-item'
  ];

  for (const selector of selectors) {
    cards = document.querySelectorAll(selector);
    if (cards.length > 0) {
      console.log(`Found vehicle cards using selector: ${selector}`);
      break;
    }
  }

  return Array.from(cards);
}

function extractDetailPageData() {
  const data = {
    brand: null,
    model: null,
    finition: null,
    registration: null,
    energyType: null,
    mileage: null,
    vin: null,
    transmission: null,
    price: null,
    year: null,
    co2: null,
    engineSize: null,
    type: null,        // Type de véhicule (UTILITAIRES, etc.)
    carrosserie: null, // Carrosserie (CTTE, etc.)
    alcopa_url: window.location.href
  };

  // Extract from title (e.g., "CITROEN JUMPER FOURGON")
  const titleElement = document.querySelector('h1, .vehicle-title, [class*="titre"]');
  if (titleElement) {
    const titleText = titleElement.textContent.trim();
    const brandModelMatch = parseBrandModel(titleText);
    if (brandModelMatch) {
      data.brand = brandModelMatch.brand;
      data.model = brandModelMatch.model;
      data.finition = brandModelMatch.finition;
    }
  }

  // Extract from characteristics table
  const tableRows = document.querySelectorAll('table tr, .table tr');
  tableRows.forEach(row => {
    const cells = row.querySelectorAll('td, th');
    if (cells.length >= 2) {
      const label = cells[0].textContent.trim().toLowerCase();
      const value = cells[1].textContent.trim();

      if (label.includes('marque')) {
        data.brand = value;
      } else if (label.includes('modèle') || label.includes('modele')) {
        data.model = value;
      } else if (label.includes('finition')) {
        data.finition = value;
      } else if (label.includes('kilométrage') || label.includes('kilometrage')) {
        const km = value.replace(/\s/g, '').match(/(\d+)/);
        if (km) data.mileage = parseInt(km[1]);
      } else if (label.includes('mise en circulation')) {
        const dateMatch = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (dateMatch) {
          data.year = parseInt(dateMatch[3]);
          data.registration = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        }
      } else if (label.includes('énergie') || label.includes('energie')) {
        data.energyType = value;
      } else if (label.includes('numéro de série') || label.includes('immatriculation')) {
        data.vin = value;
      } else if (label.includes('boite de vitesse') || label.includes('boîte de vitesse')) {
        data.transmission = value;
      } else if (label === 'type') {
        data.type = value;
      } else if (label.includes('carrosserie')) {
        data.carrosserie = value;
      } else if (label.includes('cylindrée') || label.includes('cylindree')) {
        data.engineSize = value;
      } else if (label.includes('co2')) {
        data.co2 = value;
      }
    }
  });

  // Extract price - try multiple methods
  // Method 1: Look for "Mise à prix : X €" or "Enchère courante : X €" text pattern in page
  const pageText = document.body.textContent;

  // Try "Enchère courante" first (live auction)
  let priceTextMatch = pageText.match(/Enchère\s+courante\s*:\s*([\d\s]+)\s*€/i);
  if (priceTextMatch) {
    const priceNum = priceTextMatch[1].replace(/\s/g, '');
    data.price = parseInt(priceNum);
    console.log('Extracted price from "Enchère courante":', data.price);
  }

  // Try "Mise à prix" (starting bid)
  if (!data.price) {
    priceTextMatch = pageText.match(/Mise\s+à\s+prix\s*:\s*([\d\s]+)\s*€/i);
    if (priceTextMatch) {
      const priceNum = priceTextMatch[1].replace(/\s/g, '');
      data.price = parseInt(priceNum);
      console.log('Extracted price from "Mise à prix":', data.price);
    }
  }

  // Method 2: Try input fields near "Mise à prix"
  if (!data.price) {
    const priceInputs = document.querySelectorAll('input[type="text"]');
    priceInputs.forEach(input => {
      const parent = input.parentElement;
      if (parent && parent.textContent.includes('Mise à prix')) {
        const value = input.value || input.placeholder;
        if (value) {
          const priceMatch = value.replace(/\s/g, '').match(/(\d+)/);
          if (priceMatch) {
            data.price = parseInt(priceMatch[1]);
            console.log('Extracted price from input:', data.price);
          }
        }
      }
    });
  }

  // Method 3: Look in table rows
  if (!data.price) {
    const tableRows = document.querySelectorAll('table tr, .table tr');
    tableRows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        const label = cells[0].textContent.trim().toLowerCase();
        const value = cells[1].textContent.trim();
        if (label.includes('mise à prix') || label.includes('prix')) {
          const priceMatch = value.replace(/\s/g, '').match(/(\d+)/);
          if (priceMatch) {
            data.price = parseInt(priceMatch[1]);
            console.log('Extracted price from table:', data.price);
          }
        }
      }
    });
  }

  // Fallback: search remaining data in page text (pageText already defined above)
  if (!data.mileage) {
    const kmMatch = pageText.match(/(\d+\s*\d+)\s*KM/i);
    if (kmMatch) {
      data.mileage = parseInt(kmMatch[1].replace(/\s/g, ''));
    }
  }

  if (!data.energyType) {
    const energyMatch = pageText.match(/Énergie\s*:\s*(\w+)/i);
    if (energyMatch) {
      data.energyType = energyMatch[1];
    }
  }

  return data;
}

function extractVehicleData(cardElement) {
  const data = {
    brand: null,
    model: null,
    finition: null,
    registration: null,
    energyType: null,
    mileage: null,
    vin: null,
    transmission: null,
    price: null,
    year: null,
    co2: null,
    engineSize: null,
    alcopa_url: window.location.href
  };

  // Extract text content from the card
  const textContent = cardElement.textContent || '';

  // Try to extract price
  data.price = extractPrice(cardElement);

  // Try to extract brand and model from title/heading
  const titleElement = cardElement.querySelector('h2, h3, h4, .title, [class*="title"]');
  if (titleElement) {
    const titleText = titleElement.textContent.trim();
    const brandModelMatch = parseBrandModel(titleText);
    if (brandModelMatch) {
      data.brand = brandModelMatch.brand;
      data.model = brandModelMatch.model;
      data.finition = brandModelMatch.finition;
    }
  }

  // Try to extract mileage
  const mileageMatch = textContent.match(/([\d\s]+)\s*km/i);
  if (mileageMatch) {
    data.mileage = parseInt(mileageMatch[1].replace(/\s/g, ''));
  }

  // Try to extract year from registration date
  const yearMatch = textContent.match(/(?:1ère mise|mise en circulation).*?(\d{4})/i) ||
                    textContent.match(/(\d{4})/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year >= 1900 && year <= new Date().getFullYear() + 1) {
      data.year = year;
      data.registration = `${year}-01-01`;
    }
  }

  // Try to extract energy type
  const energyMatch = textContent.match(/\b(Diesel|Essence|Électrique|Hybride|GPL|EH|E)\b/i);
  if (energyMatch) {
    data.energyType = energyMatch[1];
  }

  // Try to extract transmission
  if (textContent.match(/automatique/i)) {
    data.transmission = 'AUTOMATIQUE';
  } else if (textContent.match(/manuelle/i)) {
    data.transmission = 'MANUELLE';
  }

  // Try to get link to detail page
  const detailLink = cardElement.querySelector('a[href*="/voiture-occasion/"]');
  if (detailLink) {
    data.alcopa_url = detailLink.href;
  }

  return data;
}

function extractPrice(element) {
  // Try to find price element
  const priceElement = element.querySelector('[class*="price"], .prix, [class*="montant"]');

  if (priceElement) {
    const priceText = priceElement.textContent;
    const priceMatch = priceText.match(/([\d\s]+)/);
    if (priceMatch) {
      return parseInt(priceMatch[1].replace(/\s/g, ''));
    }
  }

  // Fallback: search in all text
  const textContent = element.textContent;
  const priceMatches = textContent.match(/(\d+\s*\d*)\s*€/g);
  if (priceMatches && priceMatches.length > 0) {
    // Take the largest number (likely the main price)
    const prices = priceMatches.map(p => parseInt(p.replace(/\s/g, '').replace('€', '')));
    return Math.max(...prices);
  }

  return null;
}

function parseBrandModel(titleText) {
  // Common car brands
  const brands = [
    'RENAULT', 'PEUGEOT', 'CITROEN', 'VOLKSWAGEN', 'BMW', 'MERCEDES', 'AUDI',
    'TOYOTA', 'NISSAN', 'FORD', 'OPEL', 'FIAT', 'SEAT', 'SKODA', 'HYUNDAI',
    'KIA', 'MAZDA', 'HONDA', 'VOLVO', 'LAND ROVER', 'JAGUAR', 'PORSCHE',
    'TESLA', 'DACIA', 'ALFA ROMEO', 'JEEP', 'MINI', 'SMART', 'DS', 'MG'
  ];

  const upperTitle = titleText.toUpperCase();

  for (const brand of brands) {
    if (upperTitle.includes(brand)) {
      // Found brand, extract model
      const afterBrand = titleText.substring(upperTitle.indexOf(brand) + brand.length).trim();

      // Model is typically the first word(s) after brand
      const modelMatch = afterBrand.match(/^([\w\d-]+(?:\s+[\w\d-]+)?)/);

      if (modelMatch) {
        const model = modelMatch[1].trim();
        const finition = afterBrand.substring(model.length).trim();

        return {
          brand: brand,
          model: model,
          finition: finition || null
        };
      }
    }
  }

  return null;
}

function injectIcons(cardElement, iconsContainer) {
  // Make the card position relative if needed
  const position = window.getComputedStyle(cardElement).position;
  if (position === 'static') {
    cardElement.style.position = 'relative';
  }

  // Insert icons container
  cardElement.appendChild(iconsContainer);
}

function observePageChanges() {
  // Watch for new vehicle cards being added (pagination, infinite scroll)
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
    }

    if (shouldProcess) {
      // Debounce to avoid processing too frequently
      clearTimeout(observePageChanges.timeout);
      observePageChanges.timeout = setTimeout(() => {
        processVehicles();
      }, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('Observing page for new vehicle cards...');
}
