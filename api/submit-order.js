export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method Not Allowed'
    });
  }

  const body = {
    ...req.body,
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
      data = {
        success: false,
        error: 'Invalid response from Apps Script',
        raw: responseText
      };
    }

    return res.status(response.status).json(data);

  } catch (e) {

    return res.status(500).json({
      success: false,
      error: e.message
    });

  }
}