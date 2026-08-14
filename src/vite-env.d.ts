/// <reference types="vite/client" />

declare module "*?arraybuffer" {
  const content: ArrayBuffer;
  export default content;
}

declare const __FAROPDF_BUILD_ID__: string;
