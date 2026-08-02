import { build as esbuild } from "esbuild";
import archiver from "archiver";
import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const addon = path.join(root, "addon");
const runtime = path.join(root, "build", "runtime");
const manifest = JSON.parse(await fs.readFile(path.join(addon, "manifest.json"), "utf8"));
const output = path.join(root, "build", `zocitally-${manifest.version}.xpi`);
const development = process.argv.includes("--dev");

await fs.rm(runtime, { recursive: true, force: true });
await fs.mkdir(runtime, { recursive: true });

await esbuild({
  entryPoints: [path.join(root, "src", "bootstrap.ts")],
  bundle: true,
  format: "iife",
  globalName: "ZocitallyBootstrap",
  target: "firefox140",
  outfile: path.join(runtime, "bootstrap.js"),
  minify: !development,
  sourcemap: development ? "inline" : false,
  footer: {
    js: "var install = ZocitallyBootstrap.install; var startup = ZocitallyBootstrap.startup; var shutdown = ZocitallyBootstrap.shutdown; var uninstall = ZocitallyBootstrap.uninstall; var onMainWindowLoad = ZocitallyBootstrap.onMainWindowLoad;",
  },
});

await esbuild({
  entryPoints: [path.join(root, "src", "preferences.ts")],
  bundle: true,
  format: "iife",
  globalName: "ZocitallyPreferencesBundle",
  target: "firefox140",
  outfile: path.join(runtime, "preferences.js"),
  minify: !development,
  sourcemap: development ? "inline" : false,
});

for (const file of ["manifest.json", "prefs.xhtml", "prefs.css"]) {
  await fs.copyFile(path.join(addon, file), path.join(runtime, file));
}
await fs.copyFile(path.join(addon, "prefs.js.defaults"), path.join(runtime, "prefs.js"));
await fs.cp(path.join(addon, "locale"), path.join(runtime, "locale"), { recursive: true });

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.rm(output, { force: true });
await new Promise((resolve, reject) => {
  const stream = createWriteStream(output);
  const archive = archiver("zip", { zlib: { level: 9 } });
  stream.on("close", resolve);
  stream.on("error", reject);
  archive.on("error", reject);
  archive.pipe(stream);
  archive.directory(runtime, false);
  void archive.finalize();
});

console.log(`Built ${path.relative(root, output)}`);
