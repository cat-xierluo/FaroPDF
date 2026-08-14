import React from "react";

// 构建戳（配合 config/vite.config.ts define）：真机 devtools Console 首行
// 可确认产物嵌入的前端版本——排查「打包产物新旧不明」的决定性标记。
console.info("[FaroPDF] frontend build:", __FAROPDF_BUILD_ID__);
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
