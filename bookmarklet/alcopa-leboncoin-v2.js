javascript:(function(){
  /* Alcopa -> LeBonCoin Bookmarklet v2 */

  if (!window.location.hostname.includes('alcopa-auction.fr')) {
    alert('Ce bookmarklet fonctionne uniquement sur alcopa-auction.fr');
    return;
  }

  // Liste des marques connues
  var brands = ['RENAULT','PEUGEOT','CITROEN','VOLKSWAGEN','BMW','MERCEDES','AUDI','TOYOTA','NISSAN','FORD','OPEL','FIAT','SEAT','SKODA','HYUNDAI','KIA','MAZDA','HONDA','VOLVO','DACIA','ALFA ROMEO','JEEP','MINI','SMART','DS','MG','LAND ROVER','JAGUAR','PORSCHE','TESLA'];

  var data = {brand:null, model:null, finition:null, year:null, mileage:null, energyType:null, transmission:null};

  // 1. Extraire depuis le titre H1
  var h1 = document.querySelector('h1');
  if (h1) {
    var titleText = h1.textContent.trim().toUpperCase();
    for (var i = 0; i < brands.length; i++) {
      if (titleText.indexOf(brands[i]) !== -1) {
        data.brand = brands[i];
        var afterBrand = h1.textContent.trim().substring(titleText.indexOf(brands[i]) + brands[i].length).trim();
        var parts = afterBrand.split(/\s+/);
        if (parts.length > 0) data.model = parts[0];
        if (parts.length > 1) data.finition = parts.slice(1).join(' ');
        break;
      }
    }
  }

  // 2. Extraire depuis les tableaux de caractéristiques
  var rows = document.querySelectorAll('table tr');
  for (var j = 0; j < rows.length; j++) {
    var cells = rows[j].querySelectorAll('td, th');
    if (cells.length >= 2) {
      var label = cells[0].textContent.trim().toLowerCase();
      var value = cells[1].textContent.trim();

      if (label.indexOf('marque') !== -1 && !data.brand) {
        data.brand = value.toUpperCase();
      }
      if ((label.indexOf('modèle') !== -1 || label.indexOf('modele') !== -1) && !data.model) {
        data.model = value;
      }
      if (label.indexOf('finition') !== -1 && !data.finition) {
        data.finition = value;
      }
      if (label.indexOf('kilom') !== -1 || label.indexOf('km') !== -1) {
        var kmMatch = value.replace(/\s/g, '').match(/(\d+)/);
        if (kmMatch) data.mileage = parseInt(kmMatch[1]);
      }
      if (label.indexOf('mise en circulation') !== -1 || label.indexOf('1ère mis') !== -1) {
        var yearMatch = value.match(/(\d{4})/);
        if (yearMatch) data.year = parseInt(yearMatch[1]);
      }
      if (label.indexOf('énergie') !== -1 || label.indexOf('energie') !== -1 || label.indexOf('carburant') !== -1) {
        data.energyType = value;
      }
      if (label.indexOf('boîte') !== -1 || label.indexOf('boite') !== -1 || label.indexOf('transmission') !== -1) {
        data.transmission = value;
      }
    }
  }

  // 3. Fallback dans le texte de la page
  var pageText = document.body.textContent;
  if (!data.year) {
    var yMatch = pageText.match(/1[èe]re?\s*mis[e]?\s*en\s*circulation[:\s]*\d{2}\/\d{2}\/(\d{4})/i);
    if (yMatch) data.year = parseInt(yMatch[1]);
  }
  if (!data.mileage) {
    var kMatch = pageText.replace(/\s/g, '').match(/(\d{4,})km/i);
    if (kMatch) data.mileage = parseInt(kMatch[1]);
  }

  // Mapper énergie
  function mapFuel(e) {
    if (!e) return null;
    e = e.toUpperCase();
    if (e.indexOf('DIESEL') !== -1 || e === 'GO') return '2';
    if (e.indexOf('ESSENCE') !== -1 || e === 'ES') return '1';
    if (e.indexOf('HYBRIDE') !== -1 || e === 'EH') return '3';
    if (e.indexOf('ÉLEC') !== -1 || e.indexOf('ELEC') !== -1) return '4';
    return null;
  }

  // Mapper boîte
  function mapGearbox(t) {
    if (!t) return null;
    t = t.toUpperCase();
    if (t.indexOf('MANUEL') !== -1) return '1';
    if (t.indexOf('AUTO') !== -1) return '2';
    return null;
  }

  // Construire URL 1 (texte)
  function buildUrl1() {
    var p = new URLSearchParams();
    p.set('category', '2');
    var searchText = '';
    if (data.brand) searchText += data.brand;
    if (data.finition) searchText += ' ' + data.finition;
    else if (data.model) searchText += ' ' + data.model;
    if (searchText) p.set('text', searchText.trim());
    if (data.year) p.set('regdate', (data.year - 2) + '-' + (data.year + 2));
    if (data.mileage) p.set('mileage', Math.max(0, data.mileage - 20000) + '-' + (data.mileage + 20000));
    var fuel = mapFuel(data.energyType);
    if (fuel) p.set('fuel', fuel);
    var gb = mapGearbox(data.transmission);
    if (gb) p.set('gearbox', gb);
    p.set('sort', 'price');
    p.set('order', 'asc');
    return 'https://www.leboncoin.fr/recherche?' + p.toString();
  }

  // Construire URL 3 (marque + modèle structuré)
  function buildUrl3() {
    var p = new URLSearchParams();
    p.set('category', '2');
    if (data.brand) {
      p.set('u_car_brand', data.brand.toUpperCase());
      if (data.model) {
        var modelFirst = data.model.split(/\s+/)[0];
        var modelFormatted = modelFirst.charAt(0).toUpperCase() + modelFirst.slice(1).toLowerCase();
        p.set('u_car_model', data.brand.toUpperCase() + '_' + modelFormatted);
      }
    }
    if (data.year) p.set('regdate', (data.year - 2) + '-' + (data.year + 2));
    if (data.mileage) p.set('mileage', Math.max(0, data.mileage - 20000) + '-' + (data.mileage + 20000));
    var fuel = mapFuel(data.energyType);
    if (fuel) p.set('fuel', fuel);
    var gb = mapGearbox(data.transmission);
    if (gb) p.set('gearbox', gb);
    p.set('sort', 'price');
    p.set('order', 'asc');
    return 'https://www.leboncoin.fr/recherche?' + p.toString();
  }

  // Afficher les données extraites
  var info = 'Données extraites :\n' +
    '• Marque: ' + (data.brand || '?') + '\n' +
    '• Modèle: ' + (data.model || '?') + '\n' +
    '• Finition: ' + (data.finition || '?') + '\n' +
    '• Année: ' + (data.year || '?') + '\n' +
    '• Km: ' + (data.mileage || '?') + '\n' +
    '• Énergie: ' + (data.energyType || '?') + '\n' +
    '• Boîte: ' + (data.transmission || '?');

  if (!data.brand) {
    alert('Impossible d\'extraire la marque.\n\nÊtes-vous sur une fiche véhicule ?');
    return;
  }

  // Ouvrir les 2 URLs
  window.open(buildUrl1(), '_blank');
  setTimeout(function() {
    window.open(buildUrl3(), '_blank');
  }, 400);

  alert('LeBonCoin ouvert !\n\n' + info);
})();
