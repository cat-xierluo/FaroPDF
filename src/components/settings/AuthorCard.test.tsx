import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AuthorCard } from "./AuthorCard";

const DEFAULT_PROPS = {
  authorName: "maoking",
  githubUrl: "https://github.com/cat-xierluo",
  wechatQrSrc: "/src/assets/wechat-qrcode.png",
  wechatQrAlt: "微信公众号二维码",
  scanInstruction: "微信扫码关注公众号，获取版本更新与法律材料整理小工具。",
};

describe("AuthorCard", () => {
  test("renders the author name from props", () => {
    render(<AuthorCard {...DEFAULT_PROPS} />);
    expect(screen.getByText("maoking")).toBeInTheDocument();
  });

  test("renders the GitHub link with correct href, target and rel", () => {
    render(<AuthorCard {...DEFAULT_PROPS} />);
    const link = screen.getByRole("link", { name: /GitHub/ });
    expect(link).toHaveAttribute("href", "https://github.com/cat-xierluo");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  test("renders the WeChat QR image with correct src and alt", () => {
    render(<AuthorCard {...DEFAULT_PROPS} />);
    const img = screen.getByAltText("微信公众号二维码");
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute("src", "/src/assets/wechat-qrcode.png");
  });

  test("renders the scan instruction text", () => {
    render(<AuthorCard {...DEFAULT_PROPS} />);
    expect(
      screen.getByText(/微信扫码关注公众号，获取版本更新与法律材料整理小工具。/),
    ).toBeInTheDocument();
  });

  test("uses a fallback GitHub label when the author name is empty", () => {
    render(<AuthorCard {...DEFAULT_PROPS} authorName="" />);
    expect(screen.getByTestId("about-author")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /GitHub/ });
    expect(link).toHaveAttribute("href", "https://github.com/cat-xierluo");
  });

  test("applies the base className plus any caller-provided className", () => {
    const { container } = render(<AuthorCard {...DEFAULT_PROPS} className="custom-cls" />);
    const root = container.querySelector(".settings-author-card");
    expect(root).not.toBeNull();
    expect(root?.className).toContain("custom-cls");
  });
});
