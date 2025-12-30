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
