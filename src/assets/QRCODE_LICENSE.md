# 微信公众号二维码图片说明

## 当前文件

- `wechat-qrcode.png`（183452 字节，734×734 像素，8-bit gray+alpha，非隔行）

## 用途

用于 ISS-023（关于页面与作者页）的「作者卡」真实微信公众号二维码展示。资源单源 = Folia 仓 `docs/wechat-qr.png`；本仓 `src/assets/wechat-qrcode.png` 与 personal-site `src/assets/wechat-qrcode.png` 都从该真源复制，三仓保持一致。

## 后续替换

如需更换为新二维码 / 改用其他联系方式：

1. 把新图片放到 Folia 仓 `docs/wechat-qr.png`（真源），正方形 PNG / JPG，240×240 像素以上。
2. 同步把同一张图复制到 FaroPDF `src/assets/wechat-qrcode.png` 和 personal-site `src/assets/wechat-qrcode.png`，**三仓保持一致**。
3. 在 PR 描述里说明替换前后的差异；通过 `git diff --stat src/assets/` 确认仅变更这一张图。
4. 保留本 LICENSE 文件、更新本说明即可；如果不再使用二维码，删除本说明文件并在 `AuthorCard.tsx` 移除 `wechatQrSrc` prop。

## 风险与边界

- 仓库**不**接受包含真实账号、密码、Token 或个人敏感信息的二维码。
- 二维码图片受版权与平台规则约束：仅使用项目作者本人拥有或经授权的二维码。
- 三仓资源必须保持一致：Folia 真源，personal-site / FaroPDF 各复制一次；不要在三仓之间出现"哪一仓最新"的歧义。
- 替换时不要在仓库内提交任何账号 / 密码 / Token / 私钥。
