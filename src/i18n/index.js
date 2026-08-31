// Infrastructure i18n : dictionnaire statique (dict.js) + resolution de
// langue + application au DOM. Volontairement minimal, sans dependance
// externe, dans le meme style que le reste du projet (modules ES simples).
import { DICT } from "./dict.js";

export const LOCALE_STORE = "insertcoin.locale";
export const LOCALES = ["fr", "nl", "en"];
export const DEFAULT_LOCALE = "fr";

export function locale(){
  try{
    const l = localStorage.getItem(LOCALE_STORE);
    return LOCALES.includes(l) ? l : DEFAULT_LOCALE;
  }catch(e){ return DEFAULT_LOCALE; }
}

export function localeSet(l){
  if(!LOCALES.includes(l)) return;
  try{ localStorage.setItem(LOCALE_STORE, l); }catch(e){}
}

/* t(key, vars) : cherche dans la langue active, retombe sur le francais si
   la cle manque (traduction partielle en cours de chantier), retombe sur
   la cle elle-meme en dernier recours (faute de frappe) — jamais un texte
   vide affiche a l'utilisateur.
   vars (optionnel) : substitue {nom} dans la chaine trouvee, ex.
   t("x.y", {n: 3}) sur une entree "{n} objets" -> "3 objets". Une cle de
   vars absente de la chaine, ou une chaine sans {nom}, ne fait rien de
   plus qu'un t(key) classique. */
export function t(key, vars){
  const l = locale();
  const parLangue = DICT[l] && DICT[l][key];
  const brut = parLangue !== undefined ? parLangue
    : (DICT[DEFAULT_LOCALE] && DICT[DEFAULT_LOCALE][key] !== undefined)
      ? DICT[DEFAULT_LOCALE][key] : key;
  if(!vars) return brut;
  return brut.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/* Applique la langue active a tout le DOM statique de dev.html marque par
   les attributs data-i18n*. Appelee une fois au demarrage (main.js) et a
   chaque changement de langue.
   - data-i18n            : texte brut (textContent) — jamais de HTML, pas
                             de risque d'injection meme si une traduction
                             contenait par erreur des chevrons.
   - data-i18n-html        : contenu HTML (innerHTML) — reserve aux entrees
                             du dictionnaire qui contiennent volontairement
                             des balises (<b>, <br>) ; ce sont NOS propres
                             chaines traduites, jamais du texte venant d'un
                             utilisateur ou d'une reponse IA.
   - data-i18n-placeholder : attribut placeholder d'un champ de saisie.
   - data-i18n-label       : attribut aria-label. */
export function i18nAppliquer(doc){
  const d = doc || document;
  d.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  d.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  d.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  d.querySelectorAll('[data-i18n-label]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
}
