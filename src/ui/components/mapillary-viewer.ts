export class MapillaryViewer {
  private containerId: string;
  private iframe: HTMLIFrameElement | null = null;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  init() {
    // Nothing needed on init
  }

  async showImage(imageId: string) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // imageId format: "lat,lng" — we use coordinates for Google Street View
    // For backward compat, also accept Mapillary IDs (numeric)
    let lat: number, lng: number;

    if (imageId.includes(',')) {
      const parts = imageId.split(',');
      lat = parseFloat(parts[0]);
      lng = parseFloat(parts[1]);
    } else {
      // Fallback: use Mapillary embed
      container.innerHTML = '';
      this.iframe = document.createElement('iframe');
      this.iframe.src = `https://www.mapillary.com/embed?image_key=${imageId}&style=photo`;
      this.iframe.style.cssText = 'width:100%;height:100%;border:none;';
      container.appendChild(this.iframe);
      return;
    }

    container.innerHTML = '';

    // Google Street View embed — free, no API key needed
    this.iframe = document.createElement('iframe');
    this.iframe.src = `https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,0,,0,0&output=svembed`;
    this.iframe.style.cssText = 'width:100%;height:100%;border:none;';
    this.iframe.allow = 'fullscreen';
    this.iframe.loading = 'eager';

    container.appendChild(this.iframe);

    // Hide Google UI elements that show location name (spoilers!)
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 50px;
      background: linear-gradient(to bottom, rgba(10,10,26,0.95) 0%, rgba(10,10,26,0.7) 60%, transparent 100%);
      pointer-events: none;
      z-index: 10;
    `;
    container.appendChild(overlay);
  }

  resize() {
    // iframe auto-resizes
  }

  destroy() {
    if (this.iframe) {
      this.iframe.src = '';
      this.iframe = null;
    }
  }
}
