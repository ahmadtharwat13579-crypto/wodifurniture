export default async function handler(req, res) {
  const path = req.query.path?.join('/') || '';
  const targetUrl = `https://wodi-furniture.firebaseapp.com/__/auth/${path}`;

  const queryString = new URLSearchParams(
    Object.fromEntries(
      Object.entries(req.query).filter(([key]) => key !== 'path')
    )
  ).toString();

  const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  try {
    const response = await fetch(fullUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: 'wodi-furniture.firebaseapp.com',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' 
        ? JSON.stringify(req.body) 
        : undefined,
    });

    const contentType = response.headers.get('content-type');
    const body = await response.text();

    res.setHeader('content-type', contentType || 'text/plain');
    res.status(response.status).send(body);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}