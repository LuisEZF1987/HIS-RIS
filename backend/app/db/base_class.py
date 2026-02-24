from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def enum_values(cls):
    """Return enum .values for SQLAlchemy's values_callable parameter.
    Ensures the .value (not .name) is used for native PostgreSQL enum storage."""
    return [e.value for e in cls]
