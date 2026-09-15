const crypto = require('crypto');

const PRIVATE_KEY = process.env.WHATSAPP_PRIVATE_KEY;
const PASSPHRASE = process.env.WHATSAPP_PASSPHRASE || '';

function decryptRequest(encryptedFlowData, encryptedAesKey, initialVector) {
    const decryptedAesKey = crypto.privateDecrypt(
        {
            key: PRIVATE_KEY,
            passphrase: PASSPHRASE,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        Buffer.from(encryptedAesKey, 'base64')
    );

    const iv = Buffer.from(initialVector, 'base64');
    const ciphertextBuffer = Buffer.from(encryptedFlowData, 'base64');
    
    const authTagLength = 16;
    const authTag = ciphertextBuffer.subarray(ciphertextBuffer.length - authTagLength);
    const actualCiphertext = ciphertextBuffer.subarray(0, ciphertextBuffer.length - authTagLength);

    const decipher = crypto.createDecipheriv('aes-128-gcm', decryptedAesKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(actualCiphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return JSON.parse(decrypted.toString('utf8'));
}

function encryptResponse(responseलData, decryptedAesKey, initialVector) {
    const invertedIv = Buffer.from(initialVector, 'base64').map(b => ~b & 0xff);

    const cipher = crypto.createCipheriv('aes-128-gcm', decryptedAesKey, invertedIv);
    
    let encrypted = cipher.update(JSON.stringify(responseलData), 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();
    const finalBuffer = Buffer.concat([encrypted, authTag]);

    return finalBuffer.toString('base64');
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { encrypted_aes_key, encrypted_flow_data, initial_vector } = req.body;

        const decryptedData = decryptRequest(encrypted_flow_data, encrypted_aes_key, initial_vector);

        const responsePayload = {
            screen: "SUCCESS",
            data: {
                extension_message_response: "Received successfully"
            }
        };

        const decryptedAesKey = crypto.privateDecrypt(
            {
                key: PRIVATE_KEY,
                passphrase: PASSPHRASE,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            Buffer.from(encrypted_aes_key, 'base64')
        );

        const encryptedResponse = encryptResponse(responsePayload, decryptedAesKey, initial_vector);

        return res.status(200).send(encryptedResponse);
    } catch (error) {
        console.error('Flow endpoint error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};