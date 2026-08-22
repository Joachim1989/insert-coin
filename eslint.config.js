// Garde-fou anti-"credCount"/"currentCameraMode" : ces deux bugs avaient la
// même forme — un identifiant qui n'est ni déclaré localement, ni importé,
// ni un global du navigateur — et aucun des deux n'a été attrapé par
// `vite build` ni par `node --check` (voir docs/diagnostic-cotation.md,
// section "Pourquoi la vérification navigateur ne l'a pas attrapé").
// `no-undef` est la règle qui les attrape tous les deux, en un seul endroit.
//
// Deux périmètres distincts, deux jeux de globals :
//   - src/**/*.js tourne dans la page (window, document, localStorage...)
//   - public/sw.js tourne dans le service worker (self, caches, clients...)
// Les identifiants exposés par src/main.js (Object.assign(window, {...}),
// pour que les onclick="..." du HTML les trouvent) sont ajoutés aux globals
// de src/**/*.js : ESLint ne peut pas savoir qu'ils sont "définis" sinon,
// puisque rien dans le fichier qui les *déclare* ne les *appelle*.
// Volontairement PAS js.configs.recommended : ça amène no-empty,
// no-useless-assignment, etc., qui font échouer le build sur du code
// préexistant sans rapport avec le défaut visé (catch(e){} vide, très
// répandu et volontaire dans ce projet pour ignorer les échecs
// d'écriture localStorage). Un seul garde-fou est demandé ici, on
// n'en profite pas pour en ajouter d'autres sans le dire.
import globals from "globals";
import fs from "node:fs";

// Lus dynamiquement dans src/main.js plutôt que recopiés à la main ici :
// si la liste exposée à window change, ce fichier de config n'a pas besoin
// d'être maintenu en parallèle, et ne peut donc pas devenir silencieusement
// périmé.
const mainSrc = fs.readFileSync(new URL("./src/main.js", import.meta.url), "utf8");
const exposedToWindow = {};
for (const m of mainSrc.matchAll(/Object\.assign\(window,\s*\{([\s\S]*?)\}\)/g)) {
  m[1].split(",").map(s => s.trim()).filter(Boolean).forEach(name => {
    exposedToWindow[name] = "readonly";
  });
}

export default [
  {
    files: ["src/**/*.js", "scripts/**/*.js", "eslint.config.js", "vitest.config.js", "vite.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...exposedToWindow,
        /* Chargées dynamiquement à l'exécution (injection d'un <script>
           externe après vérification de window.google / window.XLSX) —
           même mécanisme que dans l'index.html monolithique d'origine
           (loadGIS pour Google Identity Services, le loader XLSX/SheetJS
           dans ui/drive.js). Pas un identifiant oublié : un identifiant
           qui n'existe qu'après coup, à l'exécution, par construction. */
        google: "readonly",
        XLSX: "readonly",
      },
    },
    rules: { "no-undef": "error" },
  },
  {
    files: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.serviceworker },
    },
    rules: { "no-undef": "error" },
  },
];
