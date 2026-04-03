export class MapillaryViewer {
  private containerId: string;
  private wrapper: HTMLDivElement | null = null;

  constructor(containerId: string) {
    this.containerId = containerId;
  }

  init() {
    // Nothing needed on init
  }

  async showImage(imageId: string) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    let lat: number, lng: number;

    if (imageId.includes(',')) {
      const parts = imageId.split(',');
      lat = parseFloat(parts[0]);
      lng = parseFloat(parts[1]);
    } else {
      container.innerHTML = `<iframe
        src="https://www.mapillary.com/embed?image_key=${imageId}&style=photo"
        style="width:100%;height:100%;border:none;"
      ></iframe>`;
      return;
    }

    container.innerHTML = '';

    // Wrapper clips the oversized iframe to hide Google UI
    this.wrapper = document.createElement('div');
    this.wrapper.style.cssText = `
      position: absolute;
      top: -60px;
      left: -10px;
      right: -10px;
      bottom: -40px;
      overflow: hidden;
    `;

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,0,,0,0&output=svembed`;
    iframe.style.cssText = 'width:100%;height:100%;border:none;';
    iframe.allow = 'fullscreen';
    iframe.loading = 'eager';

    this.wrapper.appendChild(iframe);
    container.appendChild(this.wrapper);
  }

  resize() {
    // auto
  }

  destroy() {
    if (this.wrapper) {
      this.wrapper.innerHTML = '';
      this.wrapper = null;
    }
  }
}
