/**
 * Roha - Live Target Registry
 * Features: D03, D04, P01
 * Maintains local references to real DOM elements.
 * DOM elements are NEVER exported to public JSON maps.
 */

export class TargetRegistry {
  private targets: Map<string, Element> = new Map();
  private elementToId: WeakMap<Element, string> = new WeakMap();
  private mapId: string;
  private mapVersion: number;

  constructor(mapId: string, mapVersion: number = 1) {
    this.mapId = mapId;
    this.mapVersion = mapVersion;
  }

  public getMapId(): string {
    return this.mapId;
  }

  public getMapVersion(): number {
    return this.mapVersion;
  }

  public updateVersion(version: number): void {
    this.mapVersion = version;
  }

  public register(id: string, element: Element): void {
    this.targets.set(id, element);
    this.elementToId.set(element, id);
  }

  public getElement(id: string): Element | undefined {
    const el = this.targets.get(id);
    if (!el) return undefined;
    // Verify element is still connected to document
    if (!el.isConnected) {
      this.targets.delete(id);
      return undefined;
    }
    return el;
  }

  public getId(element: Element): string | undefined {
    return this.elementToId.get(element);
  }

  public has(id: string): boolean {
    const el = this.targets.get(id);
    if (!el) return false;
    if (!el.isConnected) {
      this.targets.delete(id);
      return false;
    }
    return true;
  }

  public clear(): void {
    this.targets.clear();
  }

  public getAllRegisteredIds(): string[] {
    const validIds: string[] = [];
    for (const [id, el] of this.targets.entries()) {
      if (el.isConnected) {
        validIds.push(id);
      } else {
        this.targets.delete(id);
      }
    }
    return validIds;
  }
}

