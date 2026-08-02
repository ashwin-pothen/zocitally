import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Zocitally branding", () => {
  it("uses the public product metadata and package name", () => {
    const manifest = JSON.parse(read("addon/manifest.json")) as {
      name: string;
      version: string;
      description: string;
      applications: { zotero: { id: string } };
    };
    const packageJSON = JSON.parse(read("package.json")) as { name: string; version: string };

    expect(manifest).toMatchObject({
      name: "Zocitally",
      version: "0.1.0",
      description: "Citation counts for Zotero, powered by OpenAlex.",
      applications: { zotero: { id: "zocitally@ashwin-pothen" } },
    });
    expect(packageJSON).toMatchObject({ name: "zotero-zocitally", version: "0.1.0" });
  });

  it("uses the requested menu labels and a professional Claude credit", () => {
    const locale = read("addon/locale/en-US/zocitally.ftl");
    const preferences = read("addon/prefs.xhtml");

    expect(locale).toContain("Update Citation Count");
    expect(locale).toContain("Update Citations for Selected Items");
    expect(locale).not.toContain("Update Citations for Current Collection");
    expect(locale).toContain("Zocitally Settings");
    expect(preferences).toContain("Built with Claude");
    expect(preferences).toContain("not affiliated with or endorsed by Anthropic, Zotero, or OpenAlex");
  });
});
