import PostalMime from "postal-mime";

function toBase64(data) {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default {
  async email(message, env) {
    const parser = new PostalMime();
    const parsed = await parser.parse(message.raw);

    const headers = {};
    for (const [key, value] of message.headers) headers[key] = value;

    const attachments = (parsed.attachments || []).map((att) => ({
      filename: att.filename || "attachment",
      content_type: att.mimeType || "application/octet-stream",
      content: toBase64(att.content),
    }));

    const payload = {
      message_id: message.headers.get("message-id") || parsed.messageId || null,
      from: message.from,
      to: [message.to],
      cc: (parsed.cc || []).map((address) => address.address).filter(Boolean),
      subject: message.headers.get("subject") || parsed.subject || "(no subject)",
      html: parsed.html || null,
      text: parsed.text || null,
      headers,
      attachments,
      created_at: new Date().toISOString(),
    };

    const res = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.EMAIL_INBOUND_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Webhook rejected inbound email: ${res.status} ${body}`);
    }
  },
};
