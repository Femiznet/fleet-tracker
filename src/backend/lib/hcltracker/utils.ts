export const HCL_URL = process.env.HCL_BASE_URL!;

let cachedCookieHeader: string | null = null;

interface QueryHclOptions<T> {
  fetchApiWithCookies: (cookies: string) => Promise<Response>;
  parseResponse?: (res: Response) => Promise<T>;
}

function mergeCookies(existingCookie: string | null, setCookieHeaders: string[]): string {
  const cookieMap = new Map<string, string>();

  if (existingCookie) {
    existingCookie.split('; ').forEach((pair) => {
      const [name, ...rest] = pair.split('=');
      if (name) cookieMap.set(name, rest.join('='));
    });
  }

  for (const header of setCookieHeaders) {
    const firstPart = header.split(';')[0];
    const [name, ...rest] = firstPart.split('=');
    if (name) cookieMap.set(name, rest.join('='));
  }

  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function getCookieValue(cookieHeader: string, name: string): string {
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

async function authenticate(): Promise<string> {
  // 1. Fetch /login to get initial cookies and window.setup.csrf_token
  const loginPageRes = await fetch(`${HCL_URL}/login`, {
    method: 'GET',
    cache: 'no-store',
  });

  const html = await loginPageRes.text();
  const csrfMatch = html.match(/"csrf_token":"([^"]+)"/);
  if (!csrfMatch) {
    throw new Error('Failed to extract CSRF token from login page');
  }

  const csrfToken = csrfMatch[1];
  let cookies = mergeCookies(null, loginPageRes.headers.getSetCookie());
  const xsrfToken = getCookieValue(cookies, 'XSRF-TOKEN');

  // 2. Submit multipart/form-data login to /ui/authentication/store
  const formData = new FormData();
  formData.append('_token', csrfToken);
  formData.append('identifier', process.env.HCL_USER || '');
  formData.append('password', process.env.HCL_PASS || '');
  formData.append('remember_me', '1');
  formData.append('_method', 'post');

  const authRes = await fetch(`${HCL_URL}/ui/authentication/store`, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Origin: HCL_URL,
      Referer: `${HCL_URL}/ui/auth/login`,
      Cookie: cookies,
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': csrfToken,
      'X-XSRF-TOKEN': xsrfToken,
      form: 'true',
    },
    body: formData,
    redirect: 'manual',
    cache: 'no-store',
  });

  cookies = mergeCookies(cookies, authRes.headers.getSetCookie());

  if (authRes.status >= 400) {
    throw new Error(`Authentication failed with status ${authRes.status}`);
  }

  cachedCookieHeader = cookies;
  return cookies;
}

export async function queryHclTracker<T = unknown>({
  fetchApiWithCookies,
  parseResponse,
}: QueryHclOptions<T>) {
  try {
    let cookies = cachedCookieHeader || (await authenticate());
    let returnValue = await fetchApiWithCookies(cookies);

    // If session expired, re-authenticate once and pass the NEW cookies to fetchApiWithCookies
    if (returnValue.status === 401 || returnValue.status === 302) {
      cookies = await authenticate();
      returnValue = await fetchApiWithCookies(cookies);
    }

    // Rotate any updated session cookies returned by the server
    const newCookies = returnValue.headers.getSetCookie();
    if (newCookies.length > 0) {
      cachedCookieHeader = mergeCookies(cookies, newCookies);
    }

    if (!returnValue.ok) {
      throw new Error(`Upstream server returned ${returnValue.status}`);
    }

    // Parse the Response stream (defaults to JSON if no custom parser is provided)
    const data = parseResponse ? await parseResponse(returnValue) : await returnValue.json();

    return data;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Internal server error');
  }
}
