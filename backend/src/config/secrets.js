import AWS from "aws-sdk";

let isLoaded = false;

const client = new AWS.SecretsManager({
  region: process.env.AWS_REGION
});

export const loadSecrets = async () => {
  if (isLoaded) return; // Prevent multiple loads

  const secretId = process.env.AWS_SECRET_ARN;

  if (!secretId) {
    throw new Error("AWS_SECRET_ARN missing");
  }

  const { SecretString } = await client
    .getSecretValue({ SecretId: secretId })
    .promise();

  if (!SecretString) {
    throw new Error("AWS SecretString is empty");
  }

  // ---------- Try JSON (Preferred) ----------
  try {
    const parsed = JSON.parse(SecretString);

    Object.entries(parsed).forEach(([key, value]) => {
      if (!process.env[key]) process.env[key] = String(value);
    });

    console.log("✔ AWS Secrets loaded (JSON format)");
    isLoaded = true;
    return;
  } catch {
    // Continue to fallback
  }

  // ---------- Try key=value fallback ----------
  const lines = SecretString.split(/\r?\n/);

  lines.forEach((line) => {
    if (!line.includes("=")) return;

    const [key, value] = line.split("=");
    if (key && value && !process.env[key.trim()]) {
      process.env[key.trim()] = value.trim();
    }
  });

  console.log("✔ AWS Secrets loaded (key=value format)");
  isLoaded = true;
};
