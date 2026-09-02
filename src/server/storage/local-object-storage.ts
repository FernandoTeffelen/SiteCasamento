import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjectStorage, StoredObject, UploadObjectInput } from "@/lib/storage/types";

function resolveStoragePath(rootDirectory: string, storageKey: string) {
  if (!/^[a-zA-Z0-9/_-]+$/.test(storageKey)) {
    throw new Error("Chave de armazenamento inválida.");
  }

  const root = path.resolve(rootDirectory);
  const target = path.resolve(root, storageKey);

  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error("A chave de armazenamento aponta para fora do diretório permitido.");
  }

  return target;
}

/** Implementação para desenvolvimento. Não expõe arquivos diretamente pela web. */
export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly rootDirectory: string) {}

  async put(input: UploadObjectInput): Promise<StoredObject> {
    const target = resolveStoragePath(this.rootDirectory, input.storageKey);
    await mkdir(path.dirname(target), { recursive: true });

    const temporaryFile = `${target}.${crypto.randomUUID()}.uploading`;
    try {
      await writeFile(temporaryFile, input.body);
      await rename(temporaryFile, target);
    } catch (error) {
      await unlink(temporaryFile).catch(() => undefined);
      throw error;
    }

    return { storageKey: input.storageKey };
  }

  getPublicUrl(storageKey: string) {
    // Fotos de casamento são privadas. Uma URL assinada será oferecida por uma
    // rota autorizada quando o álbum/painel administrativo for implementado.
    resolveStoragePath(this.rootDirectory, storageKey);
    return "";
  }

  async delete(storageKey: string): Promise<void> {
    const target = resolveStoragePath(this.rootDirectory, storageKey);
    await unlink(target).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    });
  }
}
