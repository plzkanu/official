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

/** Replit 등에서 PIP_USER=1 이면 venv 안 pip가 --user 설치를 시도해 실패함 */
function pipEnv() {
  const env = { ...process.env };
  delete env.PIP_USER;
  delete env.PIP_USER_SITE;
  return env;
}

if (!existsSync(venvPython)) {
  console.log(`[install-python-deps] venv 생성: ${venvDir}`);
  execSync(`${pythonCmd} -m venv ${venvDir}`, { stdio: "inherit", env: pipEnv() });
}

console.log("[install-python-deps] pip install backend/requirements.txt");
const runPip = (args) =>
  execSync(`${venvPython} -m pip ${args}`, { stdio: "inherit", env: pipEnv() });

runPip("install --upgrade pip");
runPip("install -r backend/requirements.txt");

console.log("[install-python-deps] 완료");
