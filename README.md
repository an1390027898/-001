# 叙述婚礼接单执行系统（桌面端）

这是把 `app.html`（叙述婚礼接单执行系统）封装为桌面软件的工程：
- ✅ 托盘模式：关闭/最小化不退出，隐藏到托盘/菜单栏
- ✅ 本地落盘存储：写入本机 `storage.json`（不依赖浏览器 LocalStorage）
- ✅ 每日自动备份：`backups/`
- ✅ 原生导入/导出：系统文件对话框
- ✅ 菜单栏 + 快捷键：`Cmd/Ctrl+O` 导入，`Cmd/Ctrl+E` 导出

## 目录结构
- `app.html`：主界面（单文件应用）
- `main.js`：Electron 主进程（窗口/托盘/菜单/对话框）
- `preload.js`：安全桥接（本地存储/对话框 API）
- `assets/`：图标（托盘/应用）

---

## 一、开发运行（macOS / Windows）
### 1) 安装 Node.js（LTS）
安装后验证：
```bash
node -v
npm -v
```

### 2) 安装依赖
在项目根目录：
```bash
npm install
```

### 3) 启动桌面端（调试）
```bash
npm run dev
```

---

## 二、打包生成安装包
### macOS 生成 DMG
```bash
npm run dist
```
输出在 `dist/` 目录。

### Windows 生成 EXE（建议在 Windows 上执行）
```powershell
npm run dist
```
输出在 `dist\` 目录（NSIS 安装包）。

---

## 三、托盘模式说明
- 点窗口右上角 `✕` 关闭：不会退出，会隐藏到托盘/菜单栏
- 左键托盘图标：打开/隐藏
- 右键托盘图标：打开备份目录 / 退出

真正退出方式：
- 托盘菜单「退出」
- 或菜单栏「文件 → 退出`

---

## 四、数据保存位置（运行时）
本程序会把数据写到系统目录（可复制备份/迁移）：

- macOS：`~/Library/Application Support/叙述婚礼接单执行系统/`
- Windows：`%APPDATA%\叙述婚礼接单执行系统\`

其中：
- `storage.json`：主数据
- `backups/`：每日备份（按日期）

---

## 五、上传到 GitHub（最简流程）
```bash
git init
git add .
git commit -m "init: narrate wedding desktop app"

# 下面把 <YOUR_REPO_URL> 替换为你 GitHub 仓库地址
git branch -M main
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

> 建议：不要把 `node_modules/` 和 `dist/` 上传（已在 `.gitignore` 里排除）。
