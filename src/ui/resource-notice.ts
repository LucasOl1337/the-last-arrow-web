/** One compact status for recoverable asset/URL failures; no toast timers or repeated listeners. */
export class ResourceNotice {
  readonly element = document.createElement('div');
  private messages = new Map<string, string>();
  constructor() {
    this.element.className = 'resource-notice'; this.element.setAttribute('role', 'status'); this.element.hidden = true;
  }
  set(key: string, message: string) {
    this.messages.set(key, message);
    this.element.textContent = [...this.messages.values()].join(' · '); this.element.hidden = false;
  }
}
