/**
 * Replit/프로덕션용 FastAPI 시작 스크립트.
 * PORT 환경 변수를 읽고 0.0.0.0에 바인딩합니다.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const port = process.env.PORT ?? "8000";
const isWin = process.platform === "win32";
const venvPython = resolve(
  isWin ? join(".venv", "Scripts", "python.exe") : join(".venv", "bin", "python"),
);
const python = existsSync(venvPython) ? venvPython : isWin ? "python" : "python3";

const env = {
  ...process.env,
  STATIC_DIR: process.env.STATIC_DIR ?? "../frontend/dist",
};

console.log(`[start] uvicorn 0.0.0.0:${port} (STATIC_DIR=${env.STATIC_DIR})`);

const child = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", port],
  {
    cwd: "backend",
    stdio: "inherit",
    env,
    shell: isWin,
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
