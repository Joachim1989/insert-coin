// Republie le build à la racine du dépôt — le seul endroit que GitHub Pages
// sert réellement :
//   - dist/dev.html (page unique, tout inliné par vite-plugin-singlefile)
//     devient index.html ;
//   - public/* (manifest, icônes, sw.js — jamais transformés par Vite), y
//     compris les sous-dossiers comme .well-known/, sont recopiés tels
//     quels à côté.
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

// Copie récursive : public/ peut contenir des sous-dossiers (ex. .well-known/
// pour assetlinks.json, requis par le TWA Android) en plus des fichiers à plat.
function copierDossier(src, dest){
  fs.mkdirSync(dest, { recursive: true });
  for(const f of fs.readdirSync(src)){
    const srcPath = path.join(src, f);
    const destPath = path.join(dest, f);
    if(fs.statSync(srcPath).isDirectory()){
      copierDossier(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`${destPath} synchronisé depuis ${srcPath}.`);
    }
  }
}
copierDossier("public", ".");
