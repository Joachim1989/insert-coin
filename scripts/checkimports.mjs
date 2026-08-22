import fs from "node:fs";

const FILES = [
  "src/data/localBase.js", "src/util/dom.js", "src/util/text.js",
  "src/pricing/engine.js", "src/storage/local.js",
  "src/api/discogs.js", "src/api/rebrickable.js", "src/api/brickset.js",
  "src/api/googledrive.js", "src/api/gemini.js",
  "src/ui/main.js", "src/ui/hud.js", "src/ui/capture.js",
  "src/ui/fiche.js", "src/ui/dedup.js", "src/ui/drive.js",
  "src/ui/calendar.js", "src/ui/log.js", "src/ui/settings.js", "src/ui/pwa.js",
];

const exportsOf = {};
for (const file of FILES) {
  const src = fs.readFileSync(file, "utf8");
  const names = new Set();
  for (const m of src.matchAll(/^export (?:const|let|function|async function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm)) {
    names.add(m[1]);
  }
  exportsOf[file] = names;
}

const importsOf = {};
for (const file of FILES) {
  const src = fs.readFileSync(file, "utf8");
  const names = new Set();
  for (const m of src.matchAll(/^import\s*\{([^}]*)\}\s*from/gm)) {
    m[1].split(",").map(s => s.trim()).filter(Boolean).forEach(n => names.add(n.split(" as ")[0].trim()));
  }
  importsOf[file] = names;
}

const owner = {};
for (const [file, names] of Object.entries(exportsOf)) {
  for (const n of names) owner[n] = (owner[n] || []).concat(file);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let problems = 0;
for (const file of FILES) {
  const src = fs.readFileSync(file, "utf8");
  const localDecl = exportsOf[file];
  const imported = importsOf[file];
  for (const [name, owners] of Object.entries(owner)) {
    if (localDecl.has(name)) continue;
    if (imported.has(name)) continue;
    if (owners.includes(file)) continue;
    const re = new RegExp("\\b" + escapeRe(name) + "\\b");
    if (re.test(src)) {
      console.log(file, "utilise", name, "(défini dans " + owners.join(", ") + ") sans import.");
      problems++;
    }
  }
}
console.log("---");
console.log(problems, "problème(s) trouvé(s).");
