// Stub DOM minimal pour importer des modules ui/*.js en environnement Node
// (pas de vraie fenêtre) : juste assez de surface pour que le module
// s'évalue sans planter (ex. capture.js pose un window.addEventListener au
// niveau module, pas dans une fonction). N'essaie PAS de simuler une vraie
// mise en page — pour ça, il faut un vrai navigateur (voir NON TESTÉ).
export function poserDomMinimal(){
  globalThis.window = globalThis.window || {};
  if(!globalThis.window.addEventListener) globalThis.window.addEventListener = () => {};
  globalThis.document = globalThis.document || { getElementById: () => null };
  if(!globalThis.localStorage){
    const store = {};
    globalThis.localStorage = {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    };
  }
  // Node (21+) fournit déjà un `navigator` global en lecture seule
  // (getter sans setter) : une simple affectation lève une TypeError.
  // defineProperty avec configurable:true force le remplacement quel que
  // soit le descripteur d'origine.
  if(typeof globalThis.navigator === "undefined" || typeof globalThis.navigator.onLine === "undefined"){
    Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true, writable: true });
  }
}
