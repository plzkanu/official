#!/usr/bin/env node
/**
 * 프로덕션 빌드: 프론트엔드(Vite) + Python 의존성
 */
import { execSync } from "node:child_process";

console.log("[build] frontend npm install");
execSync("npm install --prefix frontend", { stdio: "inherit" });

console.log("[build] frontend vite build");
execSync("npm run build --prefix frontend", { stdio: "inherit" });

console.log("[build] 완료");
