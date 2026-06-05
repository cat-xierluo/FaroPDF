import "./AuthorCard.css";

export interface AuthorCardProps {
  /** 作者展示名（可为空；为空时退化为仅 GitHub 链接与说明）。 */
  authorName: string;
  /** GitHub 个人页链接；与「GitHub」字样组成可点击外链。 */
  githubUrl: string;
  /** 微信公众号二维码图片资源 URL（Vite 静态资源或绝对路径）。 */
  wechatQrSrc: string;
  /** 二维码图片的 alt 文本；缺省沿用通用描述。 */
  wechatQrAlt?: string;
  /** 扫码说明文案；缺省提供兜底说明。 */
  scanInstruction?: string;
  /** 调用方可叠加的额外 className。 */
  className?: string;
}

const DEFAULT_SCAN_INSTRUCTION = "微信扫码关注公众号，获取版本更新与法律材料整理小工具。";
const DEFAULT_QR_ALT = "微信公众号二维码";

/**
 * 「关于」section 内的作者卡：
 * - 展示作者姓名 + GitHub 个人页链接
 * - 展示微信公众号二维码图片（ISS-029 替换占位图为真实二维码，详见 DEC-062）
 * - 附扫码说明
 *
 * 设计要点：
 * - 与 AboutSection 解耦：仅消费 props，不直接读 `readAppMetadata()`，
 *   方便单测传入任意 `authorName` / `githubUrl` / `wechatQrSrc`。
 * - 样式独立到 `AuthorCard.css`，复用 settings.css 已有的
 *   `.settings-author-card` 作为基础壳层 class，新加 `.settings-author-card__*` 子类。
 * - 不引入新依赖；二维码图片通过 `wechatQrSrc` 传入（生产环境由 Vite import 处理）。
 */
export function AuthorCard({
  authorName,
  githubUrl,
  wechatQrSrc,
  wechatQrAlt = DEFAULT_QR_ALT,
  scanInstruction = DEFAULT_SCAN_INSTRUCTION,
  className,
}: AuthorCardProps) {
  const classes = ["settings-author-card", className].filter(Boolean).join(" ");
  const trimmedName = authorName.trim();

  return (
    <div className={classes} data-testid="about-author">
      <h3>作者</h3>
      <p className="settings-author-card__name">
        {trimmedName.length > 0 ? (
          <span className="settings-author-card__author-name">{trimmedName}</span>
        ) : (
          <span className="settings-section__empty">作者信息未配置</span>
        )}
        {" · "}
        <a
          className="settings-author-card__github-link"
          href={githubUrl}
          rel="noreferrer"
          target="_blank"
        >
          GitHub
        </a>
      </p>

      <div className="settings-author-card__qr">
        <img
          alt={wechatQrAlt}
          className="settings-author-card__qr-image"
          height={120}
          src={wechatQrSrc}
          width={120}
        />
        <p className="settings-author-card__instruction">{scanInstruction}</p>
      </div>
    </div>
  );
}
