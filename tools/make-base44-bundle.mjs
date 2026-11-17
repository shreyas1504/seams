import { build } from "../node_modules/esbuild/lib/main.js";
const minifyIdentifiers = process.argv[2] === "full";
const r = await build({
  entryPoints: ["../src/pages/SeamsApp.jsx"], bundle: true, format: "esm", write: false,
  jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment",
  external: ["react", "react-dom", "@/api/base44Client"],
  alias: { "@": "../src" },
  minifyWhitespace: true, minifySyntax: true, minifyIdentifiers, treeShaking: true,
  loader: { ".js": "jsx" }, banner: { js: 'import React from "react";' },
  plugins: [{ name: "b44", setup(b) { b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: "@/api/base44Client", external: true })); } }],
});
const code = r.outputFiles[0].text;
console.log("bytes", code.length);
import { writeFileSync } from "fs"; writeFileSync(new URL("../base44app/SeamsApp.txt", import.meta.url), code);
