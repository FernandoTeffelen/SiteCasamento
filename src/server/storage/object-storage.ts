import path from "node:path";
import type { ObjectStorage } from "@/lib/storage/types";
import { LocalObjectStorage } from "./local-object-storage";
import { S3CompatibleObjectStorage } from "./s3-compatible-object-storage";

type StorageDriver = "local" | "s3-compatible";

function getStorageDriver(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local" || driver === "s3-compatible") return driver;
  throw new Error(`STORAGE_DRIVER inválido: ${driver}`);
}

function createObjectStorage(): ObjectStorage {
  const driver = getStorageDriver();

  if (driver === "local") {
    const rootDirectory = process.env.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), ".local-storage");
    return new LocalObjectStorage(rootDirectory);
  }

  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Configure S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY para usar STORAGE_DRIVER=s3-compatible.");
  }

  return new S3CompatibleObjectStorage({
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}

const globalForStorage = globalThis as unknown as { objectStorage?: ObjectStorage };

export const objectStorage = globalForStorage.objectStorage ?? createObjectStorage();

if (process.env.NODE_ENV !== "production") {
  globalForStorage.objectStorage = objectStorage;
}
