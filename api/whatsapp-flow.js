const crypto = require('crypto');

const PRIVATE_KEY = process.env.WHATSAPP_PRIVATE_KEY;
const PASSPHRASE = process.env.WHATSAPP_PASSPHRASE || '';

function generateUpcomingDays() {
    const daysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const monthsArabic = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const options = [];
    const today = new Date();

    for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        const dayName = daysArabic[d.getDay()];
        const monthName = monthsArabic[d.getMonth()];
        const title = `${dayName}، ${d.getDate()} ${monthName}`;
        const id = `day_${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}`;

        options.push({ id, title });
    }

    // إضافة خيار الأيام غير المناسبة في نهاية القائمة
    options.push({ id: 'other_times', title: 'هذه الأيام غير مناسبة لي' });

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
            responsePayload = {
                screen: "WELCOME_SCREEN",
                data: {}
            };
        } 
        else if (action === 'data_exchange' && screen === 'WELCOME_SCREEN') {
            const dynamicDays = generateUpcomingDays();
            responsePayload = {
                screen: "DAY_SCREEN",
                data: {
                    days_list: dynamicDays
                }
            };
        } 
        else if (action === 'data_exchange' && screen === 'DAY_SCREEN') {
            const rawSelected = decryptedData.selected_days || (decryptedData.form && decryptedData.form.selected_days) || (decryptedData.data && decryptedData.data.selected_days) || [];
            
            let selectedDayIds = [];
            if (Array.isArray(rawSelected)) {
                selectedDayIds = rawSelected.map(String);
            } else if (typeof rawSelected === 'object' && rawSelected !== null) {
                selectedDayIds = Object.values(rawSelected).map(String);
            } else if (typeof rawSelected === 'string') {
                selectedDayIds = [rawSelected];
            }

            // لو العميل اختار إن مفيش ولا يوم مناسب (مثلا لو الid المرسل هو other_times أو القائمة فارغة)
            if (selectedDayIds.includes('other_times') || selectedDayIds.length === 0) {
                responsePayload = {
                    screen: "SUCCESS",
                    data: {
                        extension_message_response: {
                            params: {
                                flow_token: flow_token || "default_token",
                                note: "العميل أفاد بأن المواعيد المتاحة غير مناسبة ويحتاج لتواصل لتنسيق موعد آخر."
                            }
                        }
                    }
                };
            } else {
                const allDays = generateUpcomingDays();
                const selectedDaysData = allDays.filter(d => selectedDayIds.includes(String(d.id)));

                responsePayload = {
                    screen: "TIME_SCREEN",
                    data: {
                        day1_title: selectedDaysData[0] ? selectedDaysData[0].title : '',
                        day1_show: Boolean(selectedDaysData[0]),
                        day2_title: selectedDaysData[1] ? selectedDaysData[1].title : '',
                        day2_show: Boolean(selectedDaysData[1]),
                        day3_title: selectedDaysData[2] ? selectedDaysData[2].title : '',
                        day3_show: Boolean(selectedDaysData[2]),
                        day4_title: selectedDaysData[3] ? selectedDaysData[3].title : '',
                        day4_show: Boolean(selectedDaysData[3]),
                        day5_title: selectedDaysData[4] ? selectedDaysData[4].title : '',
                        day5_show: Boolean(selectedDaysData[4])
                    }
                };
            }
        }
        else if (action === 'data_exchange' && screen === 'TIME_SCREEN') {
            const formData = decryptedData.form || {};
            const totalPrice = Number(formData.total_price) || 0;
            const advancePayment = totalPrice * 0.40;

            responsePayload = {
                screen: "SUCCESS",
                data: {
                    advance_amount: advancePayment,
                    extension_message_response: {
                        params: {
                            flow_token: flow_token || "default_token",
                            booking_details: formData,
                            advance_payment: advancePayment
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
        return res.status(200).setHeader('Content-Type', 'text/plain').send(encryptedResponse);
    } catch (error) {
        console.error('Flow endpoint error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};