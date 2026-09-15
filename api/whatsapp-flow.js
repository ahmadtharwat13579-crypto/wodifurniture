const crypto = require('crypto');

const PRIVATE_KEY = process.env.WHATSAPP_PRIVATE_KEY;
const PASSPHRASE = process.env.WHATSAPP_PASSPHRASE || '';

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
            const dynamicDays = generateUpcomingDays();
            responsePayload = {
                screen: "DAY_SCREEN",
                data: {
                    days_list: dynamicDays
                }
            };
        } 
        else if (action === 'data_exchange' && screen === 'DAY_SCREEN') {
            const formValues = decryptedData.form || {};
            const selectedDayIds = formValues.selected_days || [];
            
            const allDays = generateUpcomingDays();
            const selectedDaysData = allDays.filter(d => selectedDayIds.includes(d.id));

            responsePayload = {
                screen: "TIME_SCREEN",
                data: {
                    day1_title: selectedDaysData[0] ? selectedDaysData[0].title : 'غير متاح',
                    day1_show: !!selectedDaysData[0],
                    day2_title: selectedDaysData[1] ? selectedDaysData[1].title : 'غير متاح',
                    day2_show: !!selectedDaysData[1],
                    day3_title: selectedDaysData[2] ? selectedDaysData[2].title : 'غير متاح',
                    day3_show: !!selectedDaysData[2],
                    day4_title: selectedDaysData[3] ? selectedDaysData[3].title : 'غير متاح',
                    day4_show: !!selectedDaysData[3],
                    day5_title: selectedDaysData[4] ? selectedDaysData[4].title : 'غير متاح',
                    day5_show: !!selectedDaysData[4],
                    day6_title: selectedDaysData[5] ? selectedDaysData[5].title : 'غير متاح',
                    day6_show: !!selectedDaysData[5],
                    day7_title: selectedDaysData[6] ? selectedDaysData[6].title : 'غير متاح',
                    day7_show: !!selectedDaysData[6]
                }
            };
        }
        else if (action === 'data_exchange' && screen === 'TIME_SCREEN') {
            responsePayload = {
                screen: "SUCCESS",
                data: {
                    extension_message_response: {
                        params: {
                            flow_token: flow_token || "default_token",
                            booking_details: decryptedData.form || {}
                        }
                    }
                }
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