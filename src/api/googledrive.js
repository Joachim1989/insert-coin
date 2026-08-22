import { $ } from "../util/dom.js";
import { CID_STORE, TOK_STORE, driveCid, driveToken } from "../storage/local.js";

export let tokenClient = null;


export function loadGIS(){
  return new Promise((ok, ko) => {
    if(window.google && google.accounts && google.accounts.oauth2) return ok();
    const sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client";
    sc.onload = ok; sc.onerror = () => ko(new Error("Chargement Google impossible"));
    document.head.appendChild(sc);
  });
}


export async function driveAuth(interactive){
  const cid = ($('drive-cid') ? $('drive-cid').value.trim() : "") || driveCid();
  if(!cid){ alert("Colle d'abord ton identifiant client OAuth."); return null; }
  try{ localStorage.setItem(CID_STORE, cid); }catch(e){}

  const cached = driveToken();
  if(cached && !interactive) return cached;

  await loadGIS();
  return new Promise(resolve => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
      callback: (resp) => {
        if(resp && resp.access_token){
          try{
            localStorage.setItem(TOK_STORE, JSON.stringify({
              t: resp.access_token,
              exp: Date.now() + ((resp.expires_in || 3600) * 1000)
            }));
          }catch(e){}
          resolve(resp.access_token);
        } else resolve(null);
      }
    });
    tokenClient.requestAccessToken({prompt: cached ? "" : "consent"});
  });
}


/* Lit une ligne quelle que soit la position des colonnes : on cherche des
   en-têtes connus, et à défaut on prend les deux premières cellules pleines. */
export function rowsFromAOA(aoa, kind){
  if(!aoa.length) return [];
  const head = (aoa[0] || []).map(x => String(x||"").toLowerCase());
  const find = (...ks) => head.findIndex(h => ks.some(k => h.includes(k)));
  let ia = find("artiste","artist","groupe","auteur","editeur","éditeur","console","systeme","système");
  let it = find("titre","title","album","nom","jeu","game");
  const start = (ia >= 0 || it >= 0) ? 1 : 0;

  const out = [];
  for(let r = start; r < aoa.length; r++){
    const row = (aoa[r] || []).map(x => String(x||"").trim());
    let a = "", t = "";
    if(ia >= 0 || it >= 0){ a = row[ia] || ""; t = row[it] || ""; }
    if(!a && !t){ const nz = row.filter(Boolean); a = nz[0] || ""; t = nz[1] || ""; }
    if(a || t) out.push({a, t, k: kind});
  }
  return out;
}


export function csvToAOA(txt){
  const rows = []; let cur = [], val = "", q = false;
  for(let i = 0; i < txt.length; i++){
    const c = txt[i];
    if(q){
      if(c === '"' && txt[i+1] === '"'){ val += '"'; i++; }
      else if(c === '"') q = false;
      else val += c;
    }else{
      if(c === '"') q = true;
      else if(c === ',' || c === ';' || c === '\t'){ cur.push(val); val = ""; }
      else if(c === '\n'){ cur.push(val); rows.push(cur); cur = []; val = ""; }
      else if(c !== '\r') val += c;
    }
  }
  if(val || cur.length){ cur.push(val); rows.push(cur); }
  return rows;
}
