import { $ } from "../util/dom.js";
import { logRead, queueRead, CRED_STORE, credCount } from "../storage/local.js";

/* ══════════ HUD ══════════ */
export function hudPaint(){
  const log = logRead();
  const marge = log.reduce((s,x)=> s + ((x.r||0) - (x.p||0)), 0);
  const sc = $('hud-score');
  if(sc){
    sc.textContent = (marge >= 0 ? "+" : "") + marge.toFixed(0) + "€";
    sc.className = marge > 0 ? "pos" : marge < 0 ? "neg" : "";
  }
  if($('hud-cred')) $('hud-cred').textContent = credCount();

  const q = queueRead().length;
  if($('hud-queue')) $('hud-queue').textContent = q;
  const qc = $('hud-q-cell');
  if(qc) qc.classList.toggle("alert", q > 0);
}

export function credBump(){
  try{
    const d = new Date().toDateString();
    let c = JSON.parse(localStorage.getItem(CRED_STORE) || "{}");
    if(c.d !== d) c = {d, n:0};
    c.n = (c.n || 0) + 1;
    localStorage.setItem(CRED_STORE, JSON.stringify(c));
  }catch(e){}
  hudPaint();
}
