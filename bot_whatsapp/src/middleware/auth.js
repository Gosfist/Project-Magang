export function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.BOT_API_KEY) {
    return res.status(401).json({ message: 'API key tidak valid.' });
  }
  next();
}

export async function jwtAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token tidak ditemukan.' });
  }
  try {
    const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
    const response = await fetch(`${backendUrl}/api/auth/me`, {
      headers: { Authorization: header },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401) return res.status(401).json({ message: 'Token tidak valid atau kedaluwarsa.' });
    if (!response.ok) return res.status(503).json({ message: 'Verifikasi akses tidak tersedia.' });
    const { user } = await response.json();
    if (user?.role !== 'admin') return res.status(403).json({ message: 'Fitur ini hanya untuk admin.' });
    req.user = user;
    next();
  } catch {
    return res.status(503).json({ message: 'Verifikasi akses tidak tersedia.' });
  }
}
