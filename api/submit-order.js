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
      error: 'Method Not Allowed'
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

  if (req.body.email && req.body.email.toLowerCase() !== String(decodedToken.email || '').toLowerCase()) {
    return res.status(401).json({ success: false, error: 'User email mismatch' });
  }

  const body = {
    ...req.body,
    uid: decodedToken.uid,
    email: decodedToken.email || '',
    pwd: process.env.SHEET_PWD
  };

  try {

    const response = await fetch(process.env.SHEET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
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

    return res.status(500).json({
      success: false,
      error: e.message
    });

  }

}