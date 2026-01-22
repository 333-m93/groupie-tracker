# SpotMyArtist - Groupie Tracker

Une application pour découvrir les artistes et voir leurs lieux de concert sur une carte interactive.

## C'est quoi?

SpotMyArtist récupère les données d'artistes via l'API Groupie Tracker et affiche tout de manière sympa. Tu peux chercher des artistes, les filtrer par genre ou période, et voir exactement où ils jouent en concert sur une vraie map.

## Features

- Affiche tous les artistes avec recherche et filtres (genre, époque, membres, ville)
- Modal avec les infos détaillées de chaque artiste
- Carte interactive Leaflet qui montre tous les lieux de concert
- Géocodage intelligent avec cache local (super rapide)
- Design moderne avec carrousel en arrière-plan
- Formulaire de paiement intégré

## Installation

``
cd groupie-tracker
go run main.go
``

Puis ouvre https://groupie-tracker-l97d.onrender.com

## Comment ça marche

Le serveur Go charge les données depuis l'API Groupie Tracker et les enrichit un peu:
- Les artistes arrivent avec leurs genres et images
- Les dates de concert sont associées aux lieux
- Tout est servi de manière clean en JSON

Le frontend en vanilla JS gère:
- La recherche et les filtres (debounced pour pas spam l'API)
- Les modales pour voir les détails
- La carte avec Leaflet et géocodage Nominatim
- Le carrousel qui défile en fond

## Architecture

``
groupie-tracker/
 main.go              # Point d'entrée, setup routes
 server/server.go     # Logique serveur, endpoints
 src/
    index.html       # Page principale
    artist.html      # Page artiste (bonus)
    static/
        script.js    # Tout le JS (1700 lignes)
        style.css    # Styles
 render.yaml          # Config déploiement
``

## Endpoints

- GET /artists - Tous les artistes
- GET /artist/:id - Un artiste avec ses concerts
- GET /locations - Les lieux de concert
- GET /relations - Les relations date-lieu
- GET /search?q=... - Chercher des artistes
- GET /external-search?q=... - Fallback Discogs si besoin

## Technos

- Go pour le serveur (HTTPS, API calls, caching)
- Vanilla JS pour le front (pas de framework, c'est plus simple)
- Leaflet pour la map
- CSS custom pour le design
- Nominatim OpenStreetMap pour la géo

## Notes

- Les concerts sont regroupés par ville et dédupliqués
- 350+ villes en cache local pour une map rapide
- Nominatim fallback si une ville n'est pas en cache
- La recherche et le filtre sont deboucés (300ms)
- Les modales sont créées dynamiquement en JS

MEBROUK Mohammed
FATOUX-DELLA POSTA Alexandre
