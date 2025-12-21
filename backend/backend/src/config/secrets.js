import AWS from "aws-sdk";

const client = new AWS.SecretsManager({
  region: process.env.AWS_REGION
});

export const loadSecrets = async () => {
  const secretId = process.env.AWS_SECRET_ARN;

  if (!secretId) {
    throw new Error("AWS_SECRET_ARN missing");
  }

  const { SecretString } = await client
    .getSecretValue({ SecretId: secretId })
    .promise();

  if (!SecretString) {
    throw new Error("SecretString is empty");
  }

  // 🔍 Try JSON first
  try {
    const parsed = JSON.parse(SecretString);

    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = String(value);
    }

    console.log("Secrets loaded (JSON format)");
    return;
  } catch {
    // Not JSON — fall through
  }

  // 🔍 Fallback: key=value format
  const lines = SecretString.split(/\r?\n/);

  for (const line of lines) {
    if (!line.includes("=")) continue;

    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();

    process.env[key] = value;
  }

  console.log("Secrets loaded (key=value format)");
};
