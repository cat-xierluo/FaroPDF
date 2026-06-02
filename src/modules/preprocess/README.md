# Scan Preprocess Module

负责扫描件预处理 job model、参数校验、后台 bridge 调用和进度状态。

第一版只建立安全的 preprocess-only 任务桥接，不在前端主线程执行 OpenCV、OCR 或外部脚本。
