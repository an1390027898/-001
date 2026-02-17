const { app, BrowserWindow, shell, Menu, dialog, ipcMain, Tray, Notification } = require("electron");
const path = require("path");
const fs = require("fs");

const PRODUCT_NAME = "叙述婚礼接单执行系统";
const TRAY_TIP = "叙述婚礼接单执行系统（托盘运行）";

let tray = null;
let mainWindow = null;
let isQuitting = false;

function userDataFile(name){
  return path.join(app.getPath("userData"), name);
}

function readJSONSafe(fp, fallback){
  try{
    if(!fs.existsSync(fp)) return fallback;
    const raw = fs.readFileSync(fp, "utf-8");
    return JSON.parse(raw);
  }catch(e){
    return fallback;
  }
}

function writeJSONAtomic(fp, obj){
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf-8");
  fs.renameSync(tmp, fp);
}

function ensureTray(win){
  if(tray) return tray;

  // On Windows, setting AppUserModelId helps notifications + taskbar grouping
  if(process.platform === "win32"){
    try{ app.setAppUserModelId("com.narrate.wedding.desktop"); }catch{}
  }

  const trayIconPath = path.join(__dirname, "assets", "tray.png");
  tray = new Tray(trayIconPath);

  const toggle = () => {
    if(!win) return;
    if(win.isVisible()){
      win.hide();
    }else{
      win.show();
      win.focus();
    }
  };

  const contextMenu = Menu.buildFromTemplate([
    { label: "打开/隐藏", click: toggle },
    { type: "separator" },
    {
      label: "打开备份目录",
      click: () => {
        const folder = userDataFile("backups");
        try { fs.mkdirSync(folder, { recursive: true }); } catch {}
        shell.openPath(folder);
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip(TRAY_TIP);
  tray.setContextMenu(contextMenu);

  // Left click toggles
  tray.on("click", toggle);
  tray.on("double-click", toggle);

  return tray;
}

function createMenu(win){
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac ? [{
      label: PRODUCT_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "显示窗口",
          accelerator: "Cmd+Shift+S",
          click: () => { try{ win.show(); win.focus(); }catch{} },
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        {
          label: "退出",
          accelerator: "Cmd+Q",
          click: () => { isQuitting = true; app.quit(); },
        },
      ],
    }] : []),
    {
      label: "文件",
      submenu: [
        {
          label: "显示窗口",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => { try{ win.show(); win.focus(); }catch{} },
        },
        { type: "separator" },
        {
          label: "导出备份…",
          accelerator: "CmdOrCtrl+E",
          click: async () => {
            try { await win.webContents.executeJavaScript("window.__desktopMenuExport && window.__desktopMenuExport()"); } catch {}
          },
        },
        {
          label: "导入备份…",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            try { await win.webContents.executeJavaScript("window.__desktopMenuImport && window.__desktopMenuImport()"); } catch {}
          },
        },
        { type: "separator" },
        {
          label: "退出",
          accelerator: isMac ? undefined : "Alt+F4",
          click: () => { isQuitting = true; app.quit(); },
        },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac ? [{ role: "pasteAndMatchStyle" }, { role: "delete" }] : [{ role: "delete" }]),
        { role: "selectAll" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac ? [{ type: "separator" }, { role: "front" }] : []),
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "打开备份目录",
          click: () => {
            const folder = userDataFile("backups");
            try { fs.mkdirSync(folder, { recursive: true }); } catch {}
            shell.openPath(folder);
          },
        },
        {
          label: "托盘模式说明",
          click: () => {
            dialog.showMessageBox(win, {
              type: "info",
              title: "托盘模式",
              message: "关闭窗口不会退出程序，会隐藏到托盘/菜单栏。\n需要退出请在托盘菜单点「退出」，或使用菜单栏「文件 → 退出」。",
            });
          }
        }
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  // 记住窗口大小/位置
  const statePath = userDataFile("window-state.json");
  const saved = readJSONSafe(statePath, { width: 1280, height: 820 });

  const win = new BrowserWindow({
    width: saved.width || 1280,
    height: saved.height || 820,
    x: saved.x,
    y: saved.y,
    minWidth: 1000,
    minHeight: 700,
    title: PRODUCT_NAME,
    backgroundColor: "#0b0f14",
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // 加载本地 HTML
  win.loadFile(path.join(__dirname, "app.html"));

  // 所有外部链接用默认浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // 保存窗口状态
  const saveState = () => {
    const b = win.getBounds();
    writeJSONAtomic(statePath, { x: b.x, y: b.y, width: b.width, height: b.height });
  };
  win.on("resize", saveState);
  win.on("move", saveState);
  win.on("close", (e) => {
    // 托盘模式：关闭=隐藏，不退出（除非明确退出）
    if(!isQuitting){
      e.preventDefault();
      win.hide();
      ensureTray(win);

      // 仅首次提示
      const flagPath = userDataFile("tray-tip.json");
      const flag = readJSONSafe(flagPath, { shown: false });
      if(!flag.shown){
        try{
          if(Notification.isSupported()){
            new Notification({ title: PRODUCT_NAME, body: "已在托盘运行：关闭窗口不会退出。\n右键托盘图标可退出。" }).show();
          }
        }catch{}
        writeJSONAtomic(flagPath, { shown: true, time: new Date().toISOString() });
      }
      return;
    }
    saveState();
  });

  win.on("minimize", (e) => {
    // 可选：最小化也隐藏到托盘（更像软件）
    e.preventDefault();
    win.hide();
    ensureTray(win);
  });

  createMenu(win);
  ensureTray(win); // 启动即创建托盘（更稳定）
  return win;
}

// Native dialogs for backup import/export
ipcMain.handle("file:saveText", async (_evt, defaultName, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "导出备份",
    defaultPath: defaultName || "backup.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, content ?? "", "utf-8");
  return { canceled: false, filePath };
});

ipcMain.handle("file:openText", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "导入备份",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePaths || !filePaths[0]) return { canceled: true };
  const filePath = filePaths[0];
  const content = fs.readFileSync(filePath, "utf-8");
  return { canceled: false, filePath, content };
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  app.setName(PRODUCT_NAME);
  mainWindow = createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0){
      mainWindow = createWindow();
    }else{
      try{ mainWindow.show(); mainWindow.focus(); }catch{}
    }
  });
});

app.on("window-all-closed", () => {
  // 托盘模式：不因“关闭窗口”而退出（Windows/Linux）
  // 真退出请用托盘菜单“退出”或菜单栏“文件→退出”
  if (process.platform === "darwin") return;
});
