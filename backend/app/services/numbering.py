from datetime import datetime

from sqlalchemy.orm import Session

from app.models import ReceptionCounter


def generate_reception_number(db: Session, year: int | None = None) -> str:
    if year is None:
        year = datetime.utcnow().year

    counter = db.query(ReceptionCounter).filter(ReceptionCounter.year == year).first()
    if not counter:
        counter = ReceptionCounter(year=year, last_number=0)
        db.add(counter)
        db.flush()

    counter.last_number += 1
    db.flush()
    return f"{year}-{counter.last_number:04d}"
