const { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();
const dist = join(root, "dist");

const files = [
  "admin.html",
  "auth.html",
  "checkout.html",
  "course.html",
  "index.html",
  "login.html",
  "plan.html",
  "platform.html",
  "register.html",
];

rmSync(dist, { force: true, recursive: true });
mkdirSync(dist, { recursive: true });

for (const file of files) {
  copyFileSync(join(root, file), join(dist, file));
}

for (const folder of ["public", "src"]) {
  const source = join(root, folder);
  if (existsSync(source)) {
    cpSync(source, join(dist, folder), { recursive: true });
  }
}
