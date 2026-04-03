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
    // Top overlay — covers location name, "View on Google Maps" link, pin icon
    const overlayTop = document.createElement('div');
    overlayTop.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 250px;
      height: 70px;
      background: rgba(10,10,26,0.98);
      z-index: 10;
      pointer-events: auto;
    `;
    container.appendChild(overlayTop);

    // Bottom overlay — covers Google logo, copyright, "Report a problem"
    const overlayBottom = document.createElement('div');
    overlayBottom.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 30px;
      background: rgba(10,10,26,0.98);
      z-index: 10;
      pointer-events: auto;
    `;
    container.appendChild(overlayBottom);
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
