import { auth } from '../firebase';

/**
 * Fetch wrapper that automatically attaches the current authenticated user's
 * Firebase ID Token in the Authorization header: `Bearer <token>`.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token = '';
  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('Failed to obtain Firebase ID token for authFetch:', e);
    }
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
