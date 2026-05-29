from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from bson import ObjectId
import json
import os
import hashlib
import secrets
from dotenv import load_dotenv
import httpx

load_dotenv()

from database import bins_collection, users_collection, payments_collection, chats_collection

app = FastAPI(title="JSONBinBro API", description="JSON Storage with User Management")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to initialize database
@app.on_event("startup")
async def startup_event():
    from database import init_default_users
    await init_default_users()
    print("🚀 Application startup complete - Database initialized")

# Helper function to increment request count
async def increment_request_count(user_id: str):
    """Increment user's request count and check limit"""
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return False
    
    current_count = user.get("request_count", 0)
    current_limit = user.get("request_limit", 300)
    
    if current_count >= current_limit:
        return False
    
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"request_count": 1}}
    )
    return True

# Existing Models
class BinCreate(BaseModel):
    data: Any
    is_private: bool = False
    name: Optional[str] = None

class BinResponse(BaseModel):
    id: str
    data: Any
    is_private: bool
    name: Optional[str]
    created_at: datetime
    updated_at: datetime
    access_count: int = 0

class BinUpdate(BaseModel):
    data: Optional[Any] = None
    name: Optional[str] = None
    is_private: Optional[bool] = None

# New User Models
class UserRegister(BaseModel):
    username: str
    password: str
    email: str

class UserLogin(BaseModel):
    username: str
    password: str

class PaymentCreate(BaseModel):
    user_id: str
    level: int
    amount: float
    method: str
    transaction_id: Optional[str] = None

class ChatMessage(BaseModel):
    user_id: str
    username: str
    message: str
    timestamp: datetime

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def generate_api_key():
    return secrets.token_urlsafe(32)

def bin_helper(bin_doc) -> dict:
    return {
        "id": str(bin_doc["_id"]),
        "data": bin_doc.get("data", {}),
        "is_private": bin_doc.get("is_private", False),
        "name": bin_doc.get("name"),
        "created_at": bin_doc.get("created_at"),
        "updated_at": bin_doc.get("updated_at"),
        "access_count": bin_doc.get("access_count", 0),
        "user_id": bin_doc.get("user_id")
    }

# Payment rates
PAYMENT_RATES = {
    1: {"requests": 2000, "price_ngn": 3000, "price_usd": 2.0},
    2: {"requests": 5000, "price_ngn": 5000, "price_usd": 3.5},
    3: {"requests": 10000, "price_ngn": 9000, "price_usd": 6.0}
}

# ============ USER AUTHENTICATION ENDPOINTS ============

@app.post("/api/register")
async def register(user: UserRegister):
    # Check if username already exists
    existing_username = await users_collection.find_one({"username": user.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Check if email already exists
    existing_email = await users_collection.find_one({"email": user.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    new_user = {
        "username": user.username,
        "password": hash_password(user.password),
        "email": user.email,
        "role": "user",
        "api_key": generate_api_key(),
        "request_count": 0,
        "request_limit": 300,
        "payment_level": 0,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    result = await users_collection.insert_one(new_user)
    return {"message": "User created successfully", "user_id": str(result.inserted_id)}

@app.post("/api/login")
async def login(user: UserLogin):
    db_user = await users_collection.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not db_user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    return {
        "user_id": str(db_user["_id"]),
        "username": db_user["username"],
        "role": db_user["role"],
        "api_key": db_user["api_key"],
        "request_count": db_user.get("request_count", 0),
        "request_limit": db_user.get("request_limit", 300),
        "payment_level": db_user.get("payment_level", 0)
    }

@app.get("/api/user/{user_id}")
async def get_user(user_id: str, api_key: str):
    user = await users_collection.find_one({"_id": ObjectId(user_id), "api_key": api_key})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "user_id": str(user["_id"]),
        "username": user["username"],
        "api_key": user["api_key"],
        "request_count": user.get("request_count", 0),
        "request_limit": user.get("request_limit", 300),
        "payment_level": user.get("payment_level", 0)
    }

# ============ BIN ENDPOINTS (with request counting) ============

@app.post("/api/bins")
async def create_bin(bin_data: BinCreate, user_id: str, api_key: str):
    # Verify user
    user = await users_collection.find_one({"_id": ObjectId(user_id), "api_key": api_key})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user credentials")
    
    # Check and increment request count for CREATE operation
    if not await increment_request_count(user_id):
        raise HTTPException(status_code=403, detail="Request limit exceeded. Please upgrade your plan.")
    
    new_bin = {
        "data": bin_data.data,
        "is_private": bin_data.is_private,
        "name": bin_data.name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "access_count": 0,
        "user_id": user_id
    }
    
    result = await bins_collection.insert_one(new_bin)
    new_bin["_id"] = result.inserted_id
    
    # Get updated request count
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    
    response_data = bin_helper(new_bin)
    response_data["request_count"] = updated_user.get("request_count", 0)
    response_data["request_limit"] = updated_user.get("request_limit", 300)
    
    return response_data

@app.get("/api/bins")
async def get_user_bins(user_id: str, api_key: str):
    user = await users_collection.find_one({"_id": ObjectId(user_id), "api_key": api_key})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user credentials")
    
    # GET operations are FREE (not counted against request limit)
    bins = []
    async for bin_doc in bins_collection.find({"user_id": user_id}).sort("created_at", -1):
        bins.append(bin_helper(bin_doc))
    
    return {
        "bins": bins,
        "request_count": user.get("request_count", 0),
        "request_limit": user.get("request_limit", 300)
    }

@app.get("/api/bins/{bin_id}")
async def get_bin(bin_id: str, api_key: str):
    try:
        bin_obj = await bins_collection.find_one({"_id": ObjectId(bin_id)})
        if not bin_obj:
            raise HTTPException(status_code=404, detail="Bin not found")
        
        user = await users_collection.find_one({"_id": ObjectId(bin_obj["user_id"]), "api_key": api_key})
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # GET single bin is FREE (not counted)
        await bins_collection.update_one(
            {"_id": ObjectId(bin_id)},
            {"$inc": {"access_count": 1}}
        )
        
        return bin_helper(bin_obj)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid bin ID format")

@app.put("/api/bins/{bin_id}")
async def update_bin(bin_id: str, bin_update: BinCreate, api_key: str):
    try:
        bin_obj = await bins_collection.find_one({"_id": ObjectId(bin_id)})
        if not bin_obj:
            raise HTTPException(status_code=404, detail="Bin not found")
        
        user = await users_collection.find_one({"_id": ObjectId(bin_obj["user_id"]), "api_key": api_key})
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check and increment request count for UPDATE operation
        if not await increment_request_count(str(user["_id"])):
            raise HTTPException(status_code=403, detail="Request limit exceeded. Please upgrade your plan.")
        
        update_data = {
            "data": bin_update.data,
            "name": bin_update.name,
            "is_private": bin_update.is_private,
            "updated_at": datetime.utcnow()
        }
        
        await bins_collection.update_one(
            {"_id": ObjectId(bin_id)},
            {"$set": update_data}
        )
        
        updated_bin = await bins_collection.find_one({"_id": ObjectId(bin_id)})
        
        # Get updated request count
        updated_user = await users_collection.find_one({"_id": ObjectId(user["_id"])})
        
        response_data = bin_helper(updated_bin)
        response_data["request_count"] = updated_user.get("request_count", 0)
        response_data["request_limit"] = updated_user.get("request_limit", 300)
        
        return response_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid bin ID format: {str(e)}")

@app.delete("/api/bins/{bin_id}")
async def delete_bin(bin_id: str, api_key: str):
    try:
        bin_obj = await bins_collection.find_one({"_id": ObjectId(bin_id)})
        if not bin_obj:
            raise HTTPException(status_code=404, detail="Bin not found")
        
        user = await users_collection.find_one({"_id": ObjectId(bin_obj["user_id"]), "api_key": api_key})
        if not user:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Check and increment request count for DELETE operation
        if not await increment_request_count(str(user["_id"])):
            raise HTTPException(status_code=403, detail="Request limit exceeded. Please upgrade your plan.")
        
        result = await bins_collection.delete_one({"_id": ObjectId(bin_id)})
        
        # Get updated request count
        updated_user = await users_collection.find_one({"_id": ObjectId(user["_id"])})
        
        return {
            "message": "Bin deleted successfully",
            "request_count": updated_user.get("request_count", 0),
            "request_limit": updated_user.get("request_limit", 300)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid bin ID format: {str(e)}")

# ============ PAYMENT ENDPOINTS ============

@app.post("/api/payments")
async def create_payment(payment: PaymentCreate):
    if payment.level not in PAYMENT_RATES:
        raise HTTPException(status_code=400, detail="Invalid payment level")
    
    payment_record = {
        "user_id": payment.user_id,
        "level": payment.level,
        "amount": payment.amount,
        "method": payment.method,
        "transaction_id": payment.transaction_id,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    result = await payments_collection.insert_one(payment_record)
    
    if payment.method == "paystack":
        return {"payment_id": str(result.inserted_id), "status": "pending", "message": "PayStack payment initiated"}
    else:
        return {"payment_id": str(result.inserted_id), "status": "pending", "message": f"Please complete payment via {payment.method}"}

@app.post("/api/confirm-payment")
async def confirm_payment(payment_id: str, user_id: str, transaction_id: str):
    payment = await payments_collection.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    level = payment["level"]
    additional_requests = PAYMENT_RATES[level]["requests"]
    
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$inc": {"request_limit": additional_requests},
            "$set": {"payment_level": level}
        }
    )
    
    await payments_collection.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": {"status": "completed", "confirmed_at": datetime.utcnow(), "transaction_id": transaction_id}}
    )
    
    updated_user = await users_collection.find_one({"_id": ObjectId(user_id)})
    
    return {
        "message": "Payment confirmed",
        "additional_requests": additional_requests,
        "new_request_limit": updated_user.get("request_limit", 300)
    }

# ============ ADMIN ENDPOINTS ============

@app.get("/api/admin/users")
async def get_all_users(admin_key: str):
    if admin_key != os.getenv("ADMIN_KEY", "admin123"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    users = []
    async for user in users_collection.find():
        users.append({
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "request_count": user.get("request_count", 0),
            "request_limit": user.get("request_limit", 300),
            "payment_level": user.get("payment_level", 0),
            "is_active": user.get("is_active", True),
            "created_at": user.get("created_at")
        })
    return users

@app.put("/api/admin/users/{user_id}/toggle")
async def toggle_user_status(user_id: str, admin_key: str):
    if admin_key != os.getenv("ADMIN_KEY", "admin123"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get("is_active", True)
    await users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"User {'activated' if new_status else 'deactivated'}"}

@app.put("/api/admin/rates")
async def update_payment_rates(admin_key: str, rates: dict):
    if admin_key != os.getenv("ADMIN_KEY", "admin123"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    global PAYMENT_RATES
    PAYMENT_RATES.update(rates)
    return {"message": "Rates updated successfully"}

# ============ CHAT ENDPOINTS ============

@app.post("/api/chats")
async def send_chat(chat: ChatMessage):
    chat_record = chat.dict()
    chat_record["_id"] = ObjectId()
    await chats_collection.insert_one(chat_record)
    
    print(f"Email alert: New chat from {chat.username}: {chat.message}")
    
    return {"message": "Chat sent successfully"}

@app.get("/api/chats/{user_id}")
async def get_user_chats(user_id: str, api_key: str):
    user = await users_collection.find_one({"_id": ObjectId(user_id), "api_key": api_key})
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    chats = []
    async for chat in chats_collection.find({"user_id": user_id}).sort("timestamp", -1).limit(50):
        chats.append({
            "id": str(chat["_id"]),
            "message": chat["message"],
            "timestamp": chat["timestamp"]
        })
    return chats

@app.get("/api/user-requests/{user_id}")
async def get_user_request_stats(user_id: str, api_key: str):
    """Get current request statistics for a user"""
    user = await users_collection.find_one({"_id": ObjectId(user_id), "api_key": api_key})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {
        "user_id": str(user["_id"]),
        "username": user["username"],
        "request_count": user.get("request_count", 0),
        "request_limit": user.get("request_limit", 300),
        "remaining_requests": user.get("request_limit", 300) - user.get("request_count", 0),
        "payment_level": user.get("payment_level", 0)
    }

# ============ FRONTEND ROUTES ============

@app.get("/login", response_class=HTMLResponse)
async def login_page():
    html_content = """<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login - JSONBinBro</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .login-container {
                background: white;
                border-radius: 10px;
                padding: 40px;
                width: 100%;
                max-width: 400px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            .login-header {
                text-align: center;
                margin-bottom: 30px;
            }
            .login-header h1 {
                color: #667eea;
                font-size: 32px;
                margin-bottom: 10px;
            }
            .login-header i {
                font-size: 48px;
                color: #667eea;
                margin-bottom: 10px;
            }
            .login-header .tagline {
                font-size: 14px;
                color: #666;
                margin-top: 5px;
            }
            .form-group {
                margin-bottom: 20px;
            }
            .form-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #333;
            }
            .form-group input {
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 5px;
                font-size: 14px;
            }
            .btn-login {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 5px;
                font-size: 16px;
                cursor: pointer;
                transition: transform 0.2s;
            }
            .btn-login:hover {
                transform: translateY(-2px);
            }
            .demo-credentials {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin-top: 20px;
                font-size: 12px;
                border-left: 3px solid #667eea;
            }
            .demo-credentials strong {
                color: #667eea;
            }
            .error-message {
                background: #f8d7da;
                color: #dc3545;
                padding: 10px;
                border-radius: 5px;
                margin-bottom: 20px;
                display: none;
            }
            .register-link {
                text-align: center;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid #e0e0e0;
            }
            .register-link a {
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            }
            footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                font-size: 12px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="login-header">
                <i class="fas fa-database"></i>
                <h1>JSONBinBro</h1>
                <p class="tagline">We make storage and retrieval even fun! 🚀</p>
            </div>
            <div id="errorMessage" class="error-message"></div>
            <form id="loginForm">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="username" required placeholder="Enter your username">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="password" required placeholder="Enter your password">
                </div>
                <button type="submit" class="btn-login">Login</button>
            </form>
            
            <div class="register-link">
                New to JSONBinBro? <a href="/register">Create an account →</a>
            </div>
            <footer>
                <p>Email: geocorpsys@gmail.com | © 2026 JSONBinBro</p>
                <p>Payments: PayPal, TonWallet, PayStack</p>
            </footer>
        </div>
        <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        localStorage.setItem('userId', data.user_id);
                        localStorage.setItem('username', data.username);
                        localStorage.setItem('role', data.role);
                        localStorage.setItem('apiKey', data.api_key);
                        localStorage.setItem('requestCount', data.request_count);
                        localStorage.setItem('requestLimit', data.request_limit);
                        window.location.href = '/dashboard';
                    } else {
                        const error = await response.json();
                        document.getElementById('errorMessage').textContent = error.detail;
                        document.getElementById('errorMessage').style.display = 'block';
                        setTimeout(() => {
                            document.getElementById('errorMessage').style.display = 'none';
                        }, 3000);
                    }
                } catch (error) {
                    document.getElementById('errorMessage').textContent = 'Network error. Please try again.';
                    document.getElementById('errorMessage').style.display = 'block';
                }
            });
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/register", response_class=HTMLResponse)
async def register_page():
    html_content = """<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Register - JSONBinBro</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .register-container {
                background: white;
                border-radius: 10px;
                padding: 40px;
                width: 100%;
                max-width: 450px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            .register-header {
                text-align: center;
                margin-bottom: 30px;
            }
            .register-header h1 {
                color: #667eea;
                font-size: 32px;
                margin-bottom: 10px;
            }
            .register-header i {
                font-size: 48px;
                color: #667eea;
                margin-bottom: 10px;
            }
            .form-group {
                margin-bottom: 20px;
            }
            .form-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #333;
            }
            .form-group input {
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 5px;
                font-size: 14px;
            }
            .btn-register {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 5px;
                font-size: 16px;
                cursor: pointer;
            }
            .login-link {
                text-align: center;
                margin-top: 20px;
            }
            .login-link a {
                color: #667eea;
                text-decoration: none;
            }
            .error-message {
                background: #f8d7da;
                color: #dc3545;
                padding: 10px;
                border-radius: 5px;
                margin-bottom: 20px;
                display: none;
            }
            .success-message {
                background: #d4edda;
                color: #28a745;
                padding: 10px;
                border-radius: 5px;
                margin-bottom: 20px;
                display: none;
            }
            footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                font-size: 12px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="register-container">
            <div class="register-header">
                <i class="fas fa-database"></i>
                <h1>JSONBinBro</h1>
                <p>Create your free account</p>
            </div>
            <div id="errorMessage" class="error-message"></div>
            <div id="successMessage" class="success-message"></div>
            <form id="registerForm">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="username" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="password" required>
                </div>
                <button type="submit" class="btn-register">Create Account</button>
            </form>
            <div class="login-link">
                Already have an account? <a href="/login">Login here</a>
            </div>
            <footer>
                <p>Email: geocorpsys@gmail.com | © 2026 JSONBinBro</p>
                <p>Payments: PayPal, TonWallet, PayStack</p>
            </footer>
        </div>
        <script>
            document.getElementById('registerForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                try {
                    const response = await fetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, email, password })
                    });
                    if (response.ok) {
                        document.getElementById('successMessage').textContent = 'Registration successful! Redirecting...';
                        document.getElementById('successMessage').style.display = 'block';
                        setTimeout(() => {
                            window.location.href = '/login';
                        }, 2000);
                    } else {
                        const error = await response.json();
                        document.getElementById('errorMessage').textContent = error.detail;
                        document.getElementById('errorMessage').style.display = 'block';
                    }
                } catch (error) {
                    document.getElementById('errorMessage').textContent = 'Network error';
                    document.getElementById('errorMessage').style.display = 'block';
                }
            });
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page():
    with open("static/index.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

@app.get("/logout")
async def logout():
    return HTMLResponse(content="""
    <script>
        localStorage.clear();
        window.location.href = '/login';
    </script>
    """)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.get("/api")
async def api_root():
    return {"message": "JSONBinBro API", "endpoints": {
        "register": "POST /api/register",
        "login": "POST /api/login",
        "create_bin": "POST /api/bins?user_id=&api_key=",
        "list_bins": "GET /api/bins?user_id=&api_key=",
        "get_bin": "GET /api/bins/{id}?api_key=",
        "update_bin": "PUT /api/bins/{id}?api_key=",
        "delete_bin": "DELETE /api/bins/{id}?api_key=",
        "payments": "POST /api/payments",
        "chats": "POST /api/chats",
        "user_requests": "GET /api/user-requests/{user_id}?api_key=",
        "docs": "/docs"
    }}

# Serve static files
app.mount("/static", StaticFiles(directory="static", html=True), name="static")