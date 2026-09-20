import crypto from "node:crypto";

const VERIFY_TOKEN =
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

const WHATSAPP_APP_SECRET =
  process.env.WHATSAPP_APP_SECRET;

const SHEET_URL =
  process.env.SHEET_URL;

const SHEET_PWD =
  process.env.SHEET_PWD;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb"
    }
  }
};

export default async function handler(req, res) {

  // =====================================================
  // Meta webhook verification
  // =====================================================

  if (req.method === "GET") {

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (
      mode === "subscribe" &&
      token === VERIFY_TOKEN
    ) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Forbidden");
  }

  // =====================================================
  // WhatsApp events
  // =====================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const signature = req.headers["x-hub-signature-256"];
    const rawBody = req.rawBody
      ? Buffer.from(req.rawBody)
      : Buffer.from(JSON.stringify(req.body || {}));

    if (!WHATSAPP_APP_SECRET || !signature) {
      return res.status(401).send("Unauthorized");
    }

    const expectedSignature =
      "sha256=" +
      crypto
        .createHmac("sha256", WHATSAPP_APP_SECRET)
        .update(rawBody)
        .digest("hex");

    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return res.status(401).send("Unauthorized");
    }

    const body = req.body;

    console.log(
      "WhatsApp Webhook:",
      JSON.stringify(body)
    );

    const entries = body?.entry || [];

    for (const entry of entries) {

      const changes = entry?.changes || [];

      for (const change of changes) {

        const value = change?.value;

        const messages =
          value?.messages || [];

        for (const message of messages) {

          await processWhatsAppMessage_(message);
        }
      }
    }

    return res.status(200).send("EVENT_RECEIVED");

  } catch (error) {
    console.error(
      "WhatsApp webhook error:",
      error
    );

    return res.status(500).send("Webhook processing failed");
  }
}

async function processWhatsAppMessage_(message) {

  const phone =
    String(message?.from || "");

  const messageId =
    String(message?.id || "");

  const messageType =
    String(message?.type || "");

  const contextMessageId =
    String(
      message?.context?.id || ""
    );

  // =====================================================
  // Flow completion
  // =====================================================

  if (
    messageType === "interactive" &&
    message?.interactive?.type === "nfm_reply"
  ) {

    const nfm =
      message.interactive.nfm_reply;

    let responseData = {};

    try {
      responseData =
        JSON.parse(
          nfm?.response_json || "{}"
        );
    } catch (error) {
      console.error(
        "Invalid Flow response_json:",
        error
      );
    }

    const flowToken =
      String(
        responseData?.flow_token || ""
      );

    const orderId =
      extractOrderIdFromFlowToken_(flowToken);

    const flowType =
      getFlowTypeFromToken_(flowToken);

    await postToSheet_({
      action: "whatsappFlowCompleted",

      orderId,

      phone,

      messageId,

      contextMessageId,

      flowType,

      flowToken,

      flowName:
        nfm?.name || "flow",

      responseData
    });

    return;
  }

  // =====================================================
  // Button reply / quick reply
  // =====================================================

  if (
    messageType === "interactive" &&
    message?.interactive?.type === "button_reply"
  ) {

    const button =
      message.interactive.button_reply;

    await postToSheet_({
      action: "whatsappButtonReply",

      phone,

      messageId,

      contextMessageId,

      buttonId:
        button?.id || "",

      buttonTitle:
        button?.title || ""
    });

    return;
  }

  // =====================================================
  // Text / image / other customer message
  // =====================================================

  await postToSheet_({
    action: "whatsappInboundMessage",

    phone,

    messageId,

    contextMessageId,

    messageType,

    text:
      message?.text?.body ||
      ""
  });
}

function extractOrderIdFromFlowToken_(token) {

  const value = String(token || "");

  const match =
    value.match(
      /^(inspection|delivery|survey)_(.+)$/
    );

  return match
    ? match[2]
    : "";
}

function getFlowTypeFromToken_(token) {

  const value = String(token || "");

  if (value.startsWith("inspection_")) {
    return "معاينة";
  }

  if (value.startsWith("delivery_")) {
    return "تسليم وتركيب";
  }

  if (value.startsWith("survey_")) {
    return "استبيان";
  }

  return "";
}

async function postToSheet_(payload) {

  const response =
    await fetch(SHEET_URL, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        ...payload,
        pwd: SHEET_PWD
      })
    });

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Sheet webhook error ${response.status}: ${text}`
    );
  }

  return text;
}