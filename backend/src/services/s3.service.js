import AWS from "aws-sdk";

const s3 = new AWS.S3({ region: process.env.AWS_REGION });

export const uploadToS3 = async (file, key) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  };

  const result = await s3.upload(params).promise();
  return result.Location;
};

/**
 * Upload a raw Buffer to S3 and return a pre-signed URL valid for `expiresIn` seconds.
 * Used to give Gupshup a temporary public URL for WhatsApp image delivery.
 */
export const uploadBufferAndGetPresignedUrl = async (buffer, key, contentType = "image/png", expiresIn = 86400) => {
  const bucket = process.env.S3_BUCKET_NAME;

  await s3.putObject({
    Bucket:      bucket,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  }).promise();

  return s3.getSignedUrlPromise("getObject", {
    Bucket:  bucket,
    Key:     key,
    Expires: expiresIn,  // 24 hours default
  });
};
