import { lazy } from "react";

export const LazyReaderSection = lazy(() =>
  import("./ReaderSection").then((m) => ({ default: m.ReaderSection })),
);

export const LazyOcrProviderSection = lazy(() =>
  import("./OcrProviderSection").then((m) => ({ default: m.OcrProviderSection })),
);

export const LazyShortcutSection = lazy(() =>
  import("./ShortcutSection").then((m) => ({ default: m.ShortcutSection })),
);

export const LazyAboutSection = lazy(() =>
  import("./AboutSection").then((m) => ({ default: m.AboutSection })),
);
