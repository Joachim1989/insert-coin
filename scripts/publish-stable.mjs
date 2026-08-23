// Publie la version de secours à stable/ : le dernier commit d'avant le
// découpage en modules (f4e9457), FIGÉ — ce script n'a normalement besoin
// d'être relancé qu'une fois. Il ne construit rien depuis src/ (cette
// version n'existait qu'en un seul fichier monolithique) : il extrait le
// commit historique tel quel via `git show`, et fait UNE seule modification
// volontaire — ajouter une bannière d'avertissement en haut de la page,
// pour qu'elle ne soit jamais confondue avec la racine. Chaque exécution
// repart du blob Git original (jamais du résultat d'une exécution
// précédente), donc rien ne s'accumule si on le relance.
//
// Usage : npm run build:stable
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REF = "f4e9457";
const STABLE_DIR = "stable";
const BINARY_FILES = [
  "manifest.json", "sw.js",
  "icon-192.png", "icon-512.png", "icon-mask-192.png", "icon-mask-512.png",
  "pixel-papa-logo.png"
];
const MAX_BUFFER = 10 * 1024 * 1024; // chaque fichier fait au plus ~700 Ko

const BANNER = `<div style="background:#7a1620;color:#fff;text-align:center;font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:12px;line-height:1.5;padding:10px 14px;border-bottom:2px solid #f4c542">
  <b>⚠ VERSION DE SECOURS</b><br>
  Pas ta version habituelle — figée, d'avant le découpage en modules. À utiliser seulement si la racine a un problème sur le terrain.
</div>
`;

fs.mkdirSync(STABLE_DIR, { recursive: true });

// index.html : texte, bannière injectée juste après <body>.
let html = execFileSync("git", ["show", `${REF}:index.html`], { encoding: "utf8", maxBuffer: MAX_BUFFER });
if (!html.includes("<body>")) {
  console.error(`<body> introuvable dans ${REF}:index.html — le fichier a peut-être changé de forme, vérifier à la main avant de publier.`);
  process.exit(1);
}
html = html.replace("<body>", "<body>\n" + BANNER);
fs.writeFileSync(path.join(STABLE_DIR, "index.html"), html, "utf8");
console.log(`stable/index.html publié depuis ${REF} (${html.length.toLocaleString("fr-BE")} octets, bannière incluse).`);

// Le reste : extraits tels quels (binaires, aucune modification).
for (const f of BINARY_FILES) {
  const buf = execFileSync("git", ["show", `${REF}:${f}`], { maxBuffer: MAX_BUFFER });
  fs.writeFileSync(path.join(STABLE_DIR, f), buf);
  console.log(`stable/${f} publié depuis ${REF} (${buf.length.toLocaleString("fr-BE")} octets).`);
}

console.log("\nRappel : cette version est censée rester figée. Ne republie que si stable/ doit être régénéré depuis zéro.");
