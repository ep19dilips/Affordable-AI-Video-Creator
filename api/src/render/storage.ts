import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream, readFileSync } from "fs";
import { Readable } from "stream";

// Storage is intentionally decoupled from compute: keeping Cloudflare R2 here
// (zero egress fees, S3-compatible) regardless of Railway hosting the app.
// Point S3_ENDPOINT at any other S3-compatible provider (Backblaze B2, AWS S3)
// without changing this file.
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET || "idea2video-assets";

export async function uploadBuffer(key: string, body: Buffer | ArrayBuffer, contentType: string): Promise<void> {
  const buf = body instanceof ArrayBuffer ? Buffer.from(body) : body;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buf, ContentType: contentType }));
}

export async function uploadFromUrl(sourceUrl: string, key: string, contentType: string): Promise<void> {
  const res = await fetch(sourceUrl);
  const buf = Buffer.from(await res.arrayBuffer());
  await uploadBuffer(key, buf, contentType);
}

export async function downloadToFile(key: string, localPath: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  await new Promise<void>((resolve, reject) => {
    const stream = res.Body as Readable;
    const out = createWriteStream(localPath);
    stream.pipe(out);
    out.on("finish", () => resolve());
    out.on("error", reject);
  });
}

export async function uploadFile(localPath: string, key: string, contentType: string): Promise<void> {
  await uploadBuffer(key, readFileSync(localPath), contentType);
}

export function getPublicOrSignedUrlKey(key: string): string {
  // MVP: return the raw key; wire up a signed-URL endpoint or a public bucket +
  // CDN domain before going to real users.
  return key;
}
