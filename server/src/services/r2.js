import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";

const ALLOWED_TYPES = new Set([
  "image/avif",
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
]);

const TYPE_TO_EXT = {
  "image/avif": "avif",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

const r2Client = new S3Client({
  region: "auto",
  endpoint: env.r2.accountId ? `https://${env.r2.accountId}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId: env.r2.accessKeyId,
    secretAccessKey: env.r2.secretAccessKey,
  },
});

export function isOwnR2Url(url) {
  if (typeof url !== "string") return false;
  if (env.r2.publicUrl && url.startsWith(`${env.r2.publicUrl}/`)) {
    return true;
  }
  return false;
}

export function isOwnMediaUrl(url) {
  if (typeof url !== "string") return false;
  return isOwnR2Url(url) || url.startsWith(`https://res.cloudinary.com/`);
}

export async function createPresignedUpload({ userId, contentType, maxBytes = 52428800 }) {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error("Invalid content type");
  }

  const ext = TYPE_TO_EXT[contentType];
  const key = `uploads/${userId}/${Date.now()}_${newId()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.r2.bucketName,
    Key: key,
    ContentType: contentType,
    ContentLengthRange: [0, maxBytes],
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });
  const publicUrl = env.r2.publicUrl ? `${env.r2.publicUrl}/${key}` : uploadUrl.split("?")[0];

  return { uploadUrl, publicUrl, key };
}

export async function uploadR2Buffer({ key, buffer, contentType }) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.r2.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
    })
  );
  return key;
}

export async function getR2Object(key) {
  const result = await r2Client.send(new GetObjectCommand({ Bucket: env.r2.bucketName, Key: key }));
  return { body: result.Body, contentType: result.ContentType, contentLength: result.ContentLength };
}

export async function isAssetReferenced(url) {
  const [inUsePost, inUseUser, inUseStory, inUseCommunity, inUseMessage, inUseBizApp] = await Promise.all([
    prisma.post.count({ where: { mediaUrl: url, deleted: false } }),
    prisma.user.count({ where: { OR: [{ avatarUrl: url }, { bannerUrl: url }] } }),
    prisma.story.count({ where: { mediaUrl: url } }),
    prisma.community.count({ where: { logoUrl: url } }),
    prisma.message.count({ where: { mediaUrl: url } }),
    prisma.businessApplication.count({ where: { OR: [{ logoUrl: url }, { bannerUrl: url }] } }),
  ]);

  return inUsePost + inUseUser + inUseStory + inUseCommunity + inUseMessage + inUseBizApp > 0;
}

export async function deleteR2Asset(url) {
  if (!isOwnR2Url(url)) return;

  if (await isAssetReferenced(url)) return;

  const key = url.replace(`${env.r2.publicUrl}/`, "");
  if (!key) return;

  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: env.r2.bucketName,
        Key: key,
      })
    );
  } catch (err) {
    console.error("Failed to delete R2 asset", key, err.message);
  }
}
