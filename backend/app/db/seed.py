"""Seed initial data: admin user, roles, resources."""
from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.core.security import get_password_hash
import app.db.base  # noqa: F401 — registers all models with SQLAlchemy
from app.models.user import User, UserRole
from app.models.schedule import Resource, ResourceType

settings = get_settings()


async def seed(db: AsyncSession) -> None:
    # Create admin user
    result = await db.execute(select(User).where(User.username == "admin"))
    if not result.scalar_one_or_none():
        admin = User(
            username="admin",
            email="admin@hospital.local",
            hashed_password=get_password_hash("Admin123!"),
            full_name="Administrador del Sistema",
            role=UserRole.admin,
            is_active=True,
            is_verified=True,
        )
        db.add(admin)
        print("Created admin user (password: Admin123!)")

    # Create default users for each role
    default_users = [
        ("receptionist", "recepcion@hospital.local", "Recepcionista Demo", UserRole.receptionist, "Recep123!"),
        ("tecnico", "tecnico@hospital.local", "Técnico Radiólogo Demo", UserRole.technician, "Tecnico123!"),
        ("radiologo", "radiologo@hospital.local", "Dr. Radiología Demo", UserRole.radiologist, "Radiologo123!"),
        ("medico", "medico@hospital.local", "Dr. Medicina Demo", UserRole.physician, "Medico123!"),
    ]
    for username, email, full_name, role, password in default_users:
        result = await db.execute(select(User).where(User.username == username))
        if not result.scalar_one_or_none():
            user = User(
                username=username,
                email=email,
                hashed_password=get_password_hash(password),
                full_name=full_name,
                role=role,
                is_active=True,
            )
            db.add(user)
            print(f"Created user: {username} ({role.value}) password: {password}")

    # Create default resources
    resources_data = [
        ("Sala de RX 1", ResourceType.room, "CR", "CR_AE_01", "Planta 1"),
        ("Sala de RX 2", ResourceType.room, "DX", "DX_AE_01", "Planta 1"),
        ("Escáner TC 1", ResourceType.equipment, "CT", "CT_AE_01", "Planta 2"),
        ("Resonancia MR 1", ResourceType.equipment, "MR", "MR_AE_01", "Planta 2"),
        ("Ecógrafo 1", ResourceType.equipment, "US", "US_AE_01", "Planta 1"),
        ("Mamógrafo", ResourceType.equipment, "MG", "MG_AE_01", "Planta 3"),
    ]
    for name, rtype, modality, ae_title, location in resources_data:
        result = await db.execute(select(Resource).where(Resource.name == name))
        if not result.scalar_one_or_none():
            resource = Resource(
                name=name,
                resource_type=rtype,
                modality=modality,
                ae_title=ae_title,
                location=location,
                is_available=True,
            )
            db.add(resource)
            print(f"Created resource: {name} [{modality}]")

    await db.commit()
    print("Seed complete.")


async def main():
    engine = create_async_engine(settings.database_url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with SessionLocal() as db:
        await seed(db)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
