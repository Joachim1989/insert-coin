// Point d'entrée Vite. Le HTML garde ses attributs onclick="fn()" tels quels
// (déplacement de code, pas réécriture) : chaque fonction qu'ils appellent —
// y compris celles injectées dynamiquement dans innerHTML — doit donc rester
// accessible en global, exactement comme quand tout vivait dans un seul
// <script> classique.
import "./style.css";

import { switchView, init } from "./ui/main.js";
import {
  triggerCamera, modeSet, handleFileSelect, removePhoto, askAIGo, askAIMulti,
  clearSearch, setMacro, queueRun, cameraMode
} from "./ui/capture.js";
import { bcOuvrir, bcFermer } from "./ui/capture.js";
import {
  ficheEtatSet, ficheCoche, ficheCopieCode, verifSet,
  bacToggle, bacBuy, bacDisc
} from "./ui/fiche.js";
import { collClear, driveConnect, drivePick, driveSaveSel, driveSync } from "./ui/drive.js";
import { calFetch, calAddManual, calICS, calGo, calDel, calGoogle, calVerifMark } from "./ui/calendar.js";
import {
  logFind, logDel, logClear, logVendre, sortieFin, sortieDel, sortieRevoir,
  sortieVendre, sortieExport, scoreClose, logExport,
  rechOuvrir, rechDel, rechClear
} from "./ui/log.js";
import {
  saveSettings, memFree, discSave, discTest, legoSave, legoTest,
  brickSave, brickTest, brickRelayCopier, themeSet,
  backupDownload, backupDrive, backupRestore
} from "./ui/settings.js";
import { modelsRefresh } from "./api/gemini.js";

Object.assign(window, {
  switchView, triggerCamera, modeSet, handleFileSelect, removePhoto, askAIGo, askAIMulti,
  clearSearch, setMacro, queueRun, cameraMode, bcOuvrir, bcFermer,
  ficheEtatSet, ficheCoche, ficheCopieCode, verifSet, bacToggle, bacBuy, bacDisc,
  collClear, driveConnect, drivePick, driveSaveSel, driveSync,
  calFetch, calAddManual, calICS, calGo, calDel, calGoogle, calVerifMark,
  logFind, logDel, logClear, logVendre, sortieFin, sortieDel, sortieRevoir,
  sortieVendre, sortieExport, scoreClose, logExport,
  rechOuvrir, rechDel, rechClear,
  saveSettings, memFree, discSave, discTest, legoSave, legoTest,
  brickSave, brickTest, brickRelayCopier, themeSet,
  backupDownload, backupDrive, backupRestore, modelsRefresh
});
