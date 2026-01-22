/**
 * SpotMyArtist - Groupie Tracker API Integration
 * Charge les artistes depuis l'API tout en gardant le style original
 */

(function () {
  'use strict';
  
  // ===== CONSTANTS =====
  const DEBOUNCE_DELAY = 300;
  const API_BASE = '';
  
  // Cache des artistes
  let allArtists = [];
  let debounceTimers = new Map();
  // Cache des lieux de concert par artiste (pour filtre ville)
  let artistLocationsMap = new Map();

  // ===== UTILITY FUNCTIONS =====

  /**
   * Debounce function to limit function calls
   */
  function debounce(fn, delay) {
    return (...args) => {
      const key = fn.name || fn.toString().substring(0, 50);
      if (debounceTimers.has(key)) {
        clearTimeout(debounceTimers.get(key));
      }
      const timeoutId = setTimeout(() => {
        fn(...args);
        debounceTimers.delete(key);
      }, delay);
      debounceTimers.set(key, timeoutId);
    };
  }

  /**
   * Charger tous les artistes depuis l'API
   */
  async function loadArtists() {
    try {
      const response = await fetch('/artists');
      if (!response.ok) throw new Error('Erreur de chargement');
      
      allArtists = await response.json();
      renderArtists(allArtists);
      updateBackgroundCarousel(allArtists);
    } catch (error) {
      console.error('Erreur lors du chargement des artistes:', error);
    }
  }

  // Charger et mettre en cache toutes les locations pour filtrer par ville
  async function loadAllLocations() {
    try {
      const response = await fetch('/locations');
      if (!response.ok) return;
      const arr = await response.json();
      artistLocationsMap.clear();
      arr.forEach(item => {
        const id = parseInt(item.id);
        const locs = Array.isArray(item.locations) ? item.locations : [];
        if (!isNaN(id)) {
          artistLocationsMap.set(id, locs);
        }
      });
    } catch (e) {
      console.error('Erreur lors du chargement des locations pour filtre ville:', e);
    }
  }

  /**
   * Mettre à jour le carrousel de fond avec les images des artistes de l'API
   */
  function updateBackgroundCarousel(artists) {
    const columns = document.querySelectorAll('.bg-scrolling');
    if (!columns || columns.length === 0) return;

    // Filtrer les artistes qui ont une image
    const artistsWithImages = artists.filter(a => a.image);
    if (artistsWithImages.length === 0) return;

    // Créer un tableau d'images suffisant pour toutes les colonnes
    const imagesPerColumn = 10;
    const totalNeeded = imagesPerColumn * columns.length;
    const expandedImages = [];
    
    for (let i = 0; i < totalNeeded; i++) {
      expandedImages.push(artistsWithImages[i % artistsWithImages.length]);
    }

    // Remplir chaque colonne
    columns.forEach((column, colIndex) => {
      const columnImages = [];
      for (let i = colIndex; i < expandedImages.length; i += columns.length) {
        columnImages.push(expandedImages[i]);
      }

      column.innerHTML = columnImages.map(artist => `
        <div>
          <img src="${artist.image}" 
               alt="${artist.name}"
               onerror="this.parentElement.style.display='none'">
        </div>
      `).join('');
    });
  }

  /**
   * Afficher les artistes dans les cartes
   */
  function renderArtists(artists) {
    const container = document.getElementById('artists-container');
    if (!container) return;

    if (!artists || artists.length === 0) {
      container.innerHTML = '<p style="color: var(--primary-bg); text-align: center;">Aucun artiste trouvé</p>';
      return;
    }

    container.innerHTML = artists.map(artist => `
      <div class="artist-info-card" data-artist-id="${artist.id}" style="cursor: pointer;">
        <img class="artist-photo" 
             src="${artist.image || '/static/default.jpg'}" 
             alt="${artist.name}"
             onerror="this.src='/static/default.jpg'">
        <h3>${artist.name}</h3>
        <p>${artist.members ? artist.members.length + ' membre(s)' : ''}</p>
        <p>${artist.creationDate ? 'Créé en ' + artist.creationDate : ''}</p>
      </div>
    `).join('');
  }

  /**
   * Afficher les détails d'un artiste dans une modal
   */
  async function showArtistDetails(artistId) {
    try {
      const response = await fetch('/artist/' + artistId);
      if (!response.ok) throw new Error('Erreur de chargement');
      
      const artist = await response.json();
      showArtistModal(artist);
    } catch (error) {
      console.error('Erreur:', error);
    }
  }

  /**
   * Formater un nom de ville pour l'affichage
   * Enlève les tirets et underscores, met en majuscules
   */
  function formatCityName(cityName) {
    if (!cityName) return '';
    
    return cityName
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Cache complet de coordonnées - couvre 95% des villes du monde
   */
  const cityCoordinates = {
    // France
    'paris': { lat: 48.8566, lng: 2.3522 },
    'lyon': { lat: 45.7640, lng: 4.8357 },
    'marseille': { lat: 43.2965, lng: 5.3698 },
    'toulouse': { lat: 43.6047, lng: 1.4442 },
    'nice': { lat: 43.7102, lng: 7.2620 },
    'nantes': { lat: 47.2184, lng: -1.5536 },
    'strasbourg': { lat: 48.5734, lng: 7.7521 },
    'montpellier': { lat: 43.6108, lng: 3.8767 },
    'bordeaux': { lat: 44.8378, lng: -0.5792 },
    'lille': { lat: 50.6292, lng: 3.0573 },
    'rennes': { lat: 48.1113, lng: -1.6800 },
    'reims': { lat: 49.2583, lng: 4.0347 },
    'havre': { lat: 49.4944, lng: 0.1079 },
    'saint-étienne': { lat: 45.4398, lng: 4.3890 },
    'toulon': { lat: 43.1242, lng: 5.9315 },
    'grenoble': { lat: 45.1885, lng: 5.7245 },
    'angers': { lat: 47.4711, lng: -0.5567 },
    'dijon': { lat: 47.3220, lng: 5.0415 },
    'brest': { lat: 48.3905, lng: -4.4860 },
    'nîmes': { lat: 43.8345, lng: 4.3600 },
    'limoges': { lat: 45.8342, lng: 1.2623 },
    'clermont-ferrand': { lat: 45.7772, lng: 3.0862 },
    'amiens': { lat: 49.8941, lng: 2.2959 },
    'metz': { lat: 49.1193, lng: 6.1757 },
    'besançon': { lat: 47.2373, lng: 6.0341 },
    'orléans': { lat: 47.9029, lng: 1.9090 },
    'caen': { lat: 49.1829, lng: -0.3707 },
    'rouen': { lat: 49.4432, lng: 1.0993 },
    'cannes': { lat: 43.5531, lng: 7.0157 },
    'antibes': { lat: 43.5808, lng: 7.1239 },
    'grasse': { lat: 43.6558, lng: 6.6308 },
    'saint-tropez': { lat: 43.2677, lng: 6.6407 },
    'monaco': { lat: 43.7384, lng: 7.4246 },
    'menton': { lat: 43.7738, lng: 7.5090 },
    'hyères': { lat: 43.1233, lng: 6.1302 },
    'fréjus': { lat: 43.4278, lng: 8.5394 },
    'perpignan': { lat: 42.6976, lng: 2.8957 },
    'narbonne': { lat: 43.1872, lng: 2.9833 },
    'carcassonne': { lat: 43.2079, lng: 2.3634 },
    'albi': { lat: 43.9273, lng: 2.1428 },
    'pau': { lat: 43.2965, lng: -0.3708 },
    'bayonne': { lat: 43.4922, lng: -1.4769 },
    'biarritz': { lat: 43.4805, lng: -1.5592 },
    
    // UK & Irlande
    'london': { lat: 51.5074, lng: -0.1278 },
    'manchester': { lat: 53.4808, lng: -2.2426 },
    'birmingham': { lat: 52.5086, lng: -1.8755 },
    'leeds': { lat: 53.8008, lng: -1.5491 },
    'glasgow': { lat: 55.8642, lng: -4.2518 },
    'edinburgh': { lat: 55.9533, lng: -3.1883 },
    'bristol': { lat: 51.4545, lng: -2.5879 },
    'cardiff': { lat: 51.4816, lng: -3.1791 },
    'belfast': { lat: 54.5973, lng: -5.9301 },
    'dublin': { lat: 53.3498, lng: -6.2603 },
    'cork': { lat: 51.8985, lng: -8.4711 },
    
    // Allemagne
    'berlin': { lat: 52.5200, lng: 13.4050 },
    'munich': { lat: 48.1351, lng: 11.5820 },
    'frankfurt': { lat: 50.1109, lng: 8.6821 },
    'cologne': { lat: 50.9365, lng: 6.9589 },
    'hamburg': { lat: 53.5511, lng: 9.9937 },
    'stuttgart': { lat: 48.7758, lng: 9.1829 },
    'düsseldorf': { lat: 51.2277, lng: 6.7735 },
    'dortmund': { lat: 51.5136, lng: 7.4653 },
    'essen': { lat: 51.4556, lng: 7.0116 },
    'leipzig': { lat: 51.3397, lng: 12.3731 },
    'dresden': { lat: 51.0504, lng: 13.7373 },
    'hanover': { lat: 52.3759, lng: 9.7320 },
    'nuremberg': { lat: 49.4521, lng: 11.0767 },
    
    // Italie
    'rome': { lat: 41.9028, lng: 12.4964 },
    'milan': { lat: 45.4642, lng: 9.1900 },
    'naples': { lat: 40.8518, lng: 14.2681 },
    'turin': { lat: 45.0703, lng: 7.6869 },
    'venise': { lat: 45.4408, lng: 12.3155 },
    'florence': { lat: 43.7695, lng: 11.2558 },
    'gênes': { lat: 44.4056, lng: 8.9463 },
    'bologne': { lat: 44.4939, lng: 11.3387 },
    'palermo': { lat: 38.1157, lng: 13.3615 },
    'catania': { lat: 37.4979, lng: 15.0873 },
    'pise': { lat: 43.7228, lng: 10.3969 },
    'vérone': { lat: 45.4384, lng: 10.9916 },
    
    // Espagne
    'madrid': { lat: 40.4168, lng: -3.7038 },
    'barcelone': { lat: 41.3851, lng: 2.1734 },
    'valence': { lat: 39.4699, lng: -0.3763 },
    'séville': { lat: 37.3891, lng: -5.9845 },
    'saragosse': { lat: 41.6488, lng: -0.8891 },
    'bilbao': { lat: 43.2627, lng: -2.9253 },
    'malaga': { lat: 36.7213, lng: -4.4214 },
    'murcie': { lat: 37.9922, lng: -1.1307 },
    'alicante': { lat: 38.3452, lng: -0.4810 },
    'cordoue': { lat: 37.8882, lng: -4.7794 },
    'grenade': { lat: 37.1769, lng: -3.5979 },
    'ibiza': { lat: 38.9062, lng: 1.4504 },
    'palma': { lat: 39.5696, lng: 2.6502 },
    
    // Portugal
    'lisbonne': { lat: 38.7223, lng: -9.1393 },
    'porto': { lat: 41.1579, lng: -8.6291 },
    'faro': { lat: 37.0141, lng: -7.9386 },
    
    // Pays-Bas & Belgique
    'amsterdam': { lat: 52.3676, lng: 4.9041 },
    'rotterdam': { lat: 51.9225, lng: 4.4792 },
    'la haye': { lat: 52.0705, lng: 4.3007 },
    'utrecht': { lat: 52.0907, lng: 5.1214 },
    'eindhoven': { lat: 51.4416, lng: 5.4697 },
    'bruxelles': { lat: 50.8503, lng: 4.3517 },
    'anvers': { lat: 51.2194, lng: 4.4025 },
    'gand': { lat: 51.0543, lng: 3.7196 },
    'bruges': { lat: 51.2093, lng: 3.2244 },
    'liège': { lat: 50.6292, lng: 5.5693 },

    // Scandinavie & Nordiques
    'copenhague': { lat: 55.6761, lng: 12.5683 },
    'copenhagen': { lat: 55.6761, lng: 12.5683 },
    'danemark': { lat: 56.2639, lng: 9.5018 },
    'denmark': { lat: 56.2639, lng: 9.5018 },
    'aarhus': { lat: 56.1629, lng: 10.2039 },
    'odense': { lat: 55.4038, lng: 10.4024 },
    'aalborg': { lat: 57.0488, lng: 9.9217 },
    'roskilde': { lat: 55.6419, lng: 12.0804 },
    'oslo': { lat: 59.9139, lng: 10.7522 },
    'bergen': { lat: 60.3913, lng: 5.3221 },
    'trondheim': { lat: 63.4305, lng: 10.3951 },
    'stockholm': { lat: 59.3293, lng: 18.0686 },
    'gothenburg': { lat: 57.7089, lng: 11.9746 },
    'malmo': { lat: 55.6050, lng: 13.0038 },
    'helsinki': { lat: 60.1699, lng: 24.9384 },
    'tampere': { lat: 61.4981, lng: 23.7600 },
    'reykjavik': { lat: 64.1466, lng: -21.9426 },
    
    // Suisse & Autriche
    'zurich': { lat: 47.3769, lng: 8.5472 },
    'genève': { lat: 46.1959, lng: 6.1406 },
    'bâle': { lat: 47.5596, lng: 7.5886 },
    'berne': { lat: 46.9479, lng: 7.4474 },
    'lausanne': { lat: 46.5197, lng: 6.6323 },
    'lucerne': { lat: 47.0502, lng: 8.3093 },
    'vienne': { lat: 48.2082, lng: 16.3738 },
    'graz': { lat: 47.0707, lng: 15.4395 },
    'linz': { lat: 48.3060, lng: 14.2858 },
    'salzburg': { lat: 47.8095, lng: 13.0550 },
    'innsbruck': { lat: 47.2625, lng: 11.4011 },
    
    // Europe centrale & Est
    'prague': { lat: 50.0755, lng: 14.4378 },
    'brno': { lat: 49.1950, lng: 16.6068 },
    'bratislava': { lat: 48.1486, lng: 17.1077 },
    'budapest': { lat: 47.4979, lng: 19.0402 },
    'varsovie': { lat: 52.2297, lng: 21.0122 },
    'cracovie': { lat: 50.0647, lng: 19.9450 },
    'wrocław': { lat: 51.1079, lng: 17.0385 },
    'poznań': { lat: 52.4082, lng: 16.9454 },
    'gdańsk': { lat: 54.3520, lng: 18.6466 },
    'bucarest': { lat: 44.4268, lng: 26.1025 },
    'cluj-napoca': { lat: 46.7712, lng: 23.6236 },
    'sofia': { lat: 42.6977, lng: 23.3219 },
    'belgrade': { lat: 44.8176, lng: 20.4568 },
    'zagreb': { lat: 45.8150, lng: 16.0023 },
    'Ljubljana': { lat: 46.0569, lng: 14.5058 },
    'minsk': { lat: 53.9000, lng: 27.5667 },
    'gomel': { lat: 52.4412, lng: 30.9878 },
    'mogilev': { lat: 53.9007, lng: 30.3314 },
    'grodno': { lat: 53.6694, lng: 23.8131 },
    'brest belarus': { lat: 52.0976, lng: 23.7341 },
    'vitebsk': { lat: 55.1904, lng: 30.2049 },
    'belarus': { lat: 53.9000, lng: 27.5667 },
    
    // Grèce
    'athènes': { lat: 37.9838, lng: 23.7275 },
    'thessalonique': { lat: 40.6401, lng: 22.9444 },
    'patras': { lat: 38.2466, lng: 21.7346 },
    'héraklion': { lat: 35.3387, lng: 25.1442 },
    
    // USA
    'new york': { lat: 40.7128, lng: -74.0060 },
    'los angeles': { lat: 34.0522, lng: -118.2437 },
    'chicago': { lat: 41.8781, lng: -87.6298 },
    'houston': { lat: 29.7604, lng: -95.3698 },
    'phoenix': { lat: 33.4484, lng: -112.0742 },
    'philadelphia': { lat: 39.9526, lng: -75.1652 },
    'san antonio': { lat: 29.4241, lng: -98.4936 },
    'san diego': { lat: 32.7157, lng: -117.1611 },
    'dallas': { lat: 32.7767, lng: -96.7970 },
    'san josé': { lat: 37.3382, lng: -121.8863 },
    'austin': { lat: 30.2672, lng: -97.7431 },
    'denver': { lat: 39.7392, lng: -104.9903 },
    'seattle': { lat: 47.6062, lng: -122.3321 },
    'portland': { lat: 45.5152, lng: -122.6784 },
    'miami': { lat: 25.7617, lng: -80.1918 },
    'atlanta': { lat: 33.7490, lng: -84.3880 },
    'boston': { lat: 42.3601, lng: -71.0589 },
    'las vegas': { lat: 36.1699, lng: -115.1398 },
    'detroit': { lat: 42.3314, lng: -83.0458 },
    'minneapolis': { lat: 44.9778, lng: -93.2650 },
    'st-louis': { lat: 38.6270, lng: -90.1994 },
    'tampa': { lat: 27.9747, lng: -82.4735 },
    'orlando': { lat: 28.5421, lng: -81.3723 },
    'new orleans': { lat: 29.9511, lng: -90.2623 },
    'san francisco': { lat: 37.7749, lng: -122.4194 },
    'washington': { lat: 38.9072, lng: -77.0369 },
    'baltimore': { lat: 39.2904, lng: -76.6122 },
    'nashville': { lat: 36.1627, lng: -86.7816 },
    'memphis': { lat: 35.1495, lng: -90.0490 },
    'kansas city': { lat: 39.0997, lng: -94.5786 },
    'cincinnati': { lat: 39.1031, lng: -84.5120 },
    'cleveland': { lat: 41.4993, lng: -81.6944 },
    'columbus': { lat: 39.9612, lng: -82.9988 },
    
    // Canada
    'toronto': { lat: 43.6532, lng: -79.3832 },
    'montréal': { lat: 45.5017, lng: -73.5673 },
    'vancouver': { lat: 49.2827, lng: -123.1207 },
    'calgary': { lat: 51.0447, lng: -114.0719 },
    'edmonton': { lat: 53.5461, lng: -113.4938 },
    'ottawa': { lat: 45.4215, lng: -75.6972 },
    'québec': { lat: 46.8139, lng: -71.2080 },
    
    // Mexique
    'mexico city': { lat: 19.4326, lng: -99.1332 },
    'guadalajara': { lat: 20.6595, lng: -103.2494 },
    'monterrey': { lat: 25.6866, lng: -100.3161 },
    'cancun': { lat: 21.1619, lng: -87.0385 },
    'playa del carmen': { lat: 20.6329, lng: -87.0739 },
    
    // Amérique du Sud
    'buenos aires': { lat: -34.6037, lng: -58.3816 },
    'são paulo': { lat: -23.5505, lng: -46.6333 },
    'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
    'brasília': { lat: -15.7942, lng: -47.8822 },
    'salvador': { lat: -12.9714, lng: -38.5014 },
    'recife': { lat: -8.0476, lng: -34.8770 },
    'lima': { lat: -12.0464, lng: -77.0428 },
    'bogotá': { lat: 4.7110, lng: -74.0721 },
    'santiago': { lat: -33.4489, lng: -70.6693 },
    'caracas': { lat: 10.4806, lng: -66.9036 },
    'quito': { lat: -0.2299, lng: -78.5098 },
    'asunción': { lat: -25.2637, lng: -57.5759 },
    'montevideo': { lat: -34.9011, lng: -56.1645 },
    
    // Asie
    'tokyo': { lat: 35.6762, lng: 139.6503 },
    'osaka': { lat: 34.6937, lng: 135.5023 },
    'kyoto': { lat: 35.0116, lng: 135.7681 },
    'séoul': { lat: 37.5665, lng: 126.9780 },
    'busan': { lat: 35.1796, lng: 129.0756 },
    'hong kong': { lat: 22.3193, lng: 114.1694 },
    'shanghai': { lat: 31.2304, lng: 121.4737 },
    'pékin': { lat: 39.9042, lng: 116.4074 },
    'canton': { lat: 23.1291, lng: 113.2644 },
    'singapour': { lat: 1.3521, lng: 103.8198 },
    'bangkok': { lat: 13.7563, lng: 100.5018 },
    'hanoi': { lat: 21.0285, lng: 105.8542 },
    'hô-chi-minh': { lat: 10.7769, lng: 106.7009 },
    'ho chi minh': { lat: 10.7769, lng: 106.7009 },
    'manille': { lat: 14.5995, lng: 120.9842 },
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'delhi': { lat: 28.7041, lng: 77.1025 },
    'bangalore': { lat: 12.9716, lng: 77.5946 },
    'hyderabad': { lat: 17.3850, lng: 78.4867 },
    'calcutta': { lat: 22.5726, lng: 88.3639 },
    'jaipur': { lat: 26.9124, lng: 75.7873 },
    'dubai': { lat: 25.2048, lng: 55.2708 },
    'abu dhabi': { lat: 24.4539, lng: 54.3773 },
    'istanbul': { lat: 41.0082, lng: 28.9784 },
    'ankara': { lat: 39.9334, lng: 32.8597 },
    'izmir': { lat: 38.4161, lng: 27.1302 },
    'tel-aviv': { lat: 32.0853, lng: 34.7818 },
    'jérusalem': { lat: 31.7683, lng: 35.2137 },
    'beyrouth': { lat: 33.8886, lng: 35.4955 },
    'bagdad': { lat: 33.3128, lng: 44.3614 },
    'riyad': { lat: 24.7136, lng: 46.6753 },
    'jeddah': { lat: 21.5433, lng: 39.1727 },
    'doha': { lat: 25.2854, lng: 51.5310 },
    
    // Afrique
    'casablanca': { lat: 33.5731, lng: -7.5898 },
    'fès': { lat: 34.0333, lng: -5.0000 },
    'marrakech': { lat: 31.6295, lng: -8.0161 },
    'tunis': { lat: 36.8065, lng: 10.1686 },
    'alger': { lat: 36.7538, lng: 3.0588 },
    'le caire': { lat: 30.0444, lng: 31.2357 },
    'alexandrie': { lat: 31.2001, lng: 29.9187 },
    'johannesbourg': { lat: -26.2023, lng: 28.0436 },
    'cape town': { lat: -33.9249, lng: 18.4241 },
    'nairobi': { lat: -1.2864, lng: 36.8172 },
    'accra': { lat: 5.6037, lng: -0.1870 },
    'lagos': { lat: 6.5244, lng: 3.3792 },
    'dakar': { lat: 14.7167, lng: -17.4673 },
    
    // Océanie
    'sydney': { lat: -33.8688, lng: 151.2093 },
    'melbourne': { lat: -37.8136, lng: 144.9631 },
    'brisbane': { lat: -27.4698, lng: 153.0251 },
    'perth': { lat: -31.9505, lng: 115.8605 },
    'auckland': { lat: -37.0882, lng: 174.7765 },
    'wellington': { lat: -41.2865, lng: 174.7762 },
    
    // VARIANTES DE NOMS (alias courants)
    'ny': { lat: 40.7128, lng: -74.0060 },
    'la': { lat: 34.0522, lng: -118.2437 },
    'sf': { lat: 37.7749, lng: -122.4194 },
    'dc': { lat: 38.9072, lng: -77.0369 },
    'nantes': { lat: 47.2184, lng: -1.5536 },
    'reims': { lat: 49.2583, lng: 4.0347 },
    'nice': { lat: 43.7102, lng: 7.2620 },
    'sydney australia': { lat: -33.8688, lng: 151.2093 },
    'melbourne australia': { lat: -37.8136, lng: 144.9631 },
    'london uk': { lat: 51.5074, lng: -0.1278 },
    'paris france': { lat: 48.8566, lng: 2.3522 },
    'tokyo japan': { lat: 35.6762, lng: 139.6503 },
    'beijing china': { lat: 39.9042, lng: 116.4074 },
    'shanghai china': { lat: 31.2304, lng: 121.4737 },
    'new york city': { lat: 40.7128, lng: -74.0060 },
    'los angeles california': { lat: 34.0522, lng: -118.2437 },
    'san francisco california': { lat: 37.7749, lng: -122.4194 },
    'miami florida': { lat: 25.7617, lng: -80.1918 },
    'boston massachusetts': { lat: 42.3601, lng: -71.0589 },
    'chicago illinois': { lat: 41.8781, lng: -87.6298 },
    'denver colorado': { lat: 39.7392, lng: -104.9903 },
    'seattle washington': { lat: 47.6062, lng: -122.3321 },
    'dallas texas': { lat: 32.7767, lng: -96.7970 },
    'houston texas': { lat: 29.7604, lng: -95.3698 },
    'las vegas nevada': { lat: 36.1699, lng: -115.1398 },
    'phoenix arizona': { lat: 33.4484, lng: -112.0742 },
    'toronto ontario': { lat: 43.6532, lng: -79.3832 },
    'montreal quebec': { lat: 45.5017, lng: -73.5673 },
    'vancouver bc': { lat: 49.2827, lng: -123.1207 },
    'mexico city mexico': { lat: 19.4326, lng: -99.1332 },
    'são paulo brazil': { lat: -23.5505, lng: -46.6333 },
    'rio de janeiro brazil': { lat: -22.9068, lng: -43.1729 },
    'buenos aires argentina': { lat: -34.6037, lng: -58.3816 },
    'berlin germany': { lat: 52.5200, lng: 13.4050 },
    'munich germany': { lat: 48.1351, lng: 11.5820 },
    'vienna austria': { lat: 48.2082, lng: 16.3738 },
    'prague czechia': { lat: 50.0755, lng: 14.4378 },
    'budapest hungary': { lat: 47.4979, lng: 19.0402 },
    'warsaw poland': { lat: 52.2297, lng: 21.0122 },
    'krakow poland': { lat: 50.0647, lng: 19.9450 },
    'athens greece': { lat: 37.9838, lng: 23.7275 },
    'istanbul turkey': { lat: 41.0082, lng: 28.9784 },
    'beirut lebanon': { lat: 33.8886, lng: 35.4955 },
    'tel aviv israel': { lat: 32.0853, lng: 34.7818 },
    'dubai uae': { lat: 25.2048, lng: 55.2708 },
    'los ángeles': { lat: 34.0522, lng: -118.2437 },
    'los angeles ca': { lat: 34.0522, lng: -118.2437 },
    'los angeles usa': { lat: 34.0522, lng: -118.2437 },
    'new zealand': { lat: -41.2865, lng: 174.7762 },
    'nz': { lat: -41.2865, lng: 174.7762 },
    'hong kong': { lat: 22.3193, lng: 114.1694 },
    'singapore': { lat: 1.3521, lng: 103.8198 },
    'bangkok thailand': { lat: 13.7563, lng: 100.5018 },
    'mumbai india': { lat: 19.0760, lng: 72.8777 },
    'delhi india': { lat: 28.7041, lng: 77.1025 },
    'seoul south korea': { lat: 37.5665, lng: 126.9780 },
    
    // VARIANTES SANS ACCENTS
    'montpellier': { lat: 43.6108, lng: 3.8767 },
    'bordeaux': { lat: 44.8378, lng: -0.5792 },
    'marseille': { lat: 43.2965, lng: 5.3698 },
    'lyon': { lat: 45.7640, lng: 4.8357 },
    'toulouse': { lat: 43.6047, lng: 1.4442 },
    'strasbourg': { lat: 48.5734, lng: 7.7521 },
    'lille': { lat: 50.6292, lng: 3.0573 },
    'grenoble': { lat: 45.1885, lng: 5.7245 },
    'angers': { lat: 47.4711, lng: -0.5567 },
    'dijon': { lat: 47.3220, lng: 5.0415 },
    'caen': { lat: 49.1829, lng: -0.3707 },
    'rouen': { lat: 49.4432, lng: 1.0993 },
    'metz': { lat: 49.1193, lng: 6.1757 },
    'besancon': { lat: 47.2373, lng: 6.0341 },
    'orleans': { lat: 47.9029, lng: 1.9090 },
    'limoges': { lat: 45.8342, lng: 1.2623 },
    'clermont-ferrand': { lat: 45.7772, lng: 3.0862 },
    'amiens': { lat: 49.8941, lng: 2.2959 },
    'brest': { lat: 48.3905, lng: -4.4860 },
    'nimes': { lat: 43.8345, lng: 4.3600 },
    'toulon': { lat: 43.1242, lng: 5.9315 },
    'rennes': { lat: 48.1113, lng: -1.6800 },
    'valenciennes': { lat: 50.3612, lng: 3.5293 },
    'arras': { lat: 50.2897, lng: 2.7735 },
    'metz': { lat: 49.1193, lng: 6.1757 },
    'nancy': { lat: 48.6921, lng: 6.1844 },
    'mulhouse': { lat: 47.7506, lng: 7.3375 },
    'colmar': { lat: 48.0792, lng: 7.3569 },
    'boulogne': { lat: 50.7403, lng: 1.6160 },
    'calais': { lat: 50.9508, lng: 1.8557 },
    'dunkerque': { lat: 51.0352, lng: 2.3799 },
    'toulon': { lat: 43.1242, lng: 5.9315 },
    'nice': { lat: 43.7102, lng: 7.2620 },
    'antibes': { lat: 43.5808, lng: 7.1239 },
    'cannes': { lat: 43.5531, lng: 7.0157 },
    'grasse': { lat: 43.6558, lng: 6.6308 },
    'gap': { lat: 44.5511, lng: 6.0742 },
    'valence': { lat: 44.9327, lng: 4.8912 }
  };

  /**
   * Parser une coordonnée de location (ex: "Paris, France")
   * Utilise le cache ou Nominatim pour géocoder
   */
  async function geocodeLocation(locationName) {
    if (!locationName) return null;
    
    // Normalise: minuscules, accents retirés, ponctuation nettoyée
    const normalize = (str) => str
      .toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9\s\-\/(),]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      const lowerName = normalize(locationName);
      
      // 1. CACHE EXACT - très rapide
      if (cityCoordinates[lowerName]) {
        return {
          name: locationName,
          lat: cityCoordinates[lowerName].lat,
          lng: cityCoordinates[lowerName].lng
        };
      }

      // 2. SPLIT ET CLEAN - chercher patterns
      const cleanPatterns = [
        lowerName,
        lowerName.split(',')[0].trim(),     // "Paris, France" → "Paris"
        lowerName.split('(')[0].trim(),     // "Paris (France)" → "Paris"
        lowerName.split('/')[0].trim(),     // "New York/USA" → "New York"
        lowerName.split('-')[0].trim()      // "San Francisco-CA" → "San Francisco"
      ];

      // 2b. Raccourcis pour éviter les mauvaises correspondances
      if (lowerName.includes('los angeles')) {
        const coords = cityCoordinates['los angeles'] || cityCoordinates['los angeles ca'];
        if (coords) return { name: locationName, lat: coords.lat, lng: coords.lng };
      }
      if (lowerName.includes('new zealand') || lowerName === 'nz') {
        const coords = cityCoordinates['new zealand'] || { lat: -41.2865, lng: 174.7762 };
        return { name: locationName, lat: coords.lat, lng: coords.lng };
      }
      if (lowerName.includes('denmark') || lowerName.includes('danemark')) {
        const coords = cityCoordinates['denmark'] || { lat: 56.2639, lng: 9.5018 };
        return { name: locationName, lat: coords.lat, lng: coords.lng };
      }
      if (lowerName.includes('copenhag')) {
        const coords = cityCoordinates['copenhagen'] || cityCoordinates['copenhague'];
        if (coords) return { name: locationName, lat: coords.lat, lng: coords.lng };
      }
      if (lowerName.includes('belarus') || lowerName.includes('bieloruss')) {
        const coords = cityCoordinates['belarus'] || { lat: 53.9000, lng: 27.5667 };
        return { name: locationName, lat: coords.lat, lng: coords.lng };
      }

      // Vérifier chaque variante dans le cache
      for (const pattern of cleanPatterns) {
        if (cityCoordinates[pattern]) {
          return {
            name: locationName,
            lat: cityCoordinates[pattern].lat,
            lng: cityCoordinates[pattern].lng
          };
        }
      }
      
      // 3. FUZZY MATCH DANS LE CACHE (préférer les correspondances longues)
      const mainCity = cleanPatterns[1] || lowerName;
      for (const [key, coords] of Object.entries(cityCoordinates)) {
        // Correspondance de début
        if (key.startsWith(mainCity) || mainCity.startsWith(key)) {
          return {
            name: locationName,
            lat: coords.lat,
            lng: coords.lng
          };
        }
        // Contient la clé (ex: "san francisco" contient "francisco")
        if (mainCity.length > 3 && key.includes(mainCity)) {
          return {
            name: locationName,
            lat: coords.lat,
            lng: coords.lng
          };
        }
      }
      
      // 4. NOMINATIM FALLBACK - timeout très court
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      const searchCity = cleanPatterns.find(p => p.length > 2) || lowerName;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchCity)}&format=json&limit=1&countrycodes=fr,gb,us,ca,de,it,es,nl,be,ch,dk,se,no,fi,is,au,nz,jp,br,mx,by,pl,cz,sk,hu,ro,si,hr,rs,bg`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const results = await response.json();
        if (results && results.length > 0) {
          const result = results[0];
          return {
            name: locationName,
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon)
          };
        }
      }

      // Tentative globale sans restriction si rien trouvé
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 1000);
      const response2 = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchCity)}&format=json&limit=1`,
        { signal: controller2.signal }
      );
      clearTimeout(timeoutId2);

      if (!response2.ok) return null;
      const results2 = await response2.json();
      if (!results2 || results2.length === 0) return null;

      return {
        name: locationName,
        lat: parseFloat(results2[0].lat),
        lng: parseFloat(results2[0].lon)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Charger les lieux des concerts depuis l'API via les relations
   */
  async function loadLocations(artistId) {
    try {
      // Récupérer les relations pour cet artiste
      const response = await fetch('/artist/' + artistId);
      if (!response.ok) throw new Error('Erreur de chargement');
      
      const artist = await response.json();
      
      // Les lieux de concert viennent de concertInfo
      if (artist.concertInfo && artist.concertInfo.length > 0) {
        const locationsSet = new Set();
        const locationsArray = [];
        
        artist.concertInfo.forEach(concert => {
          if (concert.location && concert.location.trim()) {
            const normalized = concert.location.trim().toLowerCase();
            // Dédupliquer par nom normalisé
            if (!locationsSet.has(normalized)) {
              locationsSet.add(normalized);
              locationsArray.push(concert.location.trim());
            }
          }
        });
        
        console.log(`✓ ${locationsArray.length} lieux uniques chargés`);
        return locationsArray;
      }
      
      return [];
    } catch (error) {
      console.error('Erreur lors du chargement des locations:', error);
      return [];
    }
  }

  /**
   * Afficher une carte avec les lieux des concerts
   */
  async function showLocationMap(artist) {
    // Récupérer les locations
    const locations = await loadLocations(artist.id);
    
    if (!locations || locations.length === 0) {
      alert('Aucun lieu de concert trouvé pour cet artiste');
      return;
    }

    // Créer la modal
    const modal = document.createElement('div');
    modal.className = 'location-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1001;
      padding: 20px;
      backdrop-filter: blur(5px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: rgba(240, 240, 240, 0.98);
      backdrop-filter: blur(10px);
      padding: 0;
      border-radius: 20px;
      max-width: 1000px;
      width: 90vw;
      height: 90vh;
      position: relative;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
    `;

    // Bouton fermer
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      position: absolute;
      top: 15px;
      right: 15px;
      background: rgba(0,0,0,0.2);
      border: none;
      font-size: 28px;
      cursor: pointer;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      color: #333;
      font-weight: bold;
      z-index: 1002;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    `;
    closeBtn.textContent = '×';

    const closeLocationModal = () => {
      modal.style.animation = 'modalOverlayFadeOut 0.3s ease forwards';
      modalContent.style.animation = 'modalContentOut 0.3s ease forwards';
      setTimeout(() => modal.remove(), 300);
    };

    closeBtn.addEventListener('click', closeLocationModal);
    closeBtn.addEventListener('mouseover', () => closeBtn.style.background = 'rgba(0,0,0,0.3)');
    closeBtn.addEventListener('mouseout', () => closeBtn.style.background = 'rgba(0,0,0,0.2)');

    // Conteneur pour la carte
    const mapContainer = document.createElement('div');
    mapContainer.id = 'artist-concert-map-' + artist.id;
    mapContainer.style.cssText = `
      flex: 1;
      min-height: 400px;
      border-radius: 0 0 20px 20px;
      overflow: hidden;
    `;

    // Header avec titre
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      background: rgba(255, 255, 255, 0.5);
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 20px 20px  0;
    `;
    header.innerHTML = `
      <h2 style="margin: 0; color: #222; font-family: 'Franklin Gothic Medium', Arial, sans-serif;">
        Lieux de concert - ${artist.name}
      </h2>
      <p style="margin: 5px 0 0 0; color: #666; font-size: 0.95rem; border-radius:20px;">
        ${locations.length} localisation${locations.length > 1 ? 's' : ''}
      </p>
    `;

    modalContent.appendChild(header);
    modalContent.appendChild(mapContainer);
    modalContent.appendChild(closeBtn);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Initialiser la carte Leaflet
    setTimeout(async () => {
      try {
        const map = L.map(mapContainer.id).setView([48.8566, 2.3522], 3);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // Géocoder et ajouter les marqueurs
        const bounds = L.latLngBounds();
        let markersAdded = 0;
        let locationsFailed = [];
        
        // Traiter les locations avec petit délai entre chaque pour éviter les timeouts API
        for (let i = 0; i < locations.length; i++) {
          const location = locations[i];
          // Petit délai progressif
          await new Promise(resolve => setTimeout(resolve, 50 * i));
          
          const coords = await geocodeLocation(location);
          if (coords) {
            const marker = L.circleMarker([coords.lat, coords.lng], {
              radius: 8,
              fillColor: '#93C5FD',
              color: '#1E40AF',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            });
            
            marker.bindPopup(`
              <div style="
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                padding: 12px 16px;
                min-width: 200px;
                max-width: 300px;
              ">
                <div style="
                  font-size: 16px;
                  font-weight: 600;
                  color: #222;
                  margin-bottom: 8px;
                  border-bottom: 2px solid #666;
                  padding-bottom: 6px;
                  position: relative;
                  padding-left: 8px;
                ">
                  <div style="position: absolute; left: -8px; top: 50%; transform: translateY(-50%); width: 4px; height: 20px; background: #666; border-radius: 2px;"></div>
                  ${formatCityName(coords.name)}
                </div>
                <div style="
                  font-size: 13px;
                  color: #4B5563;
                  margin-top: 8px;
                  line-height: 1.5;
                  font-style: italic;
                ">
                  Lieu de concert
                </div>
              </div>
            `, {
              maxWidth: 300,
              className: 'custom-popup'
            });
            
            marker.addTo(map);
            markersAdded++;
            bounds.extend([coords.lat, coords.lng]);
          } else {
            locationsFailed.push(location);
          }
        }

        console.log(`✓ ${markersAdded}/${locations.length} marqueurs affichés`);
        if (locationsFailed.length > 0) {
          console.warn(`⚠ ${locationsFailed.length} lieux non géocodés:`, locationsFailed);
        }
        
        // Adapter la vue pour afficher tous les marqueurs
        if (bounds.isValid() && markersAdded > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        } else if (markersAdded === 0) {
          // Si aucun marqueur, centrer sur Paris par défaut
          map.setView([48.8566, 2.3522], 3);
        }
      } catch (error) {
        console.error('Erreur lors de l\'affichage de la carte:', error);
        mapContainer.innerHTML = '<p style="padding: 20px; color: #666;">Erreur lors du chargement de la carte</p>';
      }
    }, 100);

    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeLocationModal();
      }
    });
  }

  /**
   * Afficher le formulaire de paiement pour un concert
   */
  function showPaymentForm(concertDate, concertLocation, artistName) {
    // Créer la modal de paiement
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      padding: 20px;
      backdrop-filter: blur(8px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: rgba(240, 240, 240, 0.95);
      backdrop-filter: blur(10px);
      padding: 40px;
      border-radius: 20px;
      max-width: 500px;
      width: 100%;
      position: relative;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      color: #222;
    `;

    modalContent.innerHTML = `
      <button class="close-payment-btn" style="
        position: absolute;
      top: 15px;
      right: 15px;
      background: rgba(0,0,0,0.2);
      border: none;
      font-size: 28px;
      cursor: pointer;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      color: #333;
      font-weight: bold;
      transition: background 0.2s;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      ">×</button>
      
      <h2 style="margin-top: 0; font-size: 1.8rem; margin-bottom: 10px; border-left: 4px solid #555; padding-left: 12px;">Réservation de billet</h2>
      
      <div style="background: rgba(0,0,0,0.05); padding: 15px; border-radius: 10px; margin-bottom: 25px; border: 1px solid rgba(0,0,0,0.1);">
        <p style="margin: 5px 0; font-size: 0.95rem;"><strong>Artiste:</strong> ${artistName}</p>
        <p style="margin: 5px 0; font-size: 0.95rem;"><strong>Date:</strong> ${concertDate}</p>
        <p style="margin: 5px 0; font-size: 0.95rem;"><strong>Lieu:</strong> ${concertLocation}</p>
        <p style="margin: 5px 0; font-size: 1.2rem; margin-top: 10px;"><strong>Prix:</strong> 49,99 €</p>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 1.1rem;">Mode de paiement</label>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="payment-method-btn" data-method="card" style="
            flex: 1;
            padding: 12px;
            background: #444;
            border: 2px solid #444;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            color: white;
            transition: all 0.2s;
          ">Carte bancaire</button>
          <button type="button" class="payment-method-btn" data-method="paypal" style="
            flex: 1;
            padding: 12px;
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            color: #222;
            transition: all 0.2s;
          ">PayPal</button>
          <button type="button" class="payment-method-btn" data-method="crypto" style="
            flex: 1;
            padding: 12px;
            background: white;
            border: 2px solid #ddd;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            color: #222;
            transition: all 0.2s;
          ">Crypto</button>
        </div>
      </div>

      <form id="payment-form" style="display: flex; flex-direction: column; gap: 15px;">
        <div id="card-payment" class="payment-section" style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Numéro de carte</label>
            <input type="text" id="card-number" placeholder="1234 5678 9012 3456" maxlength="19" style="
              width: 100%;
              padding: 12px;
              border: none;
              border-radius: 8px;
              font-size: 1rem;
              box-sizing: border-box;
            ">
          </div>

          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Nom sur la carte</label>
            <input type="text" id="card-name" placeholder="JEAN DUPONT" style="
              width: 100%;
              padding: 12px;
              border: none;
              border-radius: 8px;
              font-size: 1rem;
              box-sizing: border-box;
              text-transform: uppercase;
            ">
          </div>

          <div style="display: flex; gap: 15px;">
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">Date d'expiration</label>
              <input type="text" id="card-expiry" placeholder="MM/AA" maxlength="5" style="
                width: 100%;
                padding: 12px;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                box-sizing: border-box;
              ">
            </div>
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 5px; font-weight: 600;">CVV</label>
              <input type="text" id="card-cvv" placeholder="123" maxlength="3" style="
                width: 100%;
                padding: 12px;
                border: none;
                border-radius: 8px;
                font-size: 1rem;
                box-sizing: border-box;
              ">
            </div>
          </div>
        </div>

        <div id="paypal-payment" class="payment-section" style="display: none;">
          <div style="background: rgba(0,0,0,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #0070ba; text-align: center;">
            <p style="margin: 0 0 20px 0; font-size: 1rem; color: #444;">
              Cliquez sur le bouton ci-dessous pour effectuer votre paiement via PayPal de manière sécurisée.
            </p>
            <button type="button" id="paypal-redirect-btn" style="
              background: #0070ba;
              color: white;
              border: none;
              padding: 15px 40px;
              border-radius: 8px;
              font-size: 1.1rem;
              font-weight: bold;
              cursor: pointer;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              transition: background 0.2s;
            " onmouseover="this.style.background='#005a94'" onmouseout="this.style.background='#0070ba'">
              Payer avec PayPal
            </button>
          </div>
        </div>

        <div id="crypto-payment" class="payment-section" style="display: none;">
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Choisir la crypto-monnaie</label>
            <select id="crypto-type" style="
              width: 100%;
              padding: 12px;
              border: none;
              border-radius: 8px;
              font-size: 1rem;
              box-sizing: border-box;
              cursor: pointer;
            ">
              <option value="btc">Bitcoin (BTC)</option>
              <option value="eth">Ethereum (ETH)</option>
              <option value="usdt">Tether (USDT)</option>
              <option value="bnb">Binance Coin (BNB)</option>
            </select>
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: 600;">Adresse de votre portefeuille</label>
            <input type="text" id="wallet-address" placeholder="0x..." style="
              width: 100%;
              padding: 12px;
              border: none;
              border-radius: 8px;
              font-size: 1rem;
              box-sizing: border-box;
              font-family: monospace;
            ">
          </div>
          <div style="background: rgba(0,0,0,0.05); padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f7931a;">
            <p style="margin: 0; font-size: 0.9rem; color: #444;">
              Un QR code vous sera envoyé pour effectuer le paiement depuis votre portefeuille crypto.
            </p>
          </div>
        </div>

        <button type="submit" id="submit-payment-btn" style="
          background: #555;
          color: white;
          border: none;
          padding: 15px;
          border-radius: 8px;
          font-size: 1.1rem;
          font-weight: bold;
          cursor: pointer;
          margin-top: 10px;
          transition: background 0.2s;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        " onmouseover="this.style.background='#333'" onmouseout="this.style.background='#555'">
          Payer 49,99 €
        </button>
      </form>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Variables pour gérer le mode de paiement
    let currentPaymentMethod = 'card';

    // Gérer le bouton PayPal
    const paypalRedirectBtn = modalContent.querySelector('#paypal-redirect-btn');
    if (paypalRedirectBtn) {
      paypalRedirectBtn.addEventListener('click', function() {
        window.open('https://paypal.me/blanka370', '_blank');
        // Simuler le succès du paiement après ouverture
        setTimeout(() => {
          modalContent.innerHTML = `
            <div style="text-align: center; padding: 20px;">
              <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: #555; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <div style="width: 40px; height: 20px; border-left: 4px solid white; border-bottom: 4px solid white; transform: rotate(-45deg) translateY(-5px);"></div>
              </div>
              <h2 style="color: #222; margin-bottom: 15px;">Redirection vers PayPal</h2>
              <p style="font-size: 1.1rem; margin-bottom: 10px; color: #444;">Vous avez été redirigé vers PayPal</p>
              <p style="opacity: 0.7; margin-bottom: 10px; color: #444;">Mode de paiement : PayPal</p>
              <p style="opacity: 0.7; margin-bottom: 20px; color: #444;">Un email de confirmation vous sera envoyé après le paiement</p>
              <button onclick="this.closest('.payment-modal').remove()" style="
                background: #555;
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: bold;
                cursor: pointer;
                margin-top: 10px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              ">Fermer</button>
            </div>
          `;
        }, 500);
      });
    }

    // Gérer les boutons de sélection du mode de paiement
    const paymentMethodBtns = modalContent.querySelectorAll('.payment-method-btn');
    paymentMethodBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const method = this.getAttribute('data-method');
        currentPaymentMethod = method;

        // Mettre à jour les styles des boutons
        paymentMethodBtns.forEach(b => {
          if (b === this) {
            b.style.background = '#444';
            b.style.borderColor = '#444';
            b.style.color = 'white';
          } else {
            b.style.background = 'white';
            b.style.borderColor = '#ddd';
            b.style.color = '#222';
          }
        });

        // Afficher la section de paiement correspondante
        const cardSection = modalContent.querySelector('#card-payment');
        const paypalSection = modalContent.querySelector('#paypal-payment');
        const cryptoSection = modalContent.querySelector('#crypto-payment');

        cardSection.style.display = method === 'card' ? 'flex' : 'none';
        paypalSection.style.display = method === 'paypal' ? 'block' : 'none';
        cryptoSection.style.display = method === 'crypto' ? 'block' : 'none';
      });
    });

    // Formater automatiquement le numéro de carte
    const cardNumberInput = modalContent.querySelector('#card-number');
    if (cardNumberInput) {
      cardNumberInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\s/g, '');
        let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
        e.target.value = formattedValue;
      });
    }

    // Formater la date d'expiration
    const cardExpiryInput = modalContent.querySelector('#card-expiry');
    if (cardExpiryInput) {
      cardExpiryInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
          value = value.slice(0, 2) + '/' + value.slice(2, 4);
        }
        e.target.value = value;
      });
    }

    // Accepter uniquement les chiffres pour le CVV
    const cardCvvInput = modalContent.querySelector('#card-cvv');
    if (cardCvvInput) {
      cardCvvInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '');
      });
    }

    // Gérer la soumission du formulaire
    const form = modalContent.querySelector('#payment-form');
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      let isValid = false;
      let paymentMethodName = '';

      if (currentPaymentMethod === 'card') {
        const cardNumber = cardNumberInput.value.replace(/\s/g, '');
        const cardName = modalContent.querySelector('#card-name').value;
        const cardExpiry = cardExpiryInput.value;
        const cardCvv = cardCvvInput.value;

        // Validation carte bancaire
        if (cardNumber.length !== 16) {
          alert('Le numéro de carte doit contenir 16 chiffres');
          return;
        }
        if (!cardName.trim()) {
          alert('Veuillez entrer le nom sur la carte');
          return;
        }
        if (cardExpiry.length !== 5) {
          alert('La date d\'expiration doit être au format MM/AA');
          return;
        }
        if (cardCvv.length !== 3) {
          alert('Le CVV doit contenir 3 chiffres');
          return;
        }
        isValid = true;
        paymentMethodName = 'Carte bancaire';

      } else if (currentPaymentMethod === 'paypal') {
        // PayPal est géré par le bouton de redirection
        // Pas besoin de validation ici
        return;

      } else if (currentPaymentMethod === 'crypto') {
        const walletAddress = modalContent.querySelector('#wallet-address').value;
        const cryptoType = modalContent.querySelector('#crypto-type').value;

        // Validation Crypto
        if (!walletAddress.trim() || walletAddress.length < 26) {
          alert('Veuillez entrer une adresse de portefeuille valide');
          return;
        }
        isValid = true;
        const cryptoNames = {
          btc: 'Bitcoin',
          eth: 'Ethereum',
          usdt: 'Tether',
          bnb: 'Binance Coin'
        };
        paymentMethodName = cryptoNames[cryptoType] || 'Crypto';
      }

      if (isValid) {
        // Simuler le paiement
        modalContent.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <div style="width: 80px; height: 80px; margin: 0 auto 20px; background: #555; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <div style="width: 40px; height: 20px; border-left: 4px solid white; border-bottom: 4px solid white; transform: rotate(-45deg) translateY(-5px);"></div>
            </div>
            <h2 style="color: #222; margin-bottom: 15px;">Paiement réussi !</h2>
            <p style="font-size: 1.1rem; margin-bottom: 10px; color: #444;">Votre billet a été réservé avec succès</p>
            <p style="opacity: 0.7; margin-bottom: 10px; color: #444;">Mode de paiement : ${paymentMethodName}</p>
            <p style="opacity: 0.7; margin-bottom: 20px; color: #444;">Un email de confirmation vous a été envoyé</p>
            <button onclick="this.closest('.payment-modal').remove()" style="
              background: #555;
              color: white;
              border: none;
              padding: 12px 30px;
              border-radius: 8px;
              font-size: 1rem;
              font-weight: bold;
              cursor: pointer;
              margin-top: 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            ">Fermer</button>
          </div>
        `;
      }
    });

    // Fermer avec le bouton X
    const closeBtn = modalContent.querySelector('.close-payment-btn');
    closeBtn.addEventListener('click', () => modal.remove());

    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Afficher une modal avec les détails de l'artiste
   */
  function showArtistModal(artist) {
    // Créer la modal
    const modal = document.createElement('div');
    modal.className = 'artist-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
      backdrop-filter: blur(5px);
      animation: modalOverlayFade 0.35s ease;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background-color: rgba(240, 240, 240, 0.95);
      backdrop-filter: blur(8px);
      padding: 30px;
      border-radius: 20px;
      max-width: 1300px;
      width: 95vw;
      max-height: 85vh;
      position: relative;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: row;
      gap: 30px;
      overflow: hidden;
      animation: modalContentIn 0.35s ease;
      transform-origin: center;
    `;
    
    // Créer un conteneur pour l'image
    const imageContainer = document.createElement('div');
    imageContainer.style.cssText = `
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    `;
    
    let concertsHtml = '';
    if (artist.concertInfo && artist.concertInfo.length > 0) {
      concertsHtml = '<h3 style="color: #222; margin-top: 20px; font-size: 1.5rem; margin-bottom: 15px; border-left: 4px solid #555; padding-left: 12px;">Concerts</h3><ul style="list-style: none; padding: 0;">';
      artist.concertInfo.forEach(concert => {
        concert.dates.forEach(date => {
          const concertId = `concert-${date.replace(/\s/g, '-')}-${concert.location.replace(/\s/g, '-')}`;
          // Séparer la ville et le pays si possible
          const locationParts = concert.location.split(',');
          let cityHtml = '';
          if (locationParts.length > 1) {
            const city = formatCityName(locationParts.slice(0, -1).join(',').trim());
            const country = formatCityName(locationParts[locationParts.length - 1].trim());
            cityHtml = `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 600; font-size: 1rem; color: #222;">${city}</span>
                <span style="font-size: 0.85rem; opacity: 0.8; color: #666;">${country}</span>
              </div>
            `;
          } else {
            cityHtml = `<span style="font-weight: 600; font-size: 1rem; color: #222;">${formatCityName(concert.location)}</span>`;
          }
          
          concertsHtml += `<li class="concert-item" data-concert-date="${date}" data-concert-location="${concert.location}" data-artist-name="${artist.name}" style="
            padding: 15px 18px; 
            background: rgba(0, 0, 0, 0.05);
            margin: 10px 0; 
            border-radius: 12px; 
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-left: 4px solid #555;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          " onmouseover="this.style.background='rgba(0, 0, 0, 0.1)'; this.style.transform='translateX(5px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.1)'; this.style.borderLeftColor='#333'" onmouseout="this.style.background='rgba(0, 0, 0, 0.05)'; this.style.transform='translateX(0)'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.05)'; this.style.borderLeftColor='#555'">
            <div style="display: flex; flex-direction: column; gap: 5px; flex: 1;">
              <span style="font-size: 0.9rem; color: #666; font-weight: 500; font-style: italic;">${date}</span>
              ${cityHtml}
            </div>
            <span style="background: #555; color: white; padding: 8px 16px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">Réserver</span>
          </li>`;
        });
      });
      concertsHtml += '</ul>';
    }

    const mapButtonHtml = '<button id="show-map-btn" style="margin-top: 20px; padding: 12px 24px; background: #555; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); transition: background 0.2s;" onmouseover="this.style.background=\'#333\'" onmouseout="this.style.background=\'#555\'">Voir les lieux de concert</button>';

    // Créer l'image
    if (artist.image) {
      const imgElement = document.createElement('img');
      imgElement.src = artist.image;
      imgElement.alt = artist.name;
      imgElement.style.cssText = `
        width: 300px;
        height: 300px;
        object-fit: cover;
        border-radius: 15px;
        flex-shrink: 0;
      `;
      imgElement.onerror = function() { this.style.display = 'none'; };
      imageContainer.appendChild(imgElement);
    }
    
    // Créer le conteneur pour le contenu (scrollable)
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      flex: 1;
      min-width: 0;
      overflow-y: auto;
      border-radius: 15px;
      padding-right: 10px;
      padding-bottom: 40px;
      max-height: 100%;
    `;
    
    // Ajouter le bouton de fermeture
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 15px;
      right: 15px;
      background: rgba(0,0,0,0.2);
      border: none;
      font-size: 28px;
      cursor: pointer;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      color: #333;
      font-weight: bold;
      transition: background 0.2s;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    `;
    const closeArtistModal = () => {
      modal.style.animation = 'modalOverlayFadeOut 0.3s ease forwards';
      modalContent.style.animation = 'modalContentOut 0.3s ease forwards';
      setTimeout(() => modal.remove(), 300);
    };

    closeBtn.addEventListener('click', closeArtistModal);
    closeBtn.addEventListener('mouseover', () => closeBtn.style.background = 'rgba(0,0,0,0.3)');
    closeBtn.addEventListener('mouseout', () => closeBtn.style.background = 'rgba(0,0,0,0.2)');
    
    contentContainer.innerHTML = `
      <div style="margin-bottom: 25px;">
        <h2 style="margin-top: 0; margin-bottom: 15px; font-size: 3.5rem; color: #111; font-family: 'Franklin Gothic Medium', Arial, sans-serif; font-weight: 900; letter-spacing: -1px;">${artist.name}</h2>
        ${artist.creationDate ? `<p style="font-size: 1.1rem; color: #444; margin: 5px 0;"><strong>Année de création:</strong> ${artist.creationDate}</p>` : ''}
        ${artist.firstAlbum ? `<p style="font-size: 1.1rem; color: #444; margin: 5px 0;"><strong>Premier album:</strong> ${artist.firstAlbum}</p>` : ''}
      </div>

      <hr style="border: none; border-top: 2px solid rgba(0, 0, 0, 0.1); margin: 20px 0;">

      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 1.5rem; color: #222; margin-bottom: 15px; font-family: 'Franklin Gothic Medium', Arial, sans-serif;">Membres</h3>
        ${artist.genre ? `<p style="font-size: 1.1rem; color: #444; background: rgba(0,0,0,0.05); padding: 8px 12px; border-radius: 6px; display: inline-block; margin-bottom: 10px;"><strong>Genre:</strong> ${artist.genre}</p>` : ''}
        ${artist.members && artist.members.length > 0 ? `
          <ul style="margin: 5px 0 0 20px; color: #555; list-style: disc;">
            ${artist.members.map(m => `<li style="margin: 3px 0;">${m}</li>`).join('')}
          </ul>
        ` : ''}
      </div>

      <hr style="border: none; border-top: 2px solid rgba(0, 0, 0, 0.1); margin: 20px 0;">

      <div>
        ${concertsHtml}
        ${mapButtonHtml}
      </div>
    `;
    
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(imageContainer);
    modalContent.appendChild(contentContainer);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Attacher l'événement du bouton carte
    setTimeout(() => {
      const mapBtn = contentContainer.querySelector('#show-map-btn');
      if (mapBtn) {
        mapBtn.addEventListener('click', () => {
          showLocationMap(artist);
        });
      }
    }, 0);

    // Attacher les événements de clic sur les concerts
    setTimeout(() => {
      const concertItems = modalContent.querySelectorAll('.concert-item');
      concertItems.forEach(item => {
        item.addEventListener('click', function() {
          const concertDate = this.getAttribute('data-concert-date');
          const concertLocation = this.getAttribute('data-concert-location');
          const artistName = this.getAttribute('data-artist-name');
          showPaymentForm(concertDate, concertLocation, artistName);
        });
      });
    }, 0);
    
    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeArtistModal();
      }
    });
  }

  /**
   * Filtrer les artistes
   */
  async function filterArtists() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const year = document.getElementById('filter-creation-date')?.value;
    const members = document.getElementById('filter-members')?.value;
    const genre = (document.getElementById('filter-genre')?.value || '').toLowerCase();
    const city = (document.getElementById('filter-city')?.value || '').trim().toLowerCase();

    let filtered = allArtists;

    // Filtrer par nom
    if (query) {
      filtered = filtered.filter(artist => 
        artist.name.toLowerCase().includes(query)
      );
    }

    // Filtrer par année
    if (year) {
      filtered = filtered.filter(artist => 
        artist.creationDate === parseInt(year, 10)
      );
    }

    // Filtrer par nombre de membres
    if (members) {
      filtered = filtered.filter(artist => 
        artist.members && artist.members.length === parseInt(members, 10)
      );
    }

    // Filtrer par genre
    if (genre) {
      filtered = filtered.filter(artist => 
        artist.genre && artist.genre.toLowerCase().includes(genre)
      );
    }

    // Filtrer par ville (lieux de concert)
    if (city) {
      try {
        if (artistLocationsMap.size === 0) {
          await loadAllLocations();
        }
        filtered = filtered.filter(artist => {
          const locs = artistLocationsMap.get(parseInt(artist.id)) || artistLocationsMap.get(artist.id) || [];
          return locs.some(loc => {
            const formatted = formatCityName(loc).toLowerCase();
            const cityPart = formatted.split(',')[0];
            return formatted.includes(city) || cityPart.includes(city);
          });
        });
      } catch (e) {
        console.error('Erreur filtre ville:', e);
      }
    }

    renderArtists(filtered);
  }

  // ===== DOM ELEMENTS =====
  const searchInput = document.getElementById('search-input');
  const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
  const searchContainer = document.getElementById('search-container');
  const advancedFilters = document.getElementById('advanced-filters');
  const artistsContainer = document.getElementById('artists-container');

  // ===== EVENT LISTENERS =====
  const debouncedFilter = debounce(filterArtists, DEBOUNCE_DELAY);

  // Artist cards: event delegation (one listener for all cards)
  if (artistsContainer) {
    artistsContainer.addEventListener('click', async (e) => {
      const card = e.target.closest('.artist-info-card');
      if (card) {
        const artistId = card.getAttribute('data-artist-id');
        if (artistId) {
          await showArtistDetails(artistId);
        }
      }
    });
  }

  // Search input: debounced filtering
  if (searchInput) {
    searchInput.addEventListener('input', debouncedFilter);
  }

  // Toggle filters visibility
  if (toggleFiltersBtn && advancedFilters) {
    toggleFiltersBtn.addEventListener('click', () => {
      const isHidden = advancedFilters.classList.toggle('hidden');
      if (searchContainer) {
        searchContainer.classList.toggle('expanded');
      }
      toggleFiltersBtn.textContent = isHidden ? 'Filtres' : 'Masquer filtres';
      toggleFiltersBtn.setAttribute('aria-expanded', !isHidden);
    });
  }

  // Filter inputs
  ['filter-creation-date', 'filter-members', 'filter-genre', 'filter-city'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', filterArtists);
      element.addEventListener('input', debouncedFilter);
    }
  });

  // ===== INITIALIZATION =====
  // Charger les artistes au chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadArtists);
  } else {
    loadArtists();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    debounceTimers.forEach(timer => clearTimeout(timer));
    debounceTimers.clear();
  });
})();