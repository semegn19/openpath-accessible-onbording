/** Declarative attachment to existing host content; one active assistant per document. */
import { RohaSDK } from './index';

export class RohaAgentElement extends HTMLElement {
  private sdk: RohaSDK | null = null;
  private generation = 0;
  static get observedAttributes() { return ['for', 'language', 'api-endpoint']; }
  connectedCallback() { this.scheduleMount(); }
  disconnectedCallback() { this.generation++; this.sdk?.unmount(); this.sdk = null; }
  attributeChangedCallback(_name: string, before: string | null, after: string | null) {
    if (this.isConnected && before !== after) this.scheduleMount();
  }
  private scheduleMount() {
    const generation = ++this.generation;
    // Upgrade can run while the bundle is still initializing or parsing children.
    queueMicrotask(() => {
      if (!this.isConnected || generation !== this.generation) return;
      this.sdk?.unmount(); this.sdk = null;
      const id = this.getAttribute('for');
      const root = id ? document.getElementById(id) : this;
      if (!root || !root.children.length) { this.reportError('target-not-found'); return; }
      // Text and contrast preferences affect the document. Avoid competing owners.
      if (document.querySelector('.roha-aside')) { this.reportError('assistant-already-mounted'); return; }
      this.sdk = new RohaSDK();
      const endpoint = this.getAttribute('api-endpoint');
      if (endpoint) this.sdk.configureAPI({ provider: 'server', endpoint });
      const map = this.sdk.mount({ root, language: this.getAttribute('language') === 'en' ? 'en' : 'am' });
      this.dispatchEvent(new CustomEvent('roha:ready', { bubbles: true, composed: true,
        detail: { mapId: map.mapId, mapVersion: map.mapVersion } }));
    });
  }
  private reportError(code: string) {
    this.dispatchEvent(new CustomEvent('roha:error', { bubbles: true, composed: true, detail: { code } }));
  }
  public getSDK(): RohaSDK | null { return this.sdk; }
}
if (typeof window !== 'undefined' && window.customElements) {
  if (!customElements.get('roha-agent')) customElements.define('roha-agent', RohaAgentElement);
  // Each name needs its own constructor (Custom Elements specification).
  if (!customElements.get('roha-assistant')) customElements.define('roha-assistant', class extends RohaAgentElement {});
}
