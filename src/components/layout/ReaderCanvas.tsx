export function ReaderCanvas() {
  return (
    <main className="reader" aria-label="PDF 阅读区">
      <div className="reader__viewport">
        <section className="pdf-page pdf-page--empty" aria-label="当前 PDF 页面">
          <div className="empty-state">
            <p className="empty-state__title">未打开 PDF</p>
            <p className="empty-state__body">选择本地 PDF 开始阅读</p>
          </div>
        </section>
      </div>
    </main>
  );
}
