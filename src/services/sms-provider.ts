export interface SmsMessage {
  readonly recipient: string;
  readonly message: string;
}

export interface SmsProviderResult {
  readonly provider: "msg91";
  readonly messageId: string | null;
  readonly accepted: boolean;
  readonly providerResponse: unknown;
}

/**
 * Server-only MSG91 adapter. This function is intentionally not called by the
 * manual risk-check flow. Do not run a real test without separate explicit approval.
 */
export async function sendPreCrisisSms(message: SmsMessage): Promise<SmsProviderResult> {
  if (process.env.PRECRISIS_SMS_SEND_ENABLED !== "true") {
    throw new Error("SMS sending is disabled. Do not enable or test real sending without separate explicit approval.");
  }
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const senderId = process.env.MSG91_SENDER_ID;
  if (!authKey || !templateId || !senderId) {
    throw new Error("MSG91 is not configured. Set MSG91_AUTH_KEY, MSG91_TEMPLATE_ID and MSG91_SENDER_ID on the server.");
  }
  if (!/^\+?[1-9]\d{7,14}$/.test(message.recipient)) throw new Error("Recipient must be an international-format phone number.");
  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: { authkey: authKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: templateId,
      sender: senderId,
      mobiles: message.recipient.replace("+", ""),
      VAR1: message.message.slice(0, 900),
    }),
  });
  const providerResponse: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("MSG91 request failed (" + response.status + ").");
  const responseObject = providerResponse && typeof providerResponse === "object" ? providerResponse as Record<string, unknown> : {};
  const messageId = typeof responseObject.request_id === "string" ? responseObject.request_id : typeof responseObject.message === "string" ? responseObject.message : null;
  return { provider: "msg91", messageId, accepted: true, providerResponse };
}
