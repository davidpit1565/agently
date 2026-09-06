import { describe, it, expect } from "vitest";
import { isWatermarkableText, watermarkText } from "./watermark";

describe("isWatermarkableText", () => {
  it("accepts every known plain-text extension", () => {
    for (const ext of [".py", ".sh", ".yaml", ".yml", ".rb", ".js", ".ts", ".tsx", ".jsx", ".css", ".java", ".go", ".rs", ".php", ".html", ".xml", ".md", ".txt"]) {
      expect(isWatermarkableText(`file${ext}`)).toBe(true);
    }
  });

  it("is case-insensitive on the extension", () => {
    expect(isWatermarkableText("script.PY")).toBe(true);
    expect(isWatermarkableText("Readme.MD")).toBe(true);
  });

  it("rejects unrecognized or binary extensions", () => {
    expect(isWatermarkableText("data.json")).toBe(false);
    expect(isWatermarkableText("data.csv")).toBe(false);
    expect(isWatermarkableText("image.png")).toBe(false);
    expect(isWatermarkableText("archive.zip")).toBe(false);
  });

  it("rejects a file with no extension", () => {
    expect(isWatermarkableText("Makefile")).toBe(false);
  });
});

describe("watermarkText", () => {
  it("prepends a line-comment header for a line-comment language", () => {
    const out = watermarkText("script.py", "print('hi')", "TOKEN123", "My Agent");
    expect(out.startsWith("# Licensed via Agently")).toBe(true);
    expect(out).toContain("# License token: TOKEN123");
    expect(out).toContain("print('hi')");
  });

  it("wraps a block-comment header for a block-comment language", () => {
    const out = watermarkText("styles.css", "body { color: red; }", "TOKEN123", "My Agent");
    expect(out.startsWith("/*\n")).toBe(true);
    expect(out).toContain("*/\n\n");
    expect(out).toContain("body { color: red; }");
  });

  it("uses a plain divider header when the format has no comment syntax (.txt)", () => {
    const out = watermarkText("notes.txt", "hello", "TOKEN123", "My Agent");
    expect(out).toContain("-".repeat(40));
    expect(out).toContain("hello");
    expect(out.startsWith("#")).toBe(false);
  });

  it("returns content unchanged for an unrecognized extension", () => {
    const content = '{"a":1}';
    expect(watermarkText("data.json", content, "TOKEN123", "My Agent")).toBe(content);
  });

  it("keeps a shebang as the literal first line, inserting the header after it", () => {
    const content = "#!/usr/bin/env python3\nprint('hi')";
    const out = watermarkText("script.py", content, "TOKEN123", "My Agent");
    const firstLine = out.split("\n")[0];
    expect(firstLine).toBe("#!/usr/bin/env python3");
    expect(out).toContain("print('hi')");
    expect(out).toContain("Licensed via Agently");
  });

  it("handles a shebang-only file with no trailing newline", () => {
    const content = "#!/usr/bin/env python3";
    const out = watermarkText("script.py", content, "TOKEN123", "My Agent");
    expect(out.startsWith("#!/usr/bin/env python3")).toBe(true);
    expect(out).toContain("Licensed via Agently");
  });
});
