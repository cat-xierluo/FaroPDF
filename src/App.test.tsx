import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import App from "./App";

describe("FaroPDF app shell", () => {
  test("renders the reading workspace as the first screen", () => {
    render(<App />);

    expect(
      screen.getByRole("application", { name: "FaroPDF PDF 工作台" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开 PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "文档导航" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "PDF 阅读区" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "任务面板" })).toBeInTheDocument();
    expect(screen.getByText("未打开 PDF")).toBeInTheDocument();
    expect(screen.getByText("文字层：未知")).toBeInTheDocument();
  });

  test("opens the settings panel from the toolbar", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "设置" }));

    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("默认 OCR 后端")).toHaveValue("local-ocrmypdf");
    expect(screen.getByText("联网 OCR 需要确认")).toBeInTheDocument();
    expect(screen.queryByText("paddle-secret-123456")).not.toBeInTheDocument();
  });
});
