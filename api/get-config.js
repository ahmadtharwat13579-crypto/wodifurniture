export default async function handler(req, res) {

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method Not Allowed'
    });
  }

  const {
    action,
    email,
    orderNum
  } = req.query;

  let url =
    `${process.env.SHEET_URL}?pwd=${encodeURIComponent(process.env.SHEET_PWD)}`;

  if (action) {
    url += `&action=${encodeURIComponent(action)}`;
  }

  if (email) {
    url += `&email=${encodeURIComponent(email)}`;
  }

  if (orderNum) {
    url += `&orderNum=${encodeURIComponent(orderNum)}`;
  }

  try {

    const response = await fetch(url);

    const text = await response.text();

    console.log('Apps Script status:', response.status);
    console.log('Apps Script content-type:', response.headers.get('content-type'));
    console.log('Apps Script response:', text.slice(0, 500));

    let data;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('Apps Script returned non-JSON response:', text.slice(0, 1000));

      return res.status(502).json({
        error: 'Apps Script returned non-JSON response',
        status: response.status
      });
    }

    return res.status(200).json(data);

  } catch (err) {

    console.error('get-config error:', err);

    return res.status(500).json({
      error: 'Failed to fetch data'
    });
  }
}