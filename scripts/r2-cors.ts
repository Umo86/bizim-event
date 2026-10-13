/**
 * Applies the CORS rules the browser uploader needs to your R2 bucket.
 *   pnpm r2:cors
 * Allowed origins: NEXT_PUBLIC_APP_URL, any extra R2_CORS_ORIGINS (comma separated),
 * and http://localhost:3000 for local testing.
 */
import { config } from "dotenv";
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

config({ path: ".env.local" });
config();

async function main() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, NEXT_PUBLIC_APP_URL, R2_CORS_ORIGINS } =
    process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    throw new Error("Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET first.");
  }
  const origins = [
    ...new Set(
      [NEXT_PUBLIC_APP_URL, ...(R2_CORS_ORIGINS ?? "").split(","), "http://localhost:3000"]
        .map((o) => o?.trim().replace(/\/$/, ""))
        .filter((o): o is string => !!o),
    ),
  ];
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  await client.send(
    new PutBucketCorsCommand({
      Bucket: R2_BUCKET,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["content-type", "content-length"],
            ExposeHeaders: ["etag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  const current = await client.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET }));
  console.log("✓ CORS applied for:", origins.join(", "));
  console.log(JSON.stringify(current.CORSRules, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
