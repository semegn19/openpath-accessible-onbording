/**
 * Roha - Dynamic Page & Route Observer
 * Feature: D04
 * Observes DOM mutations and route transitions with debouncing.
 * Never steals focus; triggers rescans only when relevant DOM changes occur.
 */

export interface ObserverCallbacks {
  onMutation: () => void;
  onRouteChange: (newRoute: string) => void;
}

export class PageObserver {
  private observer: MutationObserver | null = null;
  private debounceTimer: any = null;
  private callbacks: ObserverCallbacks;
  private isObserving: boolean = false;
  private debounceMs: number;

  constructor(callbacks: ObserverCallbacks, debounceMs: number = 300) {
    this.callbacks = callbacks;
    this.debounceMs = debounceMs;
  }

  public observe(root: Element = document.body): void {
    if (this.isObserving) return;

    if (typeof window !== 'undefined' && 'MutationObserver' in window) {
      this.observer = new MutationObserver((mutations) => {
        let shouldRescan = false;

        for (const m of mutations) {
          // Ignore mutations inside Roha UI
          const target = m.target as Element;
          if (
            target.closest?.('[data-roha-ignore]') ||
            target.hasAttribute?.('data-roha-ignore') ||
            target.closest?.('[data-roha-assistant]')
          ) {
            continue;
          }

          if (m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
            shouldRescan = true;
            break;
          }

          if (m.type === 'attributes' && ['hidden', 'aria-hidden', 'disabled', 'class'].includes(m.attributeName || '')) {
            shouldRescan = true;
            break;
          }
        }

        if (shouldRescan) {
          this.triggerDebouncedMutation();
        }
      });

      this.observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'aria-hidden', 'disabled', 'class', 'style'],
      });

      // Route change listeners
      window.addEventListener('popstate', this.handleRouteEvent);
      window.addEventListener('hashchange', this.handleRouteEvent);

      this.isObserving = true;
    }
  }

  public disconnect(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handleRouteEvent);
      window.removeEventListener('hashchange', this.handleRouteEvent);
    }

    this.isObserving = false;
  }

  private triggerDebouncedMutation(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.callbacks.onMutation();
      this.debounceTimer = null;
    }, this.debounceMs);
  }

  private handleRouteEvent = (): void => {
    const route = window.location.pathname + window.location.hash;
    this.callbacks.onRouteChange(route);
  };
}

