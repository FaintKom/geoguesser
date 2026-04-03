export class MapillaryViewer {
  private containerId: string;
  private iframe: HTMLIFrameElement | null = null;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  init() {
    // Nothing to do on init — iframe is created in showImage
  }

  async showImage(imageId: string) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Clear any previous content
    container.innerHTML = '';

    // Create iframe embed
    this.iframe = document.createElement('iframe');
    this.iframe.src = `https://www.mapillary.com/embed?image_key=${imageId}&style=photo`;
    this.iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    this.iframe.allow = 'fullscreen';
    this.iframe.loading = 'eager';

    container.appendChild(this.iframe);
  }

  resize() {
    // iframe auto-resizes with CSS 100%
  }

  destroy() {
    if (this.iframe) {
      this.iframe.src = '';
      this.iframe = null;
    }
  }
}
