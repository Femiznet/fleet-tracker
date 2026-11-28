export function cronAuthorizationError(request: Request): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json(
      { ok: false, error: 'CRON_SECRET is not set' },
      { status: 500 },
    );
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  return null;
}
