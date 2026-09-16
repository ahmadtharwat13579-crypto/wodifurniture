const crypto = require('crypto');
const fs = require('fs');

const phoneNumberId = process.env.PHONE_NUMBER_ID || "1306289112568774";
const token = process.env.SYSTEM_USER_TOKEN;

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

fs.writeFileSync('private_pkcs8.pem', privateKey);
fs.writeFileSync('public.pem', publicKey);
console.log('Keys generated and saved successfully!');

async function uploadKey() {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/whatsapp_business_encryption`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        business_public_key: publicKey
      })
    });

    const data = await response.json();
    console.log("Meta API Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error uploading key:", err);
  }
}

uploadKey();