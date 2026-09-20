export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  const { action, email, orderNum } = req.query;
  const sheetUrl = process.env.SHEET_URL;
  const sheetPassword = process.env.SHEET_PWD;

  if (!sheetUrl || !sheetPassword) {
    console.error('get-config configuration error: missing SHEET_URL or SHEET_PWD');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    });
  }

  const url = new URL(sheetUrl);
  url.searchParams.set('pwd', sheetPassword);

  if (action) url.searchParams.set('action', String(action));
  if (email) url.searchParams.set('email', String(email));
  if (orderNum) url.searchParams.set('orderNum', String(orderNum));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';

    console.log('Apps Script status:', response.status);
    console.log('Apps Script content-type:', contentType);

    let data;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Apps Script returned non-JSON response:', {
        status: response.status,
        contentType,
        body: text.slice(0, 1000)
      });

      return res.status(502).json({
        success: false,
        error: 'Apps Script returned an invalid response',
        upstreamStatus: response.status
      });
    }

    if (!response.ok) {
      console.error('Apps Script returned HTTP error:', response.status, data);

      return res.status(502).json({
        success: false,
        error: 'Apps Script request failed',
        upstreamStatus: response.status,
        upstreamError: data?.error || null
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';

    console.error('get-config error:', {
      action: action || 'configurator',
      error: err?.message || String(err),
      timeout: isTimeout
    });

    return res.status(isTimeout ? 504 : 502).json({
      success: false,
      error: isTimeout
        ? 'Apps Script request timed out'
        : 'Failed to fetch data from Apps Script'
    });
  } finally {
    clearTimeout(timeout);
  }
}