import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "jsonbin_clone")

client = AsyncIOMotorClient(MONGODB_URL)
database = client[DATABASE_NAME]

bins_collection = database["bins"]
users_collection = database["users"]
payments_collection = database["payments"]
chats_collection = database["chats"]

# Initialize default users
async def init_default_users():
    from main import hash_password
    
    # Check if admin exists
    admin = await users_collection.find_one({"username": "Admin01"})
    if not admin:
        await users_collection.insert_one({
            "username": "Admin01",
            "password": hash_password("Kingfifo@#"),
            "email": "admin@jsonbinbro.com",
            "role": "admin",
            "api_key": "admin_" + os.urandom(16).hex(),
            "request_count": 0,
            "request_limit": 999999,
            "payment_level": 3,
            "is_active": True,
            "created_at": datetime.utcnow()
        })
        print("✅ Default admin user created")
    else:
        print("✅ Admin user already exists")
        # Ensure admin has an email
        if not admin.get("email"):
            await users_collection.update_one(
                {"username": "Admin01"},
                {"$set": {"email": "admin@jsonbinbro.com"}}
            )
            print("✅ Added email to admin user")
    
    # Check if normal user exists
    user = await users_collection.find_one({"username": "User01"})
    if not user:
        await users_collection.insert_one({
            "username": "User01",
            "password": hash_password("1234@#"),
            "email": "user@jsonbinbro.com",
            "role": "user",
            "api_key": "user_" + os.urandom(16).hex(),
            "request_count": 0,
            "request_limit": 300,
            "payment_level": 0,
            "is_active": True,
            "created_at": datetime.utcnow()
        })
        print("✅ Default normal user created")
    else:
        print("✅ Normal user already exists")
        # Ensure normal user has an email
        if not user.get("email"):
            await users_collection.update_one(
                {"username": "User01"},
                {"$set": {"email": "user@jsonbinbro.com"}}
            )
            print("✅ Added email to normal user")