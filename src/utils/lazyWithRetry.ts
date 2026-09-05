import { lazy, ComponentType } from 'react';

/**
 * Enhanced lazy loader that automatically retries dynamic imports if a network glitch
 * or deployment/cache staleness occurs ("Failed to fetch dynamically imported module").
 * If retry fails after retries, reloads the page once to pull the fresh build chunks.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retries = 2,
  interval = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const pageHasBeenForceReloaded = window.sessionStorage.getItem('page_reloaded_for_chunk_error');

    for (let i = 0; i < retries; i++) {
      try {
        const component = await componentImport();
        // Clear flag if import succeeded
        if (pageHasBeenForceReloaded) {
          window.sessionStorage.removeItem('page_reloaded_for_chunk_error');
        }
        return component;
      } catch (error: any) {
        console.warn(`Dynamic import failed (attempt ${i + 1}/${retries}). Retrying...`, error);
        
        // Wait interval before retrying
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }
    }

    // If all retries failed and we haven't reloaded yet, trigger a clean reload to clear stale chunk hashes
    if (!pageHasBeenForceReloaded) {
      window.sessionStorage.setItem('page_reloaded_for_chunk_error', 'true');
      console.warn('Reloading window due to dynamic module chunk failure...');
      window.location.reload();
      return new Promise(() => {}); // Never resolves, page is reloading
    }

    // If reload already happened and it still fails, execute normal fallback import to throw the original error
    return componentImport();
  });
}
