import crypto from "crypto";
import axios from "axios";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";

const FOLDER = "socially/posts";
const ALLOWED_FORMATS = "jpg,jpeg,png,gif,webp,mp4,mov,webm";
const MAX_DIMENSION = 2000;
const TRANSFORMATION = `w_${MAX_DIMENSION},h_${MAX_DIMENSION},c_limit,q_auto,f_auto`;
const DESTROY_TIMEOUT_MS = 10_000;

export function parseCloudinaryUrl(url) {
  const match = url?.match(/\/(image|video)\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+(?:\?.*)?$/);
  if (!match) return null;
  return { resourceType: match[1], publicId: match[2] };
}

export function signUpload() {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    allowed_formats: ALLOWED_FORMATS,
    folder: FOLDER,
    timestamp,
    transformation: TRANSFORMATION,
  };

  const toSign = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");

  const signature = crypto
    .createHash("sha1")
    .update(`${toSign}${env.cloudinary.apiSecret}`)
    .digest("hex");

  return {
    timestamp,
    signature,
    apiKey: env.cloudinary.apiKey,
    cloudName: env.cloudinary.cloudName,
    folder: FOLDER,
    allowedFormats: ALLOWED_FORMATS,
    transformation: TRANSFORMATION,
  };
}

export function isOwnCloudinaryUrl(url) {
  return typeof url === "string" && url.startsWith(`https://res.cloudinary.com/${env.cloudinary.cloudName}/`);
}

const FRAME_COUNT = 5;
const MODERATION_TRANSFORM = "w_1024,c_limit,q_auto";

export function videoFrameUrls(url, count = FRAME_COUNT) {
  if (!isOwnCloudinaryUrl(url)) return [];

  const parsed = parseCloudinaryUrl(url);
  if (!parsed || parsed.resourceType !== "video") return [];

  return Array.from({ length: count }, (_, i) => {
    const percent = Math.round(((i + 1) / (count + 1)) * 100);
    return `https://res.cloudinary.com/${env.cloudinary.cloudName}/video/upload/so_${percent}p,${MODERATION_TRANSFORM}/${parsed.publicId}.jpg`;
  });
}

export function moderationImageUrl(url) {
  if (!isOwnCloudinaryUrl(url)) return url;
  return url.replace("/upload/", `/upload/${MODERATION_TRANSFORM}/`);
}

export async function isAssetReferenced(url) {
  const [inUsePost, inUseUser, inUseStory, inUseCommunity, inUseMessage] = await Promise.all([
    prisma.post.count({ where: { mediaUrl: url, deleted: false } }),
    prisma.user.count({ where: { OR: [{ avatarUrl: url }, { bannerUrl: url }] } }),
    prisma.story.count({ where: { mediaUrl: url } }),
    prisma.community.count({ where: { logoUrl: url } }),
    prisma.message.count({ where: { mediaUrl: url } }),
  ]);

  return inUsePost + inUseUser + inUseStory + inUseCommunity + inUseMessage > 0;
}

export async function deleteCloudinaryAsset(url) {
  if (!isOwnCloudinaryUrl(url)) return;

  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return;
  if (await isAssetReferenced(url)) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { public_id: parsed.publicId, timestamp };
  const toSign = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");

  const signature = crypto
    .createHash("sha1")
    .update(`${toSign}${env.cloudinary.apiSecret}`)
    .digest("hex");

  try {
    await axios.post(
      `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/${parsed.resourceType}/destroy`,
      {
        public_id: parsed.publicId,
        timestamp,
        api_key: env.cloudinary.apiKey,
        signature,
      },
      { timeout: DESTROY_TIMEOUT_MS }
    );
  } catch (err) {
    console.error("Failed to delete Cloudinary asset", parsed.publicId, err.message);
  }
}
