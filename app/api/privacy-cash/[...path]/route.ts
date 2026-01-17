import { NextRequest, NextResponse } from 'next/server';

const PRIVACY_CASH_API = 'https://api3.privacycash.org';

// Extend timeout for this route (deposit can take 60-90 seconds)
export const maxDuration = 300; // 5 minutes max

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If we get a 504/502/503, retry
      if (response.status >= 502 && response.status <= 504 && attempt < maxRetries - 1) {
        console.log(`[Privacy Cash Proxy] Got ${response.status}, retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
        continue;
      }

      return response;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        console.log(`[Privacy Cash Proxy] Fetch error: ${error.message}, retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path.join('/');
  const url = new URL(request.url);
  const queryString = url.search;

  const targetUrl = `${PRIVACY_CASH_API}/${endpoint}${queryString}`;
  console.log(`[Privacy Cash Proxy] GET ${targetUrl}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetchWithRetry(
      targetUrl,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'BooPrivacy/1.0',
        },
        signal: controller.signal,
      },
      3
    );

    clearTimeout(timeoutId);

    const data = await response.text();
    console.log(`[Privacy Cash Proxy] GET response: ${response.status}`);

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error: any) {
    console.error('[Privacy Cash Proxy] GET error:', error.message);

    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 504 });
    }

    return NextResponse.json(
      { error: 'Failed to proxy request', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path.join('/');
  const targetUrl = `${PRIVACY_CASH_API}/${endpoint}`;

  try {
    const body = await request.text();

    console.log(`[Privacy Cash Proxy] POST ${targetUrl}`);
    console.log(`[Privacy Cash Proxy] Body length: ${body.length} bytes`);

    // Use longer timeout for deposit/withdraw (ZK verification takes time on server)
    const timeoutMs = endpoint === 'deposit' || endpoint === 'withdraw' ? 240000 : 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // More retries for deposit/withdraw since they're critical
    const maxRetries = endpoint === 'deposit' || endpoint === 'withdraw' ? 5 : 3;

    const response = await fetchWithRetry(
      targetUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'BooPrivacy/1.0',
        },
        body,
        signal: controller.signal,
      },
      maxRetries,
      3000
    );

    clearTimeout(timeoutId);

    const data = await response.text();

    console.log(`[Privacy Cash Proxy] POST response: ${response.status}`);
    if (response.status >= 400) {
      console.log(`[Privacy Cash Proxy] Error response: ${data.substring(0, 500)}`);
    }

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error: any) {
    console.error('[Privacy Cash Proxy] POST error:', error.message);

    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - Privacy Cash server is not responding. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to proxy request', details: error.message },
      { status: 500 }
    );
  }
}
