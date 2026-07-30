import type {
  AppThemePreference,
  DefaultSavePolicy,
  PageNumberIndicator,
  PdfExpertOpenMode,
} from "../settings/types";
import type { PdfViewMode, TextLayerStatus } from "../pdf/types";
import type { OcrJobStatus } from "../ocr/types";

/**
 * ISS-NEW-G（2026-06-22 收口）：全量 UI 字符串 i18n 字典。
 *
 * 范围：StatusBar / WelcomeScreen / GeneralSection 三处关键字符串。
 * 字典键按"组件 → 段落 → 字段"分层。函数式条目（如 dirty 状态切换）
 * 由调用方传参，避免在不同语境下硬编码多个变体。
 *
 * 字典设计原则：
 *   - 命名按 UI 场景而非按源文件，方便将来增删组件时统一维护
 *   - 英文为基准（与 README / commit message 一致），中文按律师场景习惯翻译
 *   - 不引入运行时 i18n 库（避免 bundle 体积膨胀），仅纯对象查表
 */
export interface Dictionary {
  statusBar: {
    pageNumber: (current: number | null, total: number | null) => string;
    zoom: (percent: string) => string;
    viewMode: string;
    textLayer: string;
    save: (dirty: boolean) => string;
    languageToggle: string;
  };
  welcome: {
    convertSection: string;
    convertImagesTitle: string;
    convertImagesSubtitle: string;
    convertWordTitle: string;
    convertWordSubtitle: string;
    openDocument: string;
    dropHint: string;
    chooseFile: string;
    fileInputAria: string;
    recentSection: string;
    clearRecent: string;
  };
  settings: {
    general: {
      title: string;
      hint: string;
      theme: string;
      savePolicy: string;
      saveDirectory: string;
      saveDirectoryPlaceholder: string;
      documentAuthor: string;
      documentAuthorPlaceholder: string;
      defaultPdfViewer: string;
      defaultPdfViewerPlaceholder: string;
      pdfExpertOpenMode: string;
      resumeLastPage: string;
      pageNumberIndicator: string;
      recentSection: string;
      recentEmpty: string;
    };
    savePolicyOptions: Record<DefaultSavePolicy, string>;
    themeOptions: Record<AppThemePreference, string>;
    pdfExpertOpenModeOptions: Record<PdfExpertOpenMode, string>;
    pageNumberIndicatorOptions: Record<PageNumberIndicator, string>;
  };
  reader: {
    viewModeOptions: Record<PdfViewMode, string>;
    textLayerStatusOptions: Record<TextLayerStatus, string>;
  };
  readerError: {
    /** 错误卡片标题（损坏 / 加密等加载失败通用） */
    title: string;
    /** 隐藏 file input 的无障碍标签 */
    fileInputAria: string;
    /** 「重新选择文件」主按钮 */
    retryButton: string;
    /** 密码提示态标题 */
    passwordTitle: string;
    /** 首次需要密码时的提示 */
    passwordNeeded: string;
    /** 密码错误时的提示 */
    passwordIncorrect: string;
    /** 密码输入框 placeholder */
    passwordPlaceholder: string;
    /** 密码提交按钮 */
    passwordSubmit: string;
    /** 取消密码输入按钮 */
    passwordCancel: string;
  };
  feedback: {
    convertImagesPending: string;
    convertWordPending: string;
  };
  ocrStatusBar: {
    cursorPage: (page: number | null) => string;
    statusIdle: string;
    statusLabel: string;
    statusOptions: Record<OcrJobStatus, string>;
  };
}

const zhCN: Dictionary = {
  statusBar: {
    pageNumber: (current, total) => (current && total ? `页码：${current} / ${total}` : "页码：-"),
    zoom: (percent) => `缩放：${percent}`,
    viewMode: "视图：",
    textLayer: "文字层：",
    save: (dirty) => (dirty ? "保存：有未导出改动" : "保存：原始 PDF 未修改"),
    languageToggle: "界面语言",
  },
  welcome: {
    convertSection: "转换",
    convertImagesTitle: "图片转 PDF",
    convertImagesSubtitle: "将多张图片合并为 PDF",
    convertWordTitle: "Word 转 PDF",
    convertWordSubtitle: "将 Word 文档转为 PDF",
    openDocument: "打开 PDF 文档",
    dropHint: "或将文件拖至此处",
    chooseFile: "选择文件",
    fileInputAria: "选择 PDF 文件",
    recentSection: "最近",
    clearRecent: "清除最近",
  },
  settings: {
    general: {
      title: "常规",
      hint: "外观、默认保存行为、最近打开过的文件。",
      theme: "外观",
      savePolicy: "默认保存策略",
      saveDirectory: "默认保存目录（留空跟随系统）",
      saveDirectoryPlaceholder: "/Users/you/Documents",
      documentAuthor: "默认作者（写 PDF 元数据时预填）",
      documentAuthorPlaceholder: "留空不预填",
      defaultPdfViewer: "默认 PDF 查看应用",
      defaultPdfViewerPlaceholder: "留空使用系统默认（如 Preview、Adobe Reader）",
      pdfExpertOpenMode: "PDF Expert 打开方式",
      resumeLastPage: "重新打开 PDF 时回到上次阅读位置",
      pageNumberIndicator: "页码指示符",
      recentSection: "最近文件",
      recentEmpty: "暂无最近文件",
    },
    savePolicyOptions: {
      "always-export-copy": "始终另存副本",
      "ask-each-time": "每次询问",
      "allow-overwrite-with-confirmation": "二次确认后允许覆盖",
    },
    themeOptions: {
      light: "浅色",
      dark: "深色",
    },
    pdfExpertOpenModeOptions: {
      "always-pdf-expert": "始终用 PDF Expert 打开",
      "system-default": "使用系统默认应用",
      "ask-each-time": "每次询问",
    },
    pageNumberIndicatorOptions: {
      "current-only": "仅当前页（如 5）",
      "current-of-total": "当前 / 总数（如 5 / 12）",
      "page-prefix": "第 X 页（如 第 5 页）",
    },
  },
  reader: {
    viewModeOptions: {
      continuous: "连续",
      single: "单页",
      double: "双页",
      "fit-width": "适合宽度",
    },
    textLayerStatusOptions: {
      unknown: "未知",
      available: "可用",
      partial: "部分",
      missing: "缺失",
      poor: "较差",
    },
  },
  readerError: {
    title: "无法打开此 PDF",
    fileInputAria: "重新选择 PDF 文件",
    retryButton: "重新选择文件",
    passwordTitle: "此 PDF 已加密",
    passwordNeeded: "请输入密码以打开此 PDF。",
    passwordIncorrect: "密码错误，请重新输入。",
    passwordPlaceholder: "输入 PDF 密码",
    passwordSubmit: "打开",
    passwordCancel: "取消",
  },
  feedback: {
    convertImagesPending: "图片转 PDF 功能开发中，等待 OCR pipeline / img2pdf engine 接入。",
    convertWordPending: "Word 转 PDF 功能开发中，等待 merge engine 接入。",
  },
  ocrStatusBar: {
    cursorPage: (page) => (page ? `光标位置：第 ${page} 页` : "光标位置：-"),
    statusIdle: "空闲",
    statusLabel: "OCR 状态：",
    statusOptions: {
      queued: "排队中",
      running: "运行中",
      completed: "已完成",
      failed: "已失败",
      cancelled: "已取消",
    },
  },
};

const en: Dictionary = {
  statusBar: {
    pageNumber: (current, total) => (current && total ? `Page ${current} / ${total}` : "Page: -"),
    zoom: (percent) => `Zoom: ${percent}`,
    viewMode: "View:",
    textLayer: "Text layer:",
    save: (dirty) => (dirty ? "Save: unsaved changes" : "Save: source PDF unchanged"),
    languageToggle: "Interface language",
  },
  welcome: {
    convertSection: "Convert",
    convertImagesTitle: "Images to PDF",
    convertImagesSubtitle: "Combine multiple images into one PDF",
    convertWordTitle: "Word to PDF",
    convertWordSubtitle: "Convert a Word document into PDF",
    openDocument: "Open a PDF document",
    dropHint: "or drop a file here",
    chooseFile: "Choose file",
    fileInputAria: "Select a PDF file",
    recentSection: "Recent",
    clearRecent: "Clear recent",
  },
  settings: {
    general: {
      title: "General",
      hint: "Appearance, default save behavior, and recently opened files.",
      theme: "Appearance",
      savePolicy: "Default save policy",
      saveDirectory: "Default save directory (leave empty to follow system)",
      saveDirectoryPlaceholder: "/Users/you/Documents",
      documentAuthor: "Default author (pre-filled when writing PDF metadata)",
      documentAuthorPlaceholder: "Leave empty to skip",
      defaultPdfViewer: "Default PDF viewer",
      defaultPdfViewerPlaceholder: "Leave empty to use the system default (e.g. Preview, Adobe Reader)",
      pdfExpertOpenMode: "How PDF Expert opens files",
      resumeLastPage: "Resume last page when reopening a PDF",
      pageNumberIndicator: "Page number indicator",
      recentSection: "Recent files",
      recentEmpty: "No recent files",
    },
    savePolicyOptions: {
      "always-export-copy": "Always save a copy",
      "ask-each-time": "Ask each time",
      "allow-overwrite-with-confirmation": "Allow overwrite with confirmation",
    },
    themeOptions: {
      light: "Light",
      dark: "Dark",
    },
    pdfExpertOpenModeOptions: {
      "always-pdf-expert": "Always use PDF Expert",
      "system-default": "Use the system default app",
      "ask-each-time": "Ask each time",
    },
    pageNumberIndicatorOptions: {
      "current-only": "Current only (e.g. 5)",
      "current-of-total": "Current / total (e.g. 5 / 12)",
      "page-prefix": "Page X (e.g. Page 5)",
    },
  },
  reader: {
    viewModeOptions: {
      continuous: "Continuous",
      single: "Single page",
      double: "Two pages",
      "fit-width": "Fit width",
    },
    textLayerStatusOptions: {
      unknown: "Unknown",
      available: "Available",
      partial: "Partial",
      missing: "Missing",
      poor: "Poor",
    },
  },
  readerError: {
    title: "Unable to open this PDF",
    fileInputAria: "Select another PDF file",
    retryButton: "Choose another file",
    passwordTitle: "This PDF is encrypted",
    passwordNeeded: "Enter the password to open this PDF.",
    passwordIncorrect: "Incorrect password, please try again.",
    passwordPlaceholder: "Enter PDF password",
    passwordSubmit: "Open",
    passwordCancel: "Cancel",
  },
  feedback: {
    convertImagesPending: "Images to PDF is under development. Awaiting OCR pipeline / img2pdf engine integration.",
    convertWordPending: "Word to PDF is under development. Awaiting merge engine integration.",
  },
  ocrStatusBar: {
    cursorPage: (page) => (page ? `Cursor: page ${page}` : "Cursor: -"),
    statusIdle: "Idle",
    statusLabel: "OCR status:",
    statusOptions: {
      queued: "Queued",
      running: "Running",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
    },
  },
};

import type { AppLanguage } from "../settings/types";

export const dictionaries: Record<AppLanguage, Dictionary> = {
  "zh-CN": zhCN,
  en,
};
