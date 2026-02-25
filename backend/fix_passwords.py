"""Fix user passwords - run with: python fix_passwords.py"""
import asyncio
import bcrypt
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://his_ris_user:his_ris_password@postgres:5432/his_ris"

USERS = [
    ("admin",        "Admin123!"),
    ("receptionist", "Recep123!"),
    ("tecnico",      "Tecnico123!"),
    ("radiologo",    "Radiologo123!"),
    ("medico",       "Medico123!"),
]

async def fix():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        for username, password in USERS:
            # Generate fresh bcrypt hash
            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
            # Verify it works before saving
            assert bcrypt.checkpw(password.encode(), hashed.encode()), f"Hash verification failed for {username}!"
            # Update DB
            await db.execute(
                text("UPDATE users SET hashed_password = :h WHERE username = :u"),
                {"h": hashed, "u": username}
            )
            print(f"  Updated {username}: verify OK")
        await db.commit()
        print("All passwords updated and committed.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix())
