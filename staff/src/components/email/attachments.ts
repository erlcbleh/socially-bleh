export const MAX_OUTBOUND_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export interface OutboundAttachment {
  filename: string;
  contentType: string;
  data: string;
}

export function validateAttachmentFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return "Only PNG, JPEG, GIF, or WebP images can be attached.";
  if (file.size > MAX_ATTACHMENT_BYTES) return "Each image must be under 15MB.";
  return null;
}

export function fileToAttachment(file: File): Promise<OutboundAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve({ filename: file.name, contentType: file.type, data: result.slice(result.indexOf(",") + 1) });
    };
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });
}
