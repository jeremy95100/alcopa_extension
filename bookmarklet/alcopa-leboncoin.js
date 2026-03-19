javascript:(function(){
  /* Alcopa -> LeBonCoin Bookmarklet */

  // Vérifier qu'on est sur Alcopa
  if (!window.location.hostname.includes('alcopa-auction.fr')) {
    alert('Ce bookmarklet fonctionne uniquement sur alcopa-auction.fr');
    return;
  }

  // Extraire les données du véhicule
  function extractVehicleData() {
    const data = {};

    // Marque
    const brandEl = document.querySelector('[data-testid="brand"], .brand, h1');
    if (brandEl) {
      const text = brandEl.textContent.trim();
      const parts = text.split(' ');
      data.brand = parts[0];
    }

    // Chercher dans les caractéristiques
    const rows = document.querySelectorAll('tr, .characteristic, [class*="detail"], [class*="spec"]');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();

      // Année / Mise en circulation
      if (text.includes('circulation') || text.includes('année') || text.includes('1ère mis')) {
        const match = row.textContent.match(/(\d{4})/);
        if (match) data.year = parseInt(match[1]);
      }

      // Kilométrage
      if (text.includes('kilom') || text.includes('km')) {
        const match = row.textContent.replace(/\s/g, '').match(/(\d+)\s*km/i);
        if (match) data.mileage = parseInt(match[1]);
      }

      // Énergie
      if (text.includes('énergie') || text.includes('carburant') || text.includes('motorisation')) {
        if (text.includes('diesel') || text.includes('go')) data.energyType = 'diesel';
        else if (text.includes('essence') || text.includes('es')) data.energyType = 'essence';
        else if (text.includes('hybride')) data.energyType = 'hybride';
        else if (text.includes('électrique') || text.includes('elec')) data.energyType = 'electrique';
      }

      // Boîte de vitesse
      if (text.includes('boîte') || text.includes('transmission')) {
        if (text.includes('auto')) data.transmission = 'automatique';
        else if (text.includes('manuel')) data.transmission = 'manuelle';
      }

      // Modèle
      if (text.includes('modèle') || text.includes('version')) {
        const cells = row.querySelectorAll('td, span, div');
        if (cells.length >= 2) {
          data.model = cells[cells.length - 1].textContent.trim();
        }
      }
    });

    // Fallback: chercher dans tout le texte de la page
    if (!data.year) {
      const pageText = document.body.textContent;
      const yearMatch = pageText.match(/1[èe]re?\s*mis[e]?\s*en\s*circulation[:\s]*(\d{4})/i);
      if (yearMatch) data.year = parseInt(yearMatch[1]);
    }

    if (!data.mileage) {
      const pageText = document.body.textContent.replace(/\s/g, '');
      const kmMatch = pageText.match(/(\d{3,})km/i);
      if (kmMatch) data.mileage = parseInt(kmMatch[1]);
    }

    // Extraire marque depuis le titre H1
    const h1 = document.querySelector('h1');
    if (h1 && !data.brand) {
      const h1Text = h1.textContent.trim();
      const words = h1Text.split(/\s+/);
      if (words.length > 0) data.brand = words[0];
      if (words.length > 1) data.model = words[1];
    }

    return data;
  }

  // Mapper énergie vers code LeBonCoin
  function mapFuel(energy) {
    if (!energy) return null;
    const e = energy.toLowerCase();
    if (e.includes('diesel') || e === 'go') return '2';
    if (e.includes('essence') || e === 'es') return '1';
    if (e.includes('hybride')) return '3';
    if (e.includes('élec') || e.includes('elec')) return '4';
    return null;
  }

  // Mapper boîte vers code LeBonCoin
  function mapGearbox(trans) {
    if (!trans) return null;
    const t = trans.toLowerCase();
    if (t.includes('manuel')) return '1';
    if (t.includes('auto')) return '2';
    return null;
  }

  // Construire URL LeBonCoin
  function buildUrl(data, useStructured) {
    const params = new URLSearchParams();
    params.set('category', '2');

    if (useStructured && data.brand) {
      // URL structurée (onglet 3)
      params.set('u_car_brand', data.brand.toUpperCase());
      if (data.model) {
        const modelFirst = data.model.split(/\s+/)[0];
        const modelFormatted = modelFirst.charAt(0).toUpperCase() + modelFirst.slice(1).toLowerCase();
        params.set('u_car_model', data.brand.toUpperCase() + '_' + modelFormatted);
      }
    } else {
      // URL texte (onglet 1)
      let searchText = data.brand || '';
      if (data.model) searchText += ' ' + data.model;
      if (searchText) params.set('text', searchText.trim());
    }

    // Filtres communs
    if (data.year) {
      params.set('regdate', (data.year - 2) + '-' + (data.year + 2));
    }
    if (data.mileage) {
      const kmMin = Math.max(0, data.mileage - 20000);
      const kmMax = data.mileage + 20000;
      params.set('mileage', kmMin + '-' + kmMax);
    }

    const fuel = mapFuel(data.energyType);
    if (fuel) params.set('fuel', fuel);

    const gearbox = mapGearbox(data.transmission);
    if (gearbox) params.set('gearbox', gearbox);

    params.set('sort', 'price');
    params.set('order', 'asc');

    return 'https://www.leboncoin.fr/recherche?' + params.toString();
  }

  // Exécution
  const vehicleData = extractVehicleData();

  if (!vehicleData.brand) {
    alert('Impossible d\'extraire les données du véhicule. Êtes-vous sur une fiche véhicule ?');
    return;
  }

  // Afficher les données extraites
  const info = 'Données extraites:\\n' +
    '- Marque: ' + (vehicleData.brand || '?') + '\\n' +
    '- Modèle: ' + (vehicleData.model || '?') + '\\n' +
    '- Année: ' + (vehicleData.year || '?') + '\\n' +
    '- Km: ' + (vehicleData.mileage || '?') + '\\n' +
    '- Énergie: ' + (vehicleData.energyType || '?') + '\\n' +
    '- Boîte: ' + (vehicleData.transmission || '?');

  // Ouvrir les URLs
  const url1 = buildUrl(vehicleData, false);
  const url2 = buildUrl(vehicleData, true);

  window.open(url1, '_blank');

  setTimeout(function() {
    window.open(url2, '_blank');
  }, 500);

  alert('LeBonCoin ouvert !\\n\\n' + info);
})();
