// Configuration constants for Alcopa Price Comparison Extension

// Base URLs
const ALCOPA_BASE_URL = 'https://www.alcopa-auction.fr';
const LEBONCOIN_BASE_URL = 'https://www.leboncoin.fr';
const LACENTRALE_BASE_URL = 'https://www.lacentrale.fr';

// Matching tolerances (configurable via popup)
const DEFAULT_MILEAGE_TOLERANCE = 20000; // km
const DEFAULT_YEAR_TOLERANCE = 1; // years
const DEFAULT_RESULTS_COUNT = 5;

// Caching
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 5 * 1024 * 1024; // 5 MB

// Rate limiting
const REQUEST_DELAY_MIN = 500; // ms
const REQUEST_DELAY_MAX = 2000; // ms
const MAX_CONCURRENT_REQUESTS = 2;

// Scoring thresholds
const MIN_MATCH_SCORE = 60;
const WEIGHTS = {
  BRAND_MODEL: 40,
  YEAR: 30,
  MILEAGE: 20,
  ENERGY_TYPE: 10
};

// Energy type mappings
const ENERGY_TYPES = {
  ESSENCE: ['essence', 'ess', 'gasoline', 'petrol', 'e'],
  DIESEL: ['diesel', 'gasoil', 'd'],
  ELECTRIQUE: ['électrique', 'electrique', 'electric', 'elec'],
  HYBRIDE: ['hybride', 'hybrid', 'eh', 'h'],
  GPL: ['gpl', 'lpg', 'g'],
  AUTRE: ['autre', 'other']
};

// UI settings
const MODAL_Z_INDEX = 999999;
const ICON_SIZE = 32; // px
const LOADING_SPINNER_SIZE = 64; // px

// Error retry
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // ms, exponential backoff

// Profit margin thresholds for recommendations
const PROFIT_THRESHOLDS = {
  EXCELLENT: 20, // 20% or more
  GOOD: 10,      // 10-20%
  FAIR: 5,       // 5-10%
  LOW: 0         // 0-5%
  // Below 0% = above market price
};
