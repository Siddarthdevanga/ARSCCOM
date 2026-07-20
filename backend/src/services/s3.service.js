import AWS from "aws-sdk";

const s3 = new AWS.S3({ region: process.env.AWS_REGION });
const BUCKET = () => process.env.S3_BUCKET_NAME;

/* ──────────────────────────────────────────────────────────
   INTERNAL: extract S3 key from a legacy public URL or
   return the value as-is if it's already a key.

   Legacy URL format:
     https://bucket.s3.region.amazonaws.com/companies/1/logo.png
   Key:
     companies/1/logo.png
────────────────────────────────────────────────────────── */
const extractKey = (keyOrUrl) => {
  if (!keyOrUrl) return keyOrUrl;
  if (!keyOrUrl.startsWith("http")) return keyOrUrl; // already a key
  try {
    return decodeURIComponent(new URL(keyOrUrl).pathname.slice(1));
  } catch {
    return keyOrUrl;
  }
};

/* ──────────────────────────────────────────────────────────
   UPLOAD FILE (multer) → private S3
   Returns the S3 key (not a public URL).
   Works for both logos and visitor photos.
────────────────────────────────────────────────────────── */
export const uploadToS3 = async (file, key) => {
  await s3.putObject({
    Bucket:      BUCKET(),
    Key:         key,
    Body:        file.buffer,
    ContentType: file.mimetype,
  }).promise();
  return key; // callers store the key, serve via presigned URL or proxy
};

/* ──────────────────────────────────────────────────────────
   GET PRESIGNED URL — temporary access for private objects
   Accepts a key OR a legacy full public URL (auto-extracted).
   Default expiry: 1 hour. Pass expiresIn in seconds to override.
────────────────────────────────────────────────────────── */
export const getPresignedUrl = (keyOrUrl, expiresIn = 3600) => {
  if (!keyOrUrl) return Promise.resolve(null);
  return s3.getSignedUrlPromise("getObject", {
    Bucket:  BUCKET(),
    Key:     extractKey(keyOrUrl),
    Expires: expiresIn,
  });
};

/* ──────────────────────────────────────────────────────────
   GET S3 OBJECT AS BUFFER
   Used to embed images (logos, photos) in emails or pipe
   them through the logo proxy endpoint.
────────────────────────────────────────────────────────── */
export const getS3Object = async (keyOrUrl) => {
  const data = await s3.getObject({
    Bucket: BUCKET(),
    Key:    extractKey(keyOrUrl),
  }).promise();
  return {
    buffer:      data.Body,
    contentType: data.ContentType || "image/png",
    etag:        data.ETag || null, // changes automatically whenever the object's content changes
  };
};

/* ──────────────────────────────────────────────────────────
   UPLOAD RAW BUFFER → private S3 + return presigned URL
   Used for temporary files like visitor pass PNGs sent via
   WhatsApp (24-hour expiry by default).
────────────────────────────────────────────────────────── */
export const deleteFromS3 = async (keyOrUrl) => {
  if (!keyOrUrl) return;
  try {
    await s3.deleteObject({ Bucket: BUCKET(), Key: extractKey(keyOrUrl) }).promise();
  } catch (err) {
    console.warn("[S3 delete]", err.message);
  }
};

export const uploadBufferAndGetPresignedUrl = async (
  buffer,
  key,
  contentType = "image/png",
  expiresIn   = 86400,
) => {
  await s3.putObject({
    Bucket:      BUCKET(),
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  }).promise();

  return s3.getSignedUrlPromise("getObject", {
    Bucket:  BUCKET(),
    Key:     key,
    Expires: expiresIn,
  });
};
