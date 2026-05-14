import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";

const root = fileURLToPath(new URL(".", import.meta.url));

function ensureDist(): string {
  const out = resolve(root, "dist");
  if (!existsSync(out)) mkdirSync(out, { recursive: true });
  return out;
}

function copyManifest() {
  copyFileSync(resolve(root, "src/manifest.json"), resolve(ensureDist(), "manifest.json"));
}

function copyPopupHtml() {
  copyFileSync(resolve(root, "src/popup/index.html"), resolve(ensureDist(), "popup.html"));
}

export default defineConfig(({ mode }) => {
  const define = { "process.env.NODE_ENV": JSON.stringify("production") };

  if (mode === "content") {
    return {
      define,
      build: {
        lib: {
          entry: resolve(root, "src/content/index.ts"),
          name: "content",
          formats: ["iife"],
          fileName: () => "content.js",
        },
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            assetFileNames: "content[extname]",
          },
        },
      },
      plugins: [
        {
          name: "copy-manifest-after-content",
          closeBundle() {
            copyManifest();
          },
        },
      ],
    };
  }

  if (mode === "popup") {
    return {
      define,
      build: {
        lib: {
          entry: resolve(root, "src/popup/popup.ts"),
          name: "popup",
          formats: ["es"],
          fileName: () => "popup.js",
        },
        outDir: "dist",
        emptyOutDir: false,
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            assetFileNames: "assets/popup[extname]",
          },
        },
      },
      plugins: [
        {
          name: "copy-popup-html",
          closeBundle() {
            copyPopupHtml();
          },
        },
      ],
    };
  }

  return {};
});
