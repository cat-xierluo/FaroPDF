const placeholderPages = [1, 2, 3];

export function Sidebar() {
  return (
    <nav className="sidebar" aria-label="文档导航">
      <div className="segmented-control" role="tablist" aria-label="导航视图">
        <button aria-selected="true" role="tab" type="button">
          缩略图
        </button>
        <button aria-selected="false" role="tab" type="button">
          目录
        </button>
      </div>
      <ol className="thumbnail-list" aria-label="页面缩略图">
        {placeholderPages.map((page) => (
          <li className="thumbnail-item" key={page}>
            <div className="thumbnail-page" aria-hidden="true" />
            <span>第 {page} 页</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
