import type { gmail_v1 } from '@googleapis/gmail';

export function header(msg: gmail_v1.Schema$Message, name: string): string {
  return (
    msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''
  );
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/** Tìm part text/html đầu tiên (đệ quy qua multipart). Trả về body data hoặc attachmentId nếu body lớn. */
function findHtmlPart(
  part: gmail_v1.Schema$MessagePart | undefined,
): gmail_v1.Schema$MessagePart | undefined {
  if (!part) return undefined;
  if (part.mimeType === 'text/html' && (part.body?.data || part.body?.attachmentId)) return part;
  for (const p of part.parts ?? []) {
    const found = findHtmlPart(p);
    if (found) return found;
  }
  return undefined;
}

export async function extractHtml(
  client: gmail_v1.Gmail,
  msg: gmail_v1.Schema$Message,
  beforeRequest: () => Promise<void>,
): Promise<string | null> {
  const part = findHtmlPart(msg.payload);
  if (!part?.body) return null;
  if (part.body.data) return decodeBase64Url(part.body.data);
  if (part.body.attachmentId && msg.id) {
    await beforeRequest();
    const res = await client.users.messages.attachments.get({
      userId: 'me',
      messageId: msg.id,
      id: part.body.attachmentId,
    });
    return res.data.data ? decodeBase64Url(res.data.data) : null;
  }
  return null;
}
