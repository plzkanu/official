#!/usr/bin/env node
/**
 * Replit/프로덕션용 Python venv 생성 및 의존성 설치
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const isWin = process.platform === "win32";
const venvDir = ".venv";
const pythonCmd = isWin ? "python" : "python3";
const venvPython = isWin
  ? join(venvDir, "Scripts", "python.exe")
  : join(venvDir, "bin", "python");

if (!existsSync(venvPython)) {
  console.log(`[install-python-deps] venv 생성: ${venvDir}`);
  execSync(`${pythonCmd} -m venv ${venvDir}`, { stdio: "inherit" });
}

console.log("[install-python-deps] pip install backend/requirements.txt");
execSync(`${venvPython} -m pip install --upgrade pip`, { stdio: "inherit" });
execSync(`${venvPython} -m pip install -r backend/requirements.txt`, {
  stdio: "inherit",
});

console.log("[install-python-deps] 완료");
