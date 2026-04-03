import L from 'leaflet';
import type { Guess } from '../../types';
import { PLAYER_COLORS } from '../../config';

export class GuessMap {
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private resultLayers: L.LayerGroup | null = null;
  private guess: { lat: number; lng: number } | null = null;
  private locked = false;

  init(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.map = L.map(containerId, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.resultLayers = L.layerGroup().addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.locked) return;

      this.guess = { lat: e.latlng.lat, lng: e.latlng.lng };

      if (this.marker) {
        this.marker.setLatLng(e.latlng);
      } else {
        this.marker = L.marker(e.latlng, {
          icon: L.divIcon({
            className: '',
            html: `<div style="
              width: 16px; height: 16px;
              background: #00f0ff;
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 0 10px #00f0ff;
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        }).addTo(this.map!);
      }
    });
  }

  getGuess(): { lat: number; lng: number } | null {
    return this.guess;
  }

  lock() {
    this.locked = true;
  }

  showResults(correctLat: number, correctLng: number, guesses: Guess[], players: { id: string; name: string }[]) {
    if (!this.map || !this.resultLayers) return;

    this.resultLayers.clearLayers();
    if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }

    // Correct location marker
    const correctMarker = L.marker([correctLat, correctLng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          width: 20px; height: 20px;
          background: #00ff88;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 15px #00ff88;
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    });
    this.resultLayers.addLayer(correctMarker);

    const bounds = L.latLngBounds([[correctLat, correctLng]]);

    guesses.forEach((g, i) => {
      if (g.distance >= 20000) return; // didn't guess

      const color = PLAYER_COLORS[players.findIndex(p => p.id === g.playerId) % PLAYER_COLORS.length];

      const guessMarker = L.marker([g.lat, g.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            width: 14px; height: 14px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 8px ${color};
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).bindTooltip(`${g.playerName}: ${Math.round(g.distance)} km`, {
        permanent: i < 5,
        direction: 'top',
      });

      const line = L.polyline(
        [[correctLat, correctLng], [g.lat, g.lng]],
        { color, weight: 2, opacity: 0.6, dashArray: '5,5' }
      );

      this.resultLayers!.addLayer(guessMarker);
      this.resultLayers!.addLayer(line);
      bounds.extend([g.lat, g.lng]);
    });

    this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
  }

  reset() {
    this.guess = null;
    this.locked = false;
    this.resultLayers?.clearLayers();
    if (this.marker && this.map) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
    this.map?.setView([20, 0], 2);
  }

  resize() {
    this.map?.invalidateSize();
  }

  destroy() {
    this.map?.remove();
    this.map = null;
  }
}
