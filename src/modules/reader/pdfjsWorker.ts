import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

export async function configurePdfjsWorker(workerSrc = pdfWorkerSrc) {
  const { GlobalWorkerOptions } = await import("pdfjs-dist");
  if (GlobalWorkerOptions.workerSrc) {
    return GlobalWorkerOptions.workerSrc;
  }
  GlobalWorkerOptions.workerSrc = workerSrc;
  return workerSrc;
}
