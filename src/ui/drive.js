import { $ } from "../util/dom.js";
import { esc, collNorm } from "../util/text.js";
import { driveAuth, csvToAOA, rowsFromAOA } from "../api/googledrive.js";
import { driveFiles, FILES_STORE, SYNC_STORE, driveCid, collRead, collWrite } from "../storage/local.js";
import { fetchAvecDelai, avecDelai } from "../util/fetchTimeout.js";

export async function driveConnect(){
  const t = await driveAuth(true);
  if(!t){ alert("Connexion refusée ou annulée."); return; }
  alert("Drive connecté. Appuie sur « Choisir mes fichiers ».");
  collPaint();
}


/* Recherche les tableurs plausibles plutôt que d'imposer un nom de fichier. */
export async function drivePick(){
  const tok = await driveAuth(false) || await driveAuth(true);
  if(!tok) return;
  const el = $('drive-files');
  el.innerHTML = '<div class="diagbox" style="margin-top:10px">Recherche dans ton Drive…</div>';

  const q = "(mimeType='application/vnd.google-apps.spreadsheet' or "
          + "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or "
          + "mimeType='text/csv') and trashed=false";
  try{
    /* Budget de temps : 15s (correctif du 23/08/2026, voir
       src/util/fetchTimeout.js). */
    const r = await fetchAvecDelai("https://www.googleapis.com/drive/v3/files?pageSize=100&orderBy=modifiedTime desc"
      + "&fields=files(id,name,mimeType,modifiedTime)&q=" + encodeURIComponent(q),
      {headers:{Authorization:"Bearer " + tok}}, 15000);
    if(!r.ok) throw new Error("HTTP " + r.status);
    const list = (await r.json()).files || [];
    if(!list.length){ el.innerHTML = '<div class="diagbox" style="margin-top:10px">Aucun tableur trouvé.</div>'; return; }

    const sel = driveFiles().map(f => f.id);
    el.innerHTML = '<p style="font-size:13px;color:var(--text-muted);margin:12px 0 6px">Coche tes bases (vinyles, jeux vidéo…) :</p>'
      + list.map(f => `
        <label class="tick2">
          <input type="checkbox" value="${f.id}" data-name="${esc(f.name)}" data-mime="${f.mimeType}" ${sel.includes(f.id)?"checked":""}>
          <span><b>${esc(f.name)}</b><br><i>modifié le ${new Date(f.modifiedTime).toLocaleDateString('fr-BE')}</i></span>
        </label>`).join('')
      + '<button class="btn-save" style="margin-top:10px" onclick="driveSaveSel()">Valider et synchroniser</button>';
  }catch(err){
    el.innerHTML = `<div class="diagbox" style="margin-top:10px;border-left:3px solid var(--stop)">Lecture impossible : ${esc(err.message)}</div>`;
  }
}


export function driveSaveSel(){
  const chosen = [...document.querySelectorAll('#drive-files input:checked')].map(c => ({
    id: c.value, name: c.dataset.name, mime: c.dataset.mime,
    kind: /jeu|game|console|jv/i.test(c.dataset.name) ? "jeux" : "vinyles"
  }));
  if(!chosen.length){ alert("Coche au moins un fichier."); return; }
  try{ localStorage.setItem(FILES_STORE, JSON.stringify(chosen)); }catch(e){}
  driveSync(true);
}


export async function driveSync(manuel){
  const files = driveFiles();
  if(!files.length){ if(manuel) alert("Choisis d'abord tes fichiers."); return; }
  if(!navigator.onLine){ if(manuel) alert("Pas de réseau. Les bases déjà chargées restent utilisables."); return; }

  const tok = await driveAuth(false) || (manuel ? await driveAuth(true) : null);
  if(!tok){ if(manuel) alert("Connexion Drive expirée. Appuie sur « Connecter mon Drive »."); return; }

  const el = $('coll-state');
  if(el) el.innerHTML = "Synchronisation en cours…";

  const all = [];
  for(const f of files){
    try{
      /* Budget de temps sur chaque appel : 20s (fichier potentiellement
         volumineux) — correctif du 23/08/2026, voir
         src/util/fetchTimeout.js. Un dépassement tombe dans le catch de ce
         fichier, comme n'importe quelle autre erreur ici. */
      let aoa = [];
      if(f.mime === "application/vnd.google-apps.spreadsheet"){
        const r = await fetchAvecDelai(`https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/csv`,
          {headers:{Authorization:"Bearer " + tok}}, 20000);
        if(!r.ok) throw new Error("HTTP " + r.status);
        aoa = csvToAOA(await r.text());
      }else if(f.mime === "text/csv"){
        const r = await fetchAvecDelai(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
          {headers:{Authorization:"Bearer " + tok}}, 20000);
        if(!r.ok) throw new Error("HTTP " + r.status);
        aoa = csvToAOA(await r.text());
      }else{
        if(!window.XLSX){
          await avecDelai(new Promise((ok, ko) => {
            const sc = document.createElement("script");
            sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
            sc.onload = ok; sc.onerror = ko; document.head.appendChild(sc);
          }), 10000, "Chargement de la librairie tableur impossible (délai dépassé)");
        }
        const r = await fetchAvecDelai(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
          {headers:{Authorization:"Bearer " + tok}}, 20000);
        if(!r.ok) throw new Error("HTTP " + r.status);
        const wb = XLSX.read(await r.arrayBuffer(), {type:"array"});
        wb.SheetNames.forEach(sn => {
          if(/synth/i.test(sn)) return;                      // on saute l'onglet Synthèse
          aoa = aoa.concat(XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, defval:""}));
        });
      }
      all.push(...rowsFromAOA(aoa, f.kind));
    }catch(err){ console.warn("Synchro échouée :", f.name, err); }
  }

  // dédoublonnage
  const seen = new Set(), net = [];
  all.forEach(r => {
    const k = collNorm((r.a||"") + " " + (r.t||""));
    if(k && k.length > 2 && !seen.has(k)){ seen.add(k); net.push(r); }
  });

  if(net.length){
    collWrite(net);
    try{ localStorage.setItem(SYNC_STORE, String(Date.now())); }catch(e){}
  }
  collPaint();
  if(manuel) alert(net.length + " entrées synchronisées depuis Drive.");
}


export function collClear(){
  if(confirm("Effacer toute la collection enregistrée ?")){ collWrite([]); collPaint(); }
}


export function collPaint(){
  const el = $('coll-state'); if(!el) return;
  const c = collRead();
  const ci = $('drive-cid'); if(ci && !ci.value) ci.value = driveCid();

  let quand = "";
  try{
    const t = parseInt(localStorage.getItem(SYNC_STORE) || "0", 10);
    if(t) quand = "Dernière synchro : " + new Date(t).toLocaleString('fr-BE', {dateStyle:'short', timeStyle:'short'});
  }catch(e){}

  if(!c.length){
    el.innerHTML = "Aucune base chargée.<br>Connecte ton Drive et choisis tes fichiers pour activer l'alerte doublon.";
    return;
  }
  const nv = c.filter(x => x.k !== "jeux").length;
  const nj = c.filter(x => x.k === "jeux").length;
  el.innerHTML = `<b style="color:var(--gold)">${c.length} entrées en mémoire.</b><br>`
    + (nv ? `${nv} vinyles` : "") + (nv && nj ? " · " : "") + (nj ? `${nj} jeux` : "") + "<br>"
    + `<span style="opacity:.7">${quand}</span>`;
}
