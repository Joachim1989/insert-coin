export const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");


export function esc(s) {
  return String(s==null?"":s).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
}


/* Mots à ignorer : ils créent de fausses correspondances entre disques
   qui n'ont rien à voir (« les », « the », « vinyle »...). */
export const STOP = new Set(["le","la","les","l","de","du","des","un","une","d","et","a","au","aux",
  "the","of","and","in","on","to","for","my","me","you","is","it",
  "vinyle","vinyl","lp","33t","45t","33","45","tours","album","maxi","ep","ost","disque"]);


export function collNorm(str){
  return String(str||"")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\([^)]*\)/g," ")          // (remastered), (1986)...
    .replace(/\[[^\]]*\]/g," ")
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

export function collTokens(str){
  return collNorm(str).split(" ").filter(w => w.length > 1 && !STOP.has(w));
}


/* Coefficient de Dice sur les jetons : tolérant aux fautes d'ordre,
   aux accents et aux mots en trop, strict sur le fond. */
export function collScore(qt, et){
  if(!qt.length || !et.length) return 0;
  const q = new Set(qt);
  let inter = 0;
  et.forEach(w => { if(q.has(w)) inter++; });
  return (2 * inter) / (qt.length + et.length);
}
