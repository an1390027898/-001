const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const APP_DIR_NAME = "叙述婚礼接单执行系统";
const STORAGE_FILE = "storage.json";

// Compute an app data dir without relying on Electron app.getPath in renderer
function getBaseDir(){
  try{
    if(process.platform === "win32"){
      const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
      return path.join(base, APP_DIR_NAME);
    }
    if(process.platform === "darwin"){
      return path.join(os.homedir(), "Library", "Application Support", APP_DIR_NAME);
    }
    const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    return path.join(base, APP_DIR_NAME);
  }catch{
    return path.join(os.homedir(), ".narrate_wedding");
  }
}

const baseDir = getBaseDir();
const storagePath = path.join(baseDir, STORAGE_FILE);
const backupsDir = path.join(baseDir, "backups");

function ensureDir(p){
  try{ fs.mkdirSync(p, { recursive: true }); }catch{}
}
ensureDir(baseDir);
ensureDir(backupsDir);

function readStore(){
  try{
    if(!fs.existsSync(storagePath)) return {};
    const raw = fs.readFileSync(storagePath, "utf-8");
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : {};
  }catch(e){
    // If corrupted, keep a copy
    try{
      const ts = new Date().toISOString().replace(/[:.]/g,"-");
      const broken = path.join(baseDir, `storage.broken.${ts}.json`);
      fs.copyFileSync(storagePath, broken);
    }catch{}
    return {};
  }
}

function writeStoreAtomic(obj){
  const tmp = storagePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf-8");
  fs.renameSync(tmp, storagePath);
}

function dailyBackup(key, value){
  try{
    // backup once per day per key
    const day = new Date().toISOString().slice(0,10);
    const fp = path.join(backupsDir, `${key}.${day}.json`.replace(/[\\/:*?"<>|]/g,"_"));
    if(fs.existsSync(fp)) return;
    // pretty json if possible
    let out = value;
    try{
      const parsed = JSON.parse(value);
      out = JSON.stringify(parsed, null, 2);
    }catch{}
    fs.writeFileSync(fp, out, "utf-8");
  }catch{}
}

const desktopStorage = {
  getItem: (key) => {
    const s = readStore();
    const v = s[key];
    return (typeof v === "string") ? v : null;
  },
  setItem: (key, value) => {
    const s = readStore();
    s[key] = String(value ?? "");
    writeStoreAtomic(s);
    dailyBackup(key, s[key]);
  },
  removeItem: (key) => {
    const s = readStore();
    delete s[key];
    writeStoreAtomic(s);
  },
};

const desktopAPI = {
  // Native dialogs
  saveTextFile: (defaultName, content) => ipcRenderer.invoke("file:saveText", defaultName, content),
  openTextFile: () => ipcRenderer.invoke("file:openText"),
  // Open local backups folder path (best-effort)
  getBackupsDir: () => backupsDir,
};

contextBridge.exposeInMainWorld("desktopStorage", desktopStorage);
contextBridge.exposeInMainWorld("desktopAPI", desktopAPI);
