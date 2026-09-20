import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseAdminApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    });

const firebaseAdminAuth = getAuth(firebaseAdminApp);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  if (!process.env.SHEET_URL || !process.env.SHEET_PWD) {
    console.error('submit-order configuration error: missing SHEET_URL or SHEET_PWD');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    });
  }

  const idToken = req.body?.idToken;

  if (!idToken) {
    return res.status(401).json({
      success: false,
      error: 'Missing Firebase ID token'
    });
  }

  let decodedToken;

  try {
    decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Invalid Firebase ID token'
    });
  }

  if (req.body.uid && req.body.uid !== decodedToken.uid) {
    return res.status(401).json({ success: false, error: 'User identity mismatch' });
  }

  if (
    req.body.email &&
    req.body.email.toLowerCase() !== String(decodedToken.email || '').toLowerCase()
  ) {
    return res.status(401).json({ success: false, error: 'User email mismatch' });
  }

  const body = {
    ...req.body,
    uid: decodedToken.uid,
    email: decodedToken.email || '',
    pwd: process.env.SHEET_PWD
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);

  try {
    const response = await fetch(process.env.SHEET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Apps Script returned invalid submit-order response:', {
        status: response.status,
        contentType,
        body: responseText.slice(0, 1000)
      });

      return res.status(502).json({
        success: false,
        error: 'Invalid response from Apps Script',
        upstreamStatus: response.status
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: data?.error || 'Apps Script order request failed',
        upstreamStatus: response.status
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    const isTimeout = e?.name === 'AbortError';

    console.error('submit-order upstream error:', e?.message || e);

    return res.status(isTimeout ? 504 : 502).json({
      success: false,
      error: isTimeout
        ? 'Apps Script order request timed out'
        : 'Failed to submit order to Apps Script'
    });
  } finally {
    clearTimeout(timeout);
  }
}