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

    this.viewer = new Viewer({
      accessToken: MAPILLARY_ACCESS_TOKEN,
      container: this.containerId,
      component: {
        cover: false,
      },
    });
  }

  async showImage(imageId: string) {
    if (!this.viewer) return;
    try {
      await this.viewer.moveTo(imageId);
    } catch (err) {
      console.error('Failed to load Mapillary image:', err);
      const container = document.getElementById(this.containerId);
      if (container) {
        container.innerHTML = `
          <div class="game__viewer-placeholder">
            Failed to load street view. Image may be unavailable.
          </div>
        `;
      }
    }
  }

  resize() {
    this.viewer?.resize();
  }

  destroy() {
    this.viewer?.remove();
    this.viewer = null;
  }
}
