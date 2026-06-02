import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

export async function configurePdfjsWorker(workerSrc = pdfWorkerSrc) {
  const { GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = workerSrc;
  return workerSrc;
}
