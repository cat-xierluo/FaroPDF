import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { createDefaultAppSettings } from "../../../shared/settings/defaults";
import { AboutSection } from "./AboutSection";

describe("AboutSection", () => {
  test("renders app name, version, homepage and repository link", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);

    expect(screen.getByText("FaroPDF").tagName).toMatch(/H3/);
    // version is a code element under "版本" row
    expect(screen.getByText(/^0\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "官网" })).toHaveAttribute(
      "href",
      expect.stringContaining("github.com/cat-xierluo/FaroPDF"),
    );
    expect(screen.getByRole("link", { name: "GitHub 仓库" })).toHaveAttribute(
      "href",
      expect.stringContaining("github.com/cat-xierluo/FaroPDF"),
    );
  });

  test("renders app icon with alt text", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    const icon = screen.getByAltText("FaroPDF 应用图标");
    expect(icon).toBeInTheDocument();
    expect(icon.tagName).toBe("IMG");
  });

  test("check update button shows ISS-021 placeholder", async () => {
    const user = userEvent.setup();
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "检查更新" }));

    expect(screen.getByText(/ISS-021/)).toBeInTheDocument();
    expect(screen.getByText("当前环境不支持自动更新")).toBeInTheDocument();
  });

  test("renders author card with GitHub link when configured", () => {
    render(<AboutSection settings={createDefaultAppSettings()} onChange={() => undefined} />);
    expect(screen.getByTestId("about-author")).toHaveTextContent(/maoking|GitHub/);
  });
});
