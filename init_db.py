import asyncio
from database import init_default_users

async def init():
    await init_default_users()
    print("Database initialization complete!")

if __name__ == "__main__":
    asyncio.run(init())