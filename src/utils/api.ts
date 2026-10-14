import { auth } from '../firebase';

export interface AuthFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  idempotencyKey?: string;
}

/**
 * Enhanced fetch wrapper providing:
 * 1. Automatic Firebase ID Token attachment (`Bearer <token>`)
 * 2. 10-second timeout enforcement via AbortController
 * 3. Exponential backoff with jitter on network failures and 5xx server errors
 * 4. Safe retry policy for idempotent requests (GET, HEAD, or with idempotencyKey)
 * 5. Human-friendly error normalization
 */
export async function authFetch(url: string, options: AuthFetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = 10000,
    maxRetries = 2,
    baseRetryDelayMs = 500,
    idempotencyKey,
    ...fetchInit
  } = options;

  let token = '';
  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('Failed to obtain Firebase ID token for authFetch:', e);
    }
  }

  const headers = new Headers(fetchInit.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (idempotencyKey) {
    headers.set('x-idempotency-key', idempotencyKey);
  }

  // Idempotent requests can safely be retried automatically
  const method = (fetchInit.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || Boolean(idempotencyKey);
  const totalAttempts = isIdempotent ? Math.max(1, maxRetries + 1) : 1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    // Quick offline check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('You appear to be offline. Please check your internet connection.');
    }

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // Combine user signal with our timeout signal
    let combinedSignal = controller.signal;
    if (fetchInit.signal) {
      fetchInit.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        ...fetchInit,
        headers,
        signal: combinedSignal,
      });

      clearTimeout(timeoutTimer);

      // Transient server gateway errors (502, 503, 504) trigger backoff retry if idempotent
      if (isIdempotent && [502, 503, 504].includes(response.status) && attempt < totalAttempts - 1) {
        const jitter = Math.floor(Math.random() * 200);
        const backoffDelay = (baseRetryDelayMs * Math.pow(2, attempt)) + jitter;
        console.warn(`[authFetch] Transient HTTP ${response.status}. Retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${totalAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutTimer);

      const isAbort = err.name === 'AbortError';
      const isNetworkError = err instanceof TypeError || err.message?.includes('Failed to fetch') || err.message?.includes('network');

      if (isAbort) {
        lastError = new Error(`Network request timed out after ${Math.round(timeoutMs / 1000)}s. Please check your connection.`);
      } else if (isNetworkError) {
        lastError = new Error('Network connection failed. Please verify your internet connection.');
      } else {
        lastError = err;
      }

      if (isIdempotent && attempt < totalAttempts - 1) {
        const jitter = Math.floor(Math.random() * 200);
        const backoffDelay = (baseRetryDelayMs * Math.pow(2, attempt)) + jitter;
        console.warn(`[authFetch] Retrying after error: "${lastError?.message}". Waiting ${backoffDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        continue;
      }

      throw lastError || new Error('Request failed. Please try again.');
    }
  }

  throw lastError || new Error('Request failed after maximum retry attempts.');
}
