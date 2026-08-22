export const $ = id => document.getElementById(id);


// --- HAPTIC FEEDBACK ---
export function vib() {
  if (navigator.vibrate) navigator.vibrate(40);
}
