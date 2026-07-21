import logging
from email.message import EmailMessage

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


async def send_department_notification(
    to_emails: list[str],
    department_name: str,
    reception_number: str,
    title: str,
    sender: str,
    received_at: str,
) -> bool:
    recipients = [e.strip() for e in to_emails if e and e.strip()]
    if not recipients:
        return True

    subject = f"[공문접수] {reception_number} - {title}"
    body = f"""안녕하세요, {department_name} 담당자님.

새로운 공문이 접수되어 배정되었습니다.

■ 접수번호: {reception_number}
■ 제목: {title}
■ 발신처: {sender}
■ 접수일시: {received_at}

공문접수 관리 시스템에서 확인해 주세요.
"""

    if not settings.smtp_host or not settings.smtp_user:
        logger.info(
            "[메일 미설정 - 콘솔 출력]\nTo: %s\nSubject: %s\n%s",
            ", ".join(recipients),
            subject,
            body,
        )
        return True

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=settings.smtp_use_tls,
        )
        return True
    except Exception as e:
        logger.error("메일 발송 실패: %s", e)
        return False
