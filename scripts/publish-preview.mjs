// Publie le build courant dans preview/, SANS jamais toucher aux fichiers
// racine (index.html, manifest.json, icônes, sw.js à la racine ne sont ni
// lus ni écrits par ce script). Sert à tester une branche sur téléphone
// avant de la fusionner, à la même origine que la racine (donc avec les
// mêmes données localStorage) sans risquer d'emporter une version non
// validée en brocante.
//
// Usage : npm run build:preview   (= vite build && node scripts/publish-preview.mjs)
// À lancer depuis la branche/l'état qu'on veut tester — ce script copie ce
// que `vite build` vient de produire pour le HEAD courant, rien d'autre.
import fs from "node:fs";
import path from "node:path";

const DIST_HTML = "dist/dev.html";
const PUBLIC_DIR = "public";
const PREVIEW_DIR = "preview";

if (!fs.existsSync(DIST_HTML)) {
  console.error(`${DIST_HTML} introuvable — lance \`vite build\` avant ce script (ou utilise \`npm run build:preview\`).`);
  process.exit(1);
}

const html = fs.readFileSync(DIST_HTML, "utf8");
// Même garde-fou que scripts/publish.mjs : un fichier anormalement petit
// sent la page vide ou le build tronqué, on ne publie pas ça.
if (html.length < 50000) {
  console.error(`${DIST_HTML} ne fait que ${html.length} octets — ça sent le build tronqué. Publication annulée, rien n'a été touché dans preview/.`);
  process.exit(1);
}

fs.mkdirSync(PREVIEW_DIR, { recursive: true });
fs.writeFileSync(path.join(PREVIEW_DIR, "index.html"), html, "utf8");
console.log(`preview/index.html publié (${html.length.toLocaleString("fr-BE")} octets).`);

for (const f of fs.readdirSync(PUBLIC_DIR)) {
  fs.copyFileSync(path.join(PUBLIC_DIR, f), path.join(PREVIEW_DIR, f));
  console.log(`preview/${f} synchronisé depuis public/${f}.`);
}
