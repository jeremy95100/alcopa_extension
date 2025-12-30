// Popup script

document.addEventListener('DOMContentLoaded', loadSettings);

// Load saved settings
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get([
      'mileageTolerance',
      'yearTolerance',
      'resultsCount',
      'comparisonCount'
    ]);

    // Set select values
    if (settings.mileageTolerance) {
      document.getElementById('mileageTolerance').value = settings.mileageTolerance;
    }
    if (settings.yearTolerance) {
      document.getElementById('yearTolerance').value = settings.yearTolerance;
    }
    if (settings.resultsCount) {
      document.getElementById('resultsCount').value = settings.resultsCount;
    }

    // Set stats
    document.getElementById('comparisonCount').textContent = settings.comparisonCount || 0;

    // Calculate cache size
    const allData = await chrome.storage.local.get(null);
    const sizeBytes = JSON.stringify(allData).length;
    const sizeKB = (sizeBytes / 1024).toFixed(2);
    document.getElementById('cacheSize').textContent = `${sizeKB} KB`;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings button
document.getElementById('saveSettings').addEventListener('click', async () => {
  const settings = {
    mileageTolerance: parseInt(document.getElementById('mileageTolerance').value),
    yearTolerance: parseInt(document.getElementById('yearTolerance').value),
    resultsCount: parseInt(document.getElementById('resultsCount').value)
  };

  try {
    await chrome.storage.local.set(settings);

    // Visual feedback
    const btn = document.getElementById('saveSettings');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>✓</span> Sauvegardé';
    btn.style.background = '#4caf50';

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
    }, 2000);
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Erreur lors de la sauvegarde');
  }
});

// Clear cache button
document.getElementById('clearCache').addEventListener('click', async () => {
  if (confirm('Voulez-vous vraiment vider le cache ? Cela supprimera toutes les comparaisons enregistrées.')) {
    try {
      // Get current settings to preserve them
      const settings = await chrome.storage.local.get([
        'mileageTolerance',
        'yearTolerance',
        'resultsCount',
        'comparisonCount'
      ]);

      // Clear all storage
      await chrome.storage.local.clear();

      // Restore settings
      await chrome.storage.local.set(settings);

      // Update cache size display
      document.getElementById('cacheSize').textContent = '0 KB';

      // Visual feedback
      const btn = document.getElementById('clearCache');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>✓</span> Cache vidé';

      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 2000);
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Erreur lors du vidage du cache');
    }
  }
});
