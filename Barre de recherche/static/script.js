/**
 * SpotMyArtist - Client-side artist filtering
 * Pure vanilla JS with no external dependencies
 */

(function () {
  // ===== CONSTANTS =====
  const DEBOUNCE_DELAY = 300;

  const ARTIST_DATABASE = {
    'pnl': { year: 2015, members: 2, genre: 'Hip-hop français' },
    'tyler, the creator': { year: 2007, members: 1, genre: 'Hip-hop alternatif' },
    'billie eilish': { year: 2015, members: 1, genre: 'Pop alternative' },
    'beabadoobee': { year: 2013, members: 1, genre: 'Indie rock' }
  };

  // ===== UTILITY FUNCTIONS =====

  /**
   * Debounce function to limit function calls
   */
  function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  /**
   * Get artist key from card text
   */
  function getArtistKey(cardText) {
    const lowerText = cardText.toLowerCase();
    for (const key in ARTIST_DATABASE) {
      if (lowerText.includes(key)) return key;
    }
    return null;
  }

  /**
   * Check if artist matches all filters
   */
  function matchesFilters(cardText, query, year, members, genre) {
    const lowerText = cardText.toLowerCase();
    const key = getArtistKey(lowerText);
    const artistData = key ? ARTIST_DATABASE[key] : null;

    // Name filter
    if (query && !lowerText.includes(query)) return false;

    // Year filter
    if (year && artistData && artistData.year !== parseInt(year, 10)) return false;

    // Members filter
    if (members && artistData && artistData.members !== parseInt(members, 10)) return false;

    // Genre filter
    if (genre && artistData && !artistData.genre.toLowerCase().includes(genre)) return false;

    return true;
  }

  /**
   * Apply filters to all artist cards
   */
  function filterArtistCards() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const year = document.getElementById('filter-creation-date')?.value;
    const members = document.getElementById('filter-members')?.value;
    const genre = (document.getElementById('filter-genre')?.value || '').toLowerCase();

    const cards = document.querySelectorAll('#artist-playlist-container .artist-info-card');
    cards.forEach(card => {
      const isVisible = matchesFilters(card.textContent, query, year, members, genre);
      card.style.display = isVisible ? '' : 'none';
    });
  }

  // ===== DOM ELEMENTS =====
  const searchInput = document.getElementById('search-input');
  const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
  const searchContainer = document.getElementById('search-container');
  const advancedFilters = document.getElementById('advanced-filters');

  // ===== EVENT LISTENERS =====

  // Search input: debounced filtering
  if (searchInput) {
    const debouncedFilter = debounce(filterArtistCards, DEBOUNCE_DELAY);
    searchInput.addEventListener('input', debouncedFilter);
  }

  // Toggle filters visibility and container expansion
  if (toggleFiltersBtn && advancedFilters) {
    toggleFiltersBtn.addEventListener('click', () => {
      advancedFilters.classList.toggle('hidden');
      searchContainer.classList.toggle('expanded');
    });
  }

  // Filter inputs: instant filtering on change, debounced on input
  const filterInputIds = ['filter-creation-date', 'filter-members', 'filter-genre'];
  filterInputIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', filterArtistCards);
      element.addEventListener('input', debounce(filterArtistCards, DEBOUNCE_DELAY));
    }
  });
})();
