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
