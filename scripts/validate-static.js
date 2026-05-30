const { existsSync, readdirSync, readFileSync } = require("node:fs");
const { extname, join, normalize } = require("node:path");

const dist = join(process.cwd(), "dist");
const textExtensions = new Set([".html", ".css", ".js"]);
const ignoredSchemes = /^(https?:|mailto:|tel:|#|data:|javascript:)/i;
const mojibakePattern = /[\uFFFD]|\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2[\u0080-\u00BF]{1,2}/;
const brokenSpanishPattern = /sesi\?|Entr\?|Eleg\?|contrase\?|se\?as|Misi\?|Educaci\?|pr\?|Cat\?/;
const issues = [];

const walk = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
};

const cleanAssetPath = (value) => {
  const raw = value.trim();
  if (!raw || ignoredSchemes.test(raw) || raw.includes("${")) return "";
  const [withoutHash] = raw.split("#");
  const [withoutQuery] = withoutHash.split("?");
  return withoutQuery.replace(/^\.\//, "").replace(/^\//, "");
};

if (!existsSync(dist)) {
  issues.push("No existe dist/. Corre npm run build primero.");
} else {
  for (const file of walk(dist)) {
    if (!textExtensions.has(extname(file))) continue;
    const content = readFileSync(file, "utf8");
    if (mojibakePattern.test(content) || brokenSpanishPattern.test(content)) {
      issues.push(`Texto sospechoso de encoding en ${file}`);
    }

    const references = [
      ...content.matchAll(/\b(?:src|href)=["']([^"']+)["']/g),
      ...content.matchAll(/url\(["']?([^"')]+)["']?\)/g),
    ];

    for (const match of references) {
      const asset = cleanAssetPath(match[1]);
      if (!asset) continue;
      const target = normalize(join(dist, asset));
      if (!target.startsWith(dist) || !existsSync(target)) {
        issues.push(`Recurso faltante en ${file}: ${match[1]}`);
      }
    }
  }
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exit(1);
}

console.log("Static validation OK");
