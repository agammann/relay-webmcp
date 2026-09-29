export const sessionCookie = 'relay_workspace';
export async function readSession(request: Request, allowCreate: boolean) {
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookie}=`))
    ?.slice(sessionCookie.length + 1);
  const existing = cookie && /^[a-f0-9]{64}$/.test(cookie) ? cookie : null;
  if (!existing && !allowCreate) return null;
  const token =
    existing ??
    [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  const id = [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return {
    id,
    cookie: `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`,
  };
}
