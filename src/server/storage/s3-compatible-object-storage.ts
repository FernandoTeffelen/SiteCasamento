import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ObjectStorage, StoredObject, UploadObjectInput } from "@/lib/storage/types";

type S3CompatibleConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export class S3CompatibleObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3CompatibleConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(input: UploadObjectInput): Promise<StoredObject> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.contentType,
    }));
    return { storageKey: input.storageKey };
  }

  async get(storageKey: string) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: storageKey }));
    if (!result.Body) throw new Error("O objeto não foi encontrado no armazenamento.");
    return {
      body: await result.Body.transformToByteArray(),
      contentType: result.ContentType ?? "application/octet-stream",
    };
  }

  getPublicUrl() {
    // O bucket deve permanecer privado. A futura rota autorizada criará URLs
    // assinadas, em vez de tornar álbuns de casamento públicos por padrão.
    return "";
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: storageKey,
    }));
  }
}
