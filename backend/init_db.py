import os

from app.seed import init_db

if __name__ == "__main__":
    init_db()
    print("  admin / admin1234 (관리자)")
    print("  registrar / reg1234 (접수담당)")
    print("  leader / leader1234 (경영지원팀장)")
    print("  hr_user / hr1234 (담당부서)")
