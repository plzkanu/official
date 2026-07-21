# 공문접수 관리 시스템

공문 접수부터 전자접수증 발급, 담당부서 알림, 처리상태 추적까지 지원하는 웹 애플리케이션입니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| 로그인 관리 | JWT 기반 인증, 역할별 권한 (관리자/접수담당/팀장/담당부서) |
| 접수 등록 | 채널(팩스/메일/우편), 첨부파일, 발신처/제목/문서번호/접수일 입력 |
| 접수대장 자동등록 | 접수번호 자동 채번 (`2026-0001` 형식) |
| 팀장 접수 | 시스템 타임스탬프, 담당부서/담당자 배정 |
| 전자접수증 | PDF 자동 생성, 디지털 도장 날인, 다운로드/출력 |
| 담당부서 알림 | SMTP 메일 자동 발송 (미설정 시 콘솔 출력) |
| 처리상태 추적 | 검색, 기한 임박/초과 알림, 상태 변경 |

## 기술 스택

- **Backend**: Python FastAPI, SQLAlchemy, SQLite
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **PDF**: ReportLab
- **메일**: aiosmtplib

## 실행 방법

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env         # SMTP 설정 (선택)
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:5173 접속

## 테스트 계정

| 아이디 | 비밀번호 | 역할 |
|--------|----------|------|
| admin | admin1234 | 관리자 |
| registrar | reg1234 | 접수담당 |
| leader | leader1234 | 경영지원팀장 |
| hr_user | hr1234 | 담당부서 (인사팀) |

## 업무 흐름

```
접수담당: 공문 등록 (접수대기)
    ↓
경영지원팀장: 접수 확정 → 접수번호 채번 + 전자접수증 + 메일 발송
    ↓
담당부서: 처리시작 → 처리완료
```

## SMTP 설정 (선택)

`backend/.env` 파일에 SMTP 정보를 설정하면 담당부서 알림 메일이 실제 발송됩니다.
미설정 시 서버 콘솔에 메일 내용이 출력됩니다.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@company.com
```

## API 문서

Backend 실행 후 http://localhost:8000/docs 에서 Swagger UI 확인 가능
