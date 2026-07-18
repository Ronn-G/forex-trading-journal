import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("--- Starting Portable Package Build ---");

// 1. Xác định các đường dẫn
const rootDir = path.resolve(__dirname, "..");
const tauriReleaseExe = path.join(rootDir, "src-tauri", "target", "release", "tauri-app.exe");
const distDir = path.join(rootDir, "dist-portable");
const portableExe = path.join(distDir, "ForexTradingJournal.exe");
const readmeFile = path.join(distDir, "README_PORTABLE.txt");
const zipFile = path.join(rootDir, "forex-trading-journal-portable.zip");

// 2. Kiểm tra xem executable đã được build chưa
if (!fs.existsSync(tauriReleaseExe)) {
  console.error(`Error: Tauri release executable not found at: ${tauriReleaseExe}`);
  console.error('Please run "npm run tauri build" first.');
  process.exit(1);
}

// 3. Chuẩn bị thư mục phân phối di động
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 4. Copy file executable sang thư mục di động và đổi tên
fs.copyFileSync(tauriReleaseExe, portableExe);
console.log(`Copied executable to: ${portableExe}`);

// 5. Tạo file hướng dẫn README
const readmeContent = `Forex Trading Journal v0.1.0 - Portable Version
==================================================

Day la ban chay di dong (Portable) cua ung dung Forex Trading Journal.

Huong dan van hanh nhanh:
1. Giai nen toan bo file ZIP vao mot thu muc.
2. Click dup chuot vao file "ForexTradingJournal.exe" de chay ung dung.

Luu y quan trong:
- Ung dung chay offline hoan toan va luu du lieu tai AppData Local cua nguoi dung.
- Yeu cau he thong phai cai dat san "WebView2 Runtime" (co san tren Windows 10/11 cap nhat moi).
`;

fs.writeFileSync(readmeFile, readmeContent, "utf8");
console.log("Created README_PORTABLE.txt");

// 6. Nén thư mục di động thành file ZIP bằng PowerShell Compress-Archive
console.log("Compressing portable distribution to ZIP...");
try {
  if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
  }
  
  // Chạy lệnh PowerShell để nén
  const psCommand = `powershell.exe -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipFile}' -Force"`;
  execSync(psCommand, { stdio: "inherit" });
  
  console.log(`Successfully created portable package: ${zipFile}`);
} catch (err) {
  console.error("Failed to create ZIP archive:", err);
  process.exit(1);
}

console.log("--- Portable Package Build Finished ---");
