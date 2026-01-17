/**
 * Fetch Interceptor for Privacy Cash API
 *
 * Intercepts fetch requests to api3.privacycash.org and routes them
 * through our Next.js API proxy to avoid CORS issues.
 */

const PRIVACY_CASH_API_HOST = 'api3.privacycash.org';
const PROXY_BASE = '/api/privacy-cash';

let isPatched = false;
let originalFetch: typeof fetch;

export function patchFetchForPrivacyCash(): void {
  if (typeof window === 'undefined') return;
  if (isPatched) return;

  originalFetch = window.fetch;
  isPatched = true;

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    let url: string;
    let effectiveInit: RequestInit | undefined = init;

    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
      // Extract properties from Request object when init is not provided
      if (!init) {
        effectiveInit = {
          method: input.method,
          headers: input.headers,
          body: input.body,
          mode: input.mode,
          credentials: input.credentials,
          cache: input.cache,
          redirect: input.redirect,
          referrer: input.referrer,
          referrerPolicy: input.referrerPolicy,
          integrity: input.integrity,
        };
      }
    } else {
      url = String(input);
    }

    // Check if this is a Privacy Cash API request
    if (url.includes(PRIVACY_CASH_API_HOST)) {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        const query = urlObj.search;
        const proxyUrl = `${PROXY_BASE}${path}${query}`;

        console.log(`[Fetch Interceptor] Proxying ${url} -> ${proxyUrl}`);

        // Merge headers if effectiveInit exists
        const headers = new Headers(effectiveInit?.headers);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }

        return originalFetch(proxyUrl, {
          ...effectiveInit,
          headers,
        });
      } catch (error) {
        console.error('[Fetch Interceptor] Error proxying request:', error);
        // Fall through to original fetch
      }
    }

    return originalFetch(input, init);
  };

  console.log('[Fetch Interceptor] Privacy Cash API proxy enabled');
}

export function restoreOriginalFetch(): void {
  if (typeof window === 'undefined') return;
  if (!isPatched) return;

  window.fetch = originalFetch;
  isPatched = false;

  console.log('[Fetch Interceptor] Original fetch restored');
}
