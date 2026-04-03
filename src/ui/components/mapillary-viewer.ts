import { Viewer } from 'mapillary-js';
import { MAPILLARY_ACCESS_TOKEN } from '../../config';

export class MapillaryViewer {
  private viewer: Viewer | null = null;
  private containerId: string;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Clear placeholder before MapillaryJS takes over the container
    container.innerHTML = '';

    try {
      this.viewer = new Viewer({
        accessToken: MAPILLARY_ACCESS_TOKEN,
        container: this.containerId,
        component: {
          cover: false,
          bearing: true,
          zoom: true,
        },
      });

      this.viewer.on('dataloading', (event) => {
        console.log('[GeoGuesser] Mapillary loading:', event.loading);
      });
    } catch (err) {
      console.error('[GeoGuesser] Failed to init MapillaryJS:', err);
      container.innerHTML = `<div class="game__viewer-placeholder">Failed to initialize street view</div>`;
    }
  }

  async showImage(imageId: string) {
    if (!this.viewer) return;
    try {
      console.log('[GeoGuesser] Loading image:', imageId);
      await this.viewer.moveTo(imageId);
      console.log('[GeoGuesser] Image loaded successfully');
    } catch (err) {
      console.error('[GeoGuesser] Failed to load image:', imageId, err);
      // Fallback to iframe embed
      const container = document.getElementById(this.containerId);
      if (container) {
        this.viewer?.remove();
        this.viewer = null;
        container.innerHTML = `<iframe
          src="https://www.mapillary.com/embed?image_key=${imageId}&style=photo"
          style="width:100%;height:100%;border:none;"
          allow="fullscreen"
        ></iframe>`;
      }
    }
  }

  resize() {
    this.viewer?.resize();
  }

  destroy() {
    try {
      this.viewer?.remove();
    } catch {
      // ignore cleanup errors
    }
    this.viewer = null;
  }
}
