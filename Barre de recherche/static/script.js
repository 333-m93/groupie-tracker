/**
 * SpotMyArtist - Groupie Tracker API Integration
 * Charge les artistes depuis l'API tout en gardant le style original
 */

(function () {
  // ===== CONSTANTS =====
  const DEBOUNCE_DELAY = 300;
  const API_BASE = '';
  
  // Cache des artistes
  let allArtists = [];

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
      container.innerHTML = '<p>Aucun artiste trouvé</p>';
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

    // Ajouter les événements de clic immédiatement après le rendu
    setTimeout(() => {
      const cards = document.querySelectorAll('.artist-info-card');
      cards.forEach(card => {
        card.addEventListener('click', async function(e) {
          e.stopPropagation();
          const artistId = this.getAttribute('data-artist-id');
          if (artistId) {
            await showArtistDetails(artistId);
          }
        });
      });
    }, 0);
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
   * Charger les lieux des concerts depuis l'API
   */
  async function loadLocations(artistId) {
    try {
      // Récupérer toutes les locations
      const response = await fetch('/locations');
      if (!response.ok) throw new Error('Erreur de chargement des locations');
      
      const allLocations = await response.json();
      
      if (!allLocations || !Array.isArray(allLocations)) {
        console.log('Format locations non reconnu:', allLocations);
        return [];
      }
      
      // Chercher les locations pour cet artiste par ID
      for (let loc of allLocations) {
        if (loc && loc.id === parseInt(artistId)) {
          console.log('Locations trouvées pour artiste', artistId, ':', loc.locations);
          return loc.locations || [];
        }
      }
      
      console.log('Pas de locations trouvées pour artistId:', artistId);
      return [];
    } catch (error) {
      console.error('Erreur lors du chargement des locations:', error);
      return [];
    }
  }

  /**
   * Formater un nom de ville pour l'affichage
   * Enlève les tirets et underscores, met en majuscules
   */
  function formatCityName(cityName) {
    if (!cityName) return '';
    
    return cityName
      .replace(/[-_]/g, ' ')  // Remplacer - et _ par des espaces
      .split(' ')              // Séparer par espaces
      .map(word => {
        // Mettre en majuscule la première lettre de chaque mot
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');              // Rejoindre avec des espaces
  }

  /**
   * Parser une coordonnée de location (ex: "Paris, France")
   * Utilise Nominatim pour géocoder
   */
  async function geocodeLocation(locationName) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json`
      );
      if (!response.ok) return null;
      
      const results = await response.json();
      if (results.length === 0) return null;
      
      const result = results[0];
      return {
        name: locationName,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      };
    } catch (error) {
      console.error('Erreur geocodage:', error);
      return null;
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
    `;
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => modal.remove());
    closeBtn.addEventListener('mouseover', () => closeBtn.style.background = 'rgba(0,0,0,0.3)');
    closeBtn.addEventListener('mouseout', () => closeBtn.style.background = 'rgba(0,0,0,0.2)');

    // Conteneur pour la carte
    const mapContainer = document.createElement('div');
    mapContainer.id = 'artist-concert-map-' + artist.id;
    mapContainer.style.cssText = `
      flex: 1;
      min-height: 400px;
      border-radius: 20px;
      overflow: hidden;
    `;

    // Header avec titre
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      background: rgba(255, 255, 255, 0.5);
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    `;
    header.innerHTML = `
      <h2 style="margin: 0; color: #222; font-family: 'Franklin Gothic Medium', Arial, sans-serif;">
        Lieux de concert - ${artist.name}
      </h2>
      <p style="margin: 5px 0 0 0; color: #666; font-size: 0.95rem;">
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
        
        for (const location of locations) {
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
                  color: #1E40AF;
                  margin-bottom: 8px;
                  border-bottom: 2px solid #93C5FD;
                  padding-bottom: 6px;
                ">
                  📍 ${formatCityName(coords.name)}
                </div>
                <div style="
                  font-size: 13px;
                  color: #4B5563;
                  margin-top: 8px;
                  line-height: 1.5;
                ">
                  🎵 Lieu de concert
                </div>
              </div>
            `, {
              maxWidth: 300,
              className: 'custom-popup'
            });
            
            marker.addTo(map);
            bounds.extend([coords.lat, coords.lng]);
          }
        }

        // Adapter la vue pour afficher tous les marqueurs
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error('Erreur lors de l\'affichage de la carte:', error);
        mapContainer.innerHTML = '<p style="padding: 20px; color: #666;">Erreur lors du chargement de la carte</p>';
      }
    }, 100);

    // Fermer en cliquant à l'extérieur
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
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
        color: #222;
        font-weight: bold;
        transition: background 0.2s;
      ">×</button>
      
      <h2 style="margin-top: 0; font-size: 1.8rem; margin-bottom: 10px;">💳 Réservation de billet</h2>
      
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
            background: #93C5FD;
            border: 2px solid #93C5FD;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            color: #222;
            transition: all 0.2s;
          ">💳 Carte</button>
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
          ">🅿️ PayPal</button>
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
          ">₿ Crypto</button>
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
              🅿️ Payer avec PayPal
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
          background: #93C5FD;
          color: #222;
          border: none;
          padding: 15px;
          border-radius: 8px;
          font-size: 1.1rem;
          font-weight: bold;
          cursor: pointer;
          margin-top: 10px;
          transition: background 0.2s;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        " onmouseover="this.style.background='#7BB3F7'" onmouseout="this.style.background='#93C5FD'">
          🎫 Payer 49,99 €
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
              <div style="font-size: 4rem; margin-bottom: 20px;">✅</div>
              <h2 style="color: #222; margin-bottom: 15px;">Redirection vers PayPal</h2>
              <p style="font-size: 1.1rem; margin-bottom: 10px; color: #444;">Vous avez été redirigé vers PayPal</p>
              <p style="opacity: 0.7; margin-bottom: 10px; color: #444;">Mode de paiement : PayPal</p>
              <p style="opacity: 0.7; margin-bottom: 20px; color: #444;">Un email de confirmation vous sera envoyé après le paiement</p>
              <button onclick="this.closest('.payment-modal').remove()" style="
                background: #93C5FD;
                color: #222;
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
            b.style.background = '#93C5FD';
            b.style.borderColor = '#93C5FD';
          } else {
            b.style.background = 'white';
            b.style.borderColor = '#ddd';
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
            <div style="font-size: 4rem; margin-bottom: 20px;">✅</div>
            <h2 style="color: #222; margin-bottom: 15px;">Paiement réussi !</h2>
            <p style="font-size: 1.1rem; margin-bottom: 10px; color: #444;">Votre billet a été réservé avec succès</p>
            <p style="opacity: 0.7; margin-bottom: 10px; color: #444;">Mode de paiement : ${paymentMethodName}</p>
            <p style="opacity: 0.7; margin-bottom: 20px; color: #444;">Un email de confirmation vous a été envoyé</p>
            <button onclick="this.closest('.payment-modal').remove()" style="
              background: #93C5FD;
              color: #222;
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
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
      backdrop-filter: blur(5px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: rgba(240, 240, 240, 0.95);
      backdrop-filter: blur(10px);
      padding: 40px;
      border-radius: 20px;
      max-width: 900px;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    `;
    
    let concertsHtml = '';
    if (artist.concertInfo && artist.concertInfo.length > 0) {
      concertsHtml = '<h3 style="color: #222; margin-top: 20px; font-size: 1.5rem; margin-bottom: 15px;">🎶 Concerts à venir</h3><ul style="list-style: none; padding: 0;">';
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
                <span style="font-weight: 600; font-size: 1rem;">🎵 ${city}</span>
                <span style="font-size: 0.85rem; opacity: 0.8;">🌍 ${country}</span>
              </div>
            `;
          } else {
            cityHtml = `<span style="font-weight: 600; font-size: 1rem;">🎵 ${formatCityName(concert.location)}</span>`;
          }
          
          concertsHtml += `<li class="concert-item" data-concert-date="${date}" data-concert-location="${concert.location}" data-artist-name="${artist.name}" style="
            padding: 15px 18px; 
            background: linear-gradient(135deg, rgba(147, 197, 253, 0.15) 0%, rgba(167, 139, 250, 0.15) 100%);
            margin: 10px 0; 
            border-radius: 12px; 
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid rgba(147, 197, 253, 0.3);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          " onmouseover="this.style.background='linear-gradient(135deg, rgba(147, 197, 253, 0.25) 0%, rgba(167, 139, 250, 0.25) 100%)'; this.style.transform='translateX(5px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.1)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(147, 197, 253, 0.15) 0%, rgba(167, 139, 250, 0.15) 100%)'; this.style.transform='translateX(0)'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.05)'">
            <div style="display: flex; flex-direction: column; gap: 5px; flex: 1;">
              <span style="font-size: 0.9rem; color: #666; font-weight: 500;">📅 ${date}</span>
              ${cityHtml}
            </div>
            <span style="background: #48bb78; color: white; padding: 8px 16px; border-radius: 6px; font-size: 0.9rem; font-weight: bold; box-shadow: 0 2px 4px rgba(72, 187, 120, 0.3);">🎫 Réserver</span>
          </li>`;
        });
      });
      concertsHtml += '</ul>';
    }

    const mapButtonHtml = '<button id="show-map-btn" style="margin-top: 20px; padding: 10px 20px; background: #4a90e2; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;">🗺️ Voir les lieux de concert</button>';

    modalContent.innerHTML = `
      <button onclick="this.closest('.artist-modal').remove()" style="
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
      " onmouseover="this.style.background='rgba(0,0,0,0.3)'" onmouseout="this.style.background='rgba(0,0,0,0.2)'">×</button>
      
      <div style="display: flex; gap: 30px; align-items: flex-start; flex-wrap: wrap;">
        ${artist.image ? `
          <img src="${artist.image}" alt="${artist.name}" style="
            width: 300px;
            height: 300px;
            object-fit: cover;
            border-radius: 15px;
            flex-shrink: 0;
          " onerror="this.style.display='none'">
        ` : ''}
        
        <div style="flex: 1; min-width: 300px;">
          <h2 style="margin-top: 0; font-size: 2.5rem; color: #222; font-family: 'Franklin Gothic Medium', Arial, sans-serif;">${artist.name}</h2>
          ${artist.creationDate ? `<p style="font-size: 1.1rem; color: #444;"><strong>Année de création:</strong> ${artist.creationDate}</p>` : ''}
          ${artist.firstAlbum ? `<p style="font-size: 1.1rem; color: #444;"><strong>Premier album:</strong> ${artist.firstAlbum}</p>` : ''}
          ${artist.members && artist.members.length > 0 ? `
            <p style="font-size: 1.1rem; color: #444;"><strong>Membres:</strong></p>
            <ul style="margin: 5px 0; color: #555;">
              ${artist.members.map(m => `<li>${m}</li>`).join('')}
            </ul>
          ` : ''}
          ${concertsHtml}
          ${mapButtonHtml}
        </div>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Attacher l'événement du bouton carte
    const mapBtn = modalContent.querySelector('#show-map-btn');
    if (mapBtn) {
      mapBtn.addEventListener('click', () => {
        showLocationMap(artist);
      });
    }

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
        modal.remove();
      }
    });
  }

  /**
   * Filtrer les artistes
   */
  function filterArtists() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const year = document.getElementById('filter-creation-date')?.value;
    const members = document.getElementById('filter-members')?.value;
    const genre = (document.getElementById('filter-genre')?.value || '').toLowerCase();

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

    renderArtists(filtered);
  }

  // ===== DOM ELEMENTS =====
  const searchInput = document.getElementById('search-input');
  const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
  const searchContainer = document.getElementById('search-container');
  const advancedFilters = document.getElementById('advanced-filters');

  // ===== EVENT LISTENERS =====

  // Search input: debounced filtering
  if (searchInput) {
    const debouncedFilter = debounce(filterArtists, DEBOUNCE_DELAY);
    searchInput.addEventListener('input', debouncedFilter);
  }

  // Toggle filters visibility
  if (toggleFiltersBtn && advancedFilters) {
    toggleFiltersBtn.addEventListener('click', () => {
      advancedFilters.classList.toggle('hidden');
      if (searchContainer) {
        searchContainer.classList.toggle('expanded');
      }
      toggleFiltersBtn.textContent = advancedFilters.classList.contains('hidden') 
        ? 'Filtres' 
        : 'Masquer filtres';
    });
  }

  // Filter inputs
  const filterInputIds = ['filter-creation-date', 'filter-members', 'filter-genre'];
  filterInputIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('change', filterArtists);
      element.addEventListener('input', debounce(filterArtists, DEBOUNCE_DELAY));
    }
  });

  // ===== INITIALIZATION =====
  // Charger les artistes au chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadArtists);
  } else {
    loadArtists();
  }
})();