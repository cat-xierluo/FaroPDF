import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface NativePdfFile {
  bytes: Uint8Array;
  name: string;
  path: string;
}

interface NativePdfFileResponse {
  bytes: number[];
  name: string;
  path: string;
}

export async function readPdfFileFromPath(path: string): Promise<NativePdfFile> {
  const result = await invoke<NativePdfFileResponse>("read_pdf_file_from_path", { path });
  return {
    bytes: new Uint8Array(result.bytes),
    name: result.name,
    path: result.path,
  };
}

export async function openNativePdfFileDialog(): Promise<NativePdfFile | null> {
  const selectedPath = await open({
    directory: false,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
    multiple: false,
    title: "打开 PDF",
    fileAccessMode: "scoped",
  });

  if (typeof selectedPath !== "string") {
    return null;
  }

  return readPdfFileFromPath(selectedPath);
}
