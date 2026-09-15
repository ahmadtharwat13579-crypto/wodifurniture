const crypto = require('crypto');

const PRIVATE_KEY = process.env.WHATSAPP_PRIVATE_KEY;
const PASSPHRASE = process.env.WHATSAPP_PASSPHRASE || '';

// دالة لتوليد الأيام السبعة القادمة بدءاً من اليوم الحالي
function generateUpcomingDays() {
    const daysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const options = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        const dayName = daysArabic[d.getDay()];
        const dayDate = `${d.getDate()}/${d.getMonth() + 1}`;
        const title = `${dayName} (${dayDate})`;
        const id = `day_${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}`;

        options.push({ id, title });
    }
    return options;
}

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

    return {
        decryptedData: JSON.parse(decrypted.toString('utf8')),
        decryptedAesKey: decryptedAesKey
    };
}

function encryptResponse(responseData, decryptedAesKey, initialVector) {
    const invertedIv = Buffer.from(initialVector, 'base64').map(b => ~b & 0xff);
    const cipher = crypto.createCipheriv('aes-128-gcm', decryptedAesKey, invertedIv);
    
    let encrypted = cipher.update(JSON.stringify(responseData), 'utf8');
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
        const { decryptedData, decryptedAesKey } = decryptRequest(encrypted_flow_data, encrypted_aes_key, initial_vector);

        let responsePayload;
        const { action, screen, data, flow_token } = decryptedData;

        if (action === 'ping') {
            responsePayload = {
                data: { status: "active" }
            };
        } 
        else if (action === 'INIT') {
            // توليد الأيام السبعة ابتداءً من اليوم وتمريرها للشاشة الأولى
            const dynamicDays = generateUpcomingDays();
            responsePayload = {
                screen: "DAY_SCREEN",
                data: {
                    days_list: dynamicDays
                }
            };
        } 
        else if (action === 'data_exchange') {
            if (screen === 'DAY_SCREEN') {
                const selectedDays = data ? data.selected_days : [];
                
                // تمرير الأيام المختارة فقط للشاشة الثانية
                responsePayload = {
                    screen: "TIME_SCREEN",
                    data: {
                        selected_days_info: selectedDays
                    }
                };
            } else if (screen === 'TIME_SCREEN') {
                // استلام المواعيد المكتوبة وإتمام الفلو
                responsePayload = {
                    screen: "SUCCESS",
                    data: {
                        extension_message_response: {
                            params: {
                                flow_token: flow_token || "default_token",
                                booking_data: data
                            }
                        }
                    }
                };
            } else {
                responsePayload = {
                    screen: "SUCCESS",
                    data: {
                        extension_message_response: {
                            params: { flow_token: flow_token || "default_token" }
                        }
                    }
                };
            }
        } 
        else if (action === 'BACK') {
            const dynamicDays = generateUpcomingDays();
            responsePayload = {
                screen: "DAY_SCREEN",
                data: { days_list: dynamicDays }
            };
        } else {
            responsePayload = {
                screen: "SUCCESS",
                data: {
                    extension_message_response: "Received successfully"
                }
            };
        }

        const encryptedResponse = encryptResponse(responsePayload, decryptedAesKey, initial_vector);
        return res.status(200).send(encryptedResponse);
    } catch (error) {
        console.error('Flow endpoint error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};