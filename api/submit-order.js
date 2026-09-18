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

  // ابعت للـ GAS من غير ما تستنى
  fetch(process.env.SHEET_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }).catch(e => console.error('GAS error:', e));

  // ارجع للموقع فوراً
  return res.status(200).json({
    success: true,
    orderNum: req.body.orderNum || null
  });
}