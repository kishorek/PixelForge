import { zip } from "fflate";

export interface ZipSource {
  name: string;
  blob: Blob;
}

export async function zipFiles(files: readonly ZipSource[]): Promise<Blob> {
  if (files.length === 0) throw new Error("At least one file is required to build a ZIP archive.");
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    if (!(file.name in entries)) {
      entries[file.name] = new Uint8Array(await file.blob.arrayBuffer());
    }
  }
  return new Promise<Blob>((resolve, reject) => {
    zip(entries, { level: 6 }, (error, archive) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(new Blob([archive], { type: "application/zip" }));
    });
  });
}
