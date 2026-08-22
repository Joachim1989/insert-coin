// Garde-fou complémentaire à `eslint --rule no-undef` (voir eslint.config.js) :
// ESLint ne lit que du JS, jamais du HTML. Il ne voit donc jamais les
// identifiants utilisés dans les attributs onclick="..."/onchange="..." de
// dev.html, ni ceux générés dynamiquement dans des template literals côté
// src/ui/*.js (ex. onclick="bacToggle(${idx})"). C'est exactement la classe
// de bug qui a fait planter l'écran Scan (currentCameraMode) : une variable
// de module, invisible depuis le HTML, jamais exposée sur window. Ce script
// extrait ces attributs, les fait relire par le moteur d'ESLint comme des
// petits scripts autonomes, avec les mêmes globals que la page (ceux du
// navigateur + ce que src/main.js expose sur window), et échoue si l'un
// d'eux référence un identifiant que ni l'un ni l'autre ne couvre.
import fs from "node:fs";
import path from "node:path";
import { Linter } from "eslint";
import globals from "globals";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const HANDLER_RE = /\son[a-z]+\s*=\s*"((?:[^"\\]|\\.)*)"/g;

// Même liste que eslint.config.js, extraite de la même source pour ne pas
// diverger : ce que src/main.js pose sur window pour que les onclick="..."
// le trouvent.
const mainSrc = fs.readFileSync(path.join(ROOT, "src/main.js"), "utf8");
const exposedToWindow = {};
for (const m of mainSrc.matchAll(/Object\.assign\(window,\s*\{([\s\S]*?)\}\)/g)) {
  m[1].split(",").map(s => s.trim()).filter(Boolean).forEach(name => {
    exposedToWindow[name] = "readonly";
  });
}

const linter = new Linter();
const linterConfig = {
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "script",
    globals: {
      ...globals.browser,
      ...exposedToWindow,
      google: "readonly",
      XLSX: "readonly",
      // Un handler inline reçoit implicitement l'événement sous ce nom
      // (équivalent à `function onclick(event){ ... }`), et `this` est déjà
      // couvert nativement par ESLint (ThisExpression, pas un Identifier).
      event: "readonly",
    },
  },
  rules: { "no-undef": "error" },
};

function collectFiles(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(p, exts, out);
    else if (exts.some(e => entry.name.endsWith(e))) out.push(p);
  }
  return out;
}

const targets = [path.join(ROOT, "dev.html"), ...collectFiles(path.join(ROOT, "src"), [".js"])];

let problems = 0;
let checked = 0;

for (const file of targets) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  for (const m of src.matchAll(HANDLER_RE)) {
    // Ignore les faux positifs venant d'un commentaire // qui mentionne un
    // onclick="..." à titre d'exemple (pas un vrai attribut HTML) — mais
    // pas "://" (une URL en dur dans le texte du commentaire).
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    const linePrefix = src.slice(lineStart, m.index);
    if (/(?<!:)\/\//.test(linePrefix)) continue;

    let body = m[1];
    // ${...} : substitution JS déjà résolue côté module au moment où le HTML
    // est construit (ex. bacToggle(${idx}) devient bacToggle(3) à l'exécution) ;
    // on la remplace par un littéral neutre pour obtenir un script valide sans
    // fausser la détection d'identifiants globaux, qui porte sur tout le reste.
    body = body.replace(/\$\{[^}]*\}/g, "0").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    checked++;
    let messages;
    try {
      messages = linter.verify(body, linterConfig);
    } catch (err) {
      console.log(rel + " : extrait illisible (" + err.message + ") — vérifier à la main : " + body);
      problems++;
      continue;
    }
    for (const msg of messages) {
      console.log(rel + " : " + msg.message + " — dans : " + body);
      problems++;
    }
  }
}

console.log("---");
console.log(checked, "attribut(s) d'événement inline vérifié(s), " + problems + " problème(s) trouvé(s).");
if (problems > 0) process.exit(1);
