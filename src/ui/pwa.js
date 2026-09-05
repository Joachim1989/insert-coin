/* Service worker : enregistrement + stratégie de mise à jour.
   Voir docs/diagnostic-cotation.md, section "Service worker — proposition",
   pour le raisonnement complet et la découverte qui a motivé ce module :
   public/sw.js existait déjà, avec des commentaires soignés sur le mode
   hors ligne, mais n'était enregistré NULLE PART — le mode hors ligne
   n'était donc pas juste perfectible, il n'était pas actif du tout.

   Le risque à couvrir n'est pas l'enregistrement lui-même (une ligne), mais
   la mise à jour : sw.js appelle déjà skipWaiting()/clients.claim(), donc le
   nouveau worker prend le contrôle dès son activation — mais l'onglet déjà
   ouvert continue d'exécuter le JS déjà chargé en mémoire, il ne se recharge
   pas tout seul. Sans rien de plus, tu peux avoir un nouveau service worker
   actif et un vieil écran affiché en même temps, sans le savoir. Ce module
   couvre ça avec un bandeau visible — jamais un rechargement automatique,
   qui couperait une photo ou une négociation en pleine brocante. */

export function pwaInit(){
  if(!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js').then(reg => {
    /* Le navigateur ne revérifie sw.js que toutes les ~24h par défaut. En
       brocante, l'app reste ouverte en arrière-plan entre deux fiches sans
       jamais recharger toute seule : on force la vérification à chaque
       retour au premier plan, pour ne pas dépendre de ce délai. */
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});

  /* controllerchange se déclenche aussi lors de la toute première
     installation (transition "aucun contrôleur" → "contrôleur") : ce n'est
     pas une mise à jour, rien n'est "nouveau" à recharger, l'afficher ici
     serait trompeur. On ne compte comme mise à jour réelle que les
     déclenchements SUIVANTS, une fois qu'un contrôleur existait déjà. */
  let dejaControle = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(!dejaControle){ dejaControle = true; return; }
    swBanniereAfficher();
  });
}

function swBanniereAfficher(){
  if(document.getElementById('sw-banniere')) return;
  const b = document.createElement('div');
  b.id = 'sw-banniere';
  b.className = 'sw-banniere';
  b.innerHTML = 'Nouvelle version disponible <button id="sw-recharger">Recharger</button>';
  /* Correctif du 05/09/2026 (retour de terrain : le bandeau empêchait
     d'appuyer sur un bouton en dessous) : il vivait en position:fixed en
     haut de l'écran, PAR-DESSUS le contenu, sans jamais lui laisser de
     place — quel que soit l'endroit où le chineur avait scrollé au moment
     où la mise à jour arrivait, le bandeau se posait dessus et rendait
     ce qu'il y avait dessous impossible à toucher. En le mettant en tout
     premier enfant de body (flux normal, pas de position:fixed — voir
     style.css), il pousse tout le reste vers le bas au lieu de le
     recouvrir : il ne peut plus jamais se superposer à un bouton. */
  document.body.insertBefore(b, document.body.firstChild);
  document.getElementById('sw-recharger').onclick = () => location.reload();
}
