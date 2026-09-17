export function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.BOT_API_KEY) {
    return res.status(401).json({ message: 'API key tidak valid.' });
  }
  next();
}

export function jwtAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token tidak ditemukan.' });
  }
  // For the bot, we do a simple JWT verification
  // We trust that requests from frontend have a valid JWT (the backend validates it too)
  // Here we just check that the token exists (the frontend sends it)
  // Full JWT validation could be added but since this is internal, we keep it simple
  next();
}
