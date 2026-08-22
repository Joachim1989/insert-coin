import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// index.html à la racine reste le fichier PUBLIÉ (servi tel quel par GitHub
// Pages) : `npm run build` le régénère à partir de dev.html + src/, il ne
// faut jamais l'éditer à la main pendant que ce projet Vite existe.
export default defineConfig({
  base: "./", // GitHub Pages sert le site depuis un sous-chemin (/insert-coin/) :
              // une base relative garde les liens vers manifest.json etc. valides.
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    /* L'original était livré tel quel, commentaires compris — pas minifié.
       On garde ce caractère : le "view source" du site reste lisible, et un
       diff entre deux publications reste lisible aussi. */
    minify: false,
    rollupOptions: {
      input: { index: "dev.html" }
    }
  }
});
