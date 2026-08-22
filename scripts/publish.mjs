// Republie le build à la racine du dépôt — le seul endroit que GitHub Pages
// sert réellement :
//   - dist/dev.html (page unique, tout inliné par vite-plugin-singlefile)
//     devient index.html ;
//   - public/* (manifest, icônes, sw.js — jamais transformés par Vite) sont
//     recopiés tels quels à côté.
// On vérifie d'abord une taille plausible : si le build a raté en silence et
// produit une page quasi vide, mieux vaut planter ici que publier un site cassé.
import fs from "node:fs";
import path from "node:path";

const built = "dist/dev.html";
if(!fs.existsSync(built)){
  console.error("Erreur : " + built + " introuvable — le build a-t-il réussi ?");
  process.exit(1);
}
const size = fs.statSync(built).size;
if(size < 50000){
  console.error(`Erreur : ${built} ne fait que ${size} octets (attendu : plusieurs centaines de Ko). Publication annulée.`);
  process.exit(1);
}
fs.copyFileSync(built, "index.html");
console.log(`index.html republié depuis ${built} (${(size/1024).toFixed(0)} Ko).`);

for(const f of fs.readdirSync("public")){
  fs.copyFileSync(path.join("public", f), f);
  console.log(`${f} synchronisé depuis public/${f}.`);
}
