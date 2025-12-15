import models, schemas, database, ai_service
import image_processing_service
import os
import json
import asyncio
import logging
import image_gen_service 
import aiofiles
import httpx
from uuid import uuid4
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import timedelta
from typing import List
from datetime import datetime
from dotenv import load_dotenv
from weather_service import get_weather_info
from recommendation_service import ProfessionalRecommender 

app = FastAPI(title="智能穿搭推荐系统")

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
# --- 安全配置 ---
SECRET_KEY = "YOUR_SECRET_KEY_KEEP_IT_SAFE"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 3000 # Token过期时间

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- 辅助函数 ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- 认证接口 ---

@app.post("/register", response_model=schemas.Token)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. 检查是否存在
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 2. 创建用户
    hashed_password = get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # 3. 自动登录返回Token
    access_token = create_access_token(data={"sub": db_user.username, "uid": str(db_user.id)})
    return {"access_token": access_token, "token_type": "bearer", "user_id": str(db_user.id), "username": db_user.username}

@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. 查用户
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    # 2. 发Token
    access_token = create_access_token(data={"sub": user.username, "uid": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer", "user_id": str(user.id), "username": user.username}

# --- 用户资料(Profile)接口 ---
@app.get("/user/profile", response_model=schemas.UserProfileResponse)
def get_user_profile(user_id: str, db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
    if not profile:
        # 如果不存在，创建一个默认的
        profile = models.UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@app.put("/user/profile", response_model=schemas.UserProfileResponse)
def update_user_profile(profile: schemas.UserProfileCreate, user_id: str = Query(...), db: Session = Depends(get_db)):
    db_profile = db.query(models.UserProfile).filter(models.UserProfile.user_id == user_id).first()
    if not db_profile:
        db_profile = models.UserProfile(user_id=user_id)
        db.add(db_profile)
    
    # 更新字段（只更新传入的字段）
    update_data = profile.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_profile, key, value)
    
    db.commit()
    db.refresh(db_profile)
    return db_profile

# --- 基础配置 ---
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SmartWardrobe")

# 初始化数据库表
models.Base.metadata.create_all(bind=database.engine)

# 1. 配置跨域与静态文件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保上传目录存在
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 挂载静态目录，使前端可以通过 URL 访问生成的图片
# 例如: http://localhost:8000/uploads/user123/xxx.png
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 辅助函数：将英文标签转换为中文
def _get_cn_label(category_en):
    mapping = {
        "upper": "上衣",
        "lower": "下装/裤裙",
        "shoes": "鞋子",
        "dress": "连衣裙",
        "bag": "包袋",
        "hat": "帽子", 
        "accessories": "配饰",
        "original": "原图"
    }
    return mapping.get(category_en, category_en)

# ==========================================
# 核心流程 Step 1: 图片上传与分割
# ==========================================
@app.post("/segment", summary="步骤1：上传图片并进行分割，返回候选图列表")
async def segment_image(
    file: UploadFile = File(...),
    user_id: str = Query(..., description="用户ID")
):
    """
    用户上传一张全身照或挂拍图，系统将其分割成独立的部件（上衣、裤子等），
    并保存为独立文件，返回列表供用户选择。
    """
    user_dir = os.path.join(UPLOAD_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    
    # 1. 读取并保存原始大图
    content = await file.read()
    
    # 生成带时间戳的文件名，防止覆盖
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    filename_no_ext = os.path.splitext(file.filename)[0]
    base_name = f"{filename_no_ext}_{timestamp}"
    
    # 注意：路径使用 "/" 统一分隔符，避免 Windows/Linux 路径问题
    original_path = os.path.join(user_dir, f"{base_name}_original.jpg").replace("\\", "/")
    
    with open(original_path, "wb") as f:
        f.write(content)
    
    # 2. 调用分割服务 (只做切割，不调用 AI)
    try:
        # 使用 run_in_threadpool 避免阻塞主线程
        seg_results = await run_in_threadpool(image_processing_service.remove_background_and_crop, content)
    except Exception as e:
        logger.error(f"Segmentation failed: {e}")
        return {"error": "图像分割失败，请重试"}
    
    saved_parts = []
    
    # 3. 处理分割结果
    if seg_results:
        for category, img_bytes in seg_results.items():
            if category == "debug_map": 
                continue # 调试图不返回给用户
            
            # 保存子图
            part_filename = f"{base_name}_{category}.png"
            part_path = os.path.join(user_dir, part_filename).replace("\\", "/")
            
            with open(part_path, "wb") as f:
                f.write(img_bytes)
            
            # 构建返回列表
            saved_parts.append({
                "category_key": category,      # 英文key，用于逻辑判断
                "label": _get_cn_label(category), # 中文标签，用于前端展示
                "image_path": part_path        # 图片路径，前端用于 src 展示和下一步回传
            })
    
    # 4. 兜底逻辑：如果没有切出任何东西（或者只保留了原图），把原图也作为选项返回
    if not saved_parts:
        saved_parts.append({
            "category_key": "original",
            "label": "原图(未检测到主体)",
            "image_path": original_path
        })
    else:
        # 也可以总是把原图放进去，供用户选择“不抠图直接识别”
        saved_parts.insert(0, {
            "category_key": "original",
            "label": "原图",
            "image_path": original_path
        })

    return {
        "status": "success",
        "user_id": user_id,
        "parts": saved_parts,
        "message": "分割完成，请选择一张图片进行AI识别"
    }

# ==========================================
# 核心流程 Step 2: 对选中的图片进行 AI 识别
# ==========================================
class AnalyzeRequest(BaseModel):
    image_path: str =  Query(..., description="从/segment接口返回的image_path")
    user_id: str

@app.post("/analyze-selected", summary="步骤2：对选中的具体子图进行AI属性识别")
async def analyze_selected_item(req: AnalyzeRequest):
    """
    接收用户选中的某一张图片路径，调用：
    1. CLIP 模型提取视觉向量 (用于推荐匹配)
    2. 多模态大模型 (LLM) 提取属性 (用于结构化入库)
    """
    # 1. 安全校验
    if ".." in req.image_path:
        raise HTTPException(status_code=400, detail="非法路径")
    
    if not os.path.exists(req.image_path):
        raise HTTPException(status_code=404, detail="找不到图片文件，请重新上传")

    # 2. 读取文件内容
    try:
        with open(req.image_path, "rb") as f:
            image_bytes = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件读取失败: {str(e)}")

    # 3. 并行执行 AI 任务
    try:
        # Task A: 提取向量 (CPU/GPU 密集型)
        vector_task = run_in_threadpool(ai_service.get_image_embedding, req.image_path)
        
        # Task B: LLM 属性分析 (IO 密集型)
        ai_task = ai_service.analyze_clothing_image(image_bytes)
        
        # 等待两者完成
        ai_result, vector_result = await asyncio.gather(ai_task, vector_task)
    except Exception as e:
        logger.error(f"AI Processing Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI分析服务异常: {str(e)}")

    # 4. 错误处理
    if "error" in ai_result:
        raise HTTPException(status_code=500, detail=ai_result["error"])

    return {
        "status": "success",
        "user_id": req.user_id,
        "selected_image": req.image_path,
        "embedding_vector": vector_result, # 这一长串向量前端拿到后，在最后保存时传回给 /items/
        "attributes": ai_result            # 包含 category_main, materials 等
    }

# ==========================================
# 核心流程 Step 3: 数据入库 (CRUD)
# ==========================================
@app.post("/items/", response_model=schemas.ItemResponse, summary="步骤3：确认属性并保存到衣柜")
def create_item(item: schemas.ItemCreate, db: Session = Depends(get_db)):
    """
    将 AI 识别后的数据（经用户确认或修改后）存入数据库
    """
    db_item = models.ClothingItem(
        **item.dict()
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/items/", response_model=List[schemas.ItemResponse])
def read_items(user_id: str, db: Session = Depends(get_db)):
    return db.query(models.ClothingItem).filter(models.ClothingItem.user_id == user_id).all()

@app.delete("/items/{item_id}")
def delete_item(item_id: int, user_id: str, db: Session = Depends(get_db)):
    item = db.query(models.ClothingItem).filter(models.ClothingItem.id == item_id, models.ClothingItem.user_id == user_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"message": "deleted"}

@app.put("/items/{item_id}", response_model=schemas.ItemResponse, summary="更新衣物属性")
def update_item(
    item_id: int, 
    item: schemas.ItemCreate, # 使用 ItemCreate 作为接收模型，或者单独定义 ItemUpdate
    user_id: str = Query(..., description="验证用户归属"),
    db: Session = Depends(get_db)
):
    # 1. 查找衣物
    db_item = db.query(models.ClothingItem).filter(
        models.ClothingItem.id == item_id, 
        models.ClothingItem.user_id == user_id
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # 2. 更新字段 (排除 id 和 user_id 防止篡改)
    update_data = item.dict(exclude_unset=True)
    
    # 手动映射字段
    for key, value in update_data.items():
        # 跳过不允许修改的元数据
        if key not in ["id", "user_id", "created_at"]:
            setattr(db_item, key, value)
    
    # 3. 提交事务
    try:
        db.commit()
        db.refresh(db_item)
    except Exception as e:
        db.rollback()
        logger.error(f"Update failed: {e}")
        raise HTTPException(status_code=500, detail="Database update failed")
        
    return db_item

# ==========================================
# 工具接口：获取天气 (前端衣橱页专用)
# ==========================================
@app.get("/weather", summary="单独获取天气信息供前端展示")
async def get_weather(location_input: str = Query(..., description="城市名称，如：北京市")):
    """
    前端衣橱页面轮询天气的专用接口。
    调用 weather_service 获取实时数据。
    """
    # 调用 weather_service.py 里的函数
    weather_ctx = await get_weather_info(location_input)
    
    if "error" in weather_ctx:
        # 如果解析失败（比如地名写错，或 API 额度耗尽）
        raise HTTPException(status_code=500, detail=weather_ctx["error"])
    
    return weather_ctx

VIRTUAL_DIR = os.path.join(UPLOAD_DIR, "virtual")
os.makedirs(VIRTUAL_DIR, exist_ok=True)

# ==========================================
# VirtualItemRequest 添加 gender 字段
# ==========================================
class VirtualItemRequest(BaseModel):
    user_id: str
    category_main: str
    category_sub: str
    main_color: str
    materials: List[str]
    styles: List[str]
    seasons: List[str]
    warmth_level: int
    gender: str = "中性"

# ==========================================
# 推荐与反馈接口
# ==========================================
@app.post("/recommend/outfit", summary="根据天气获取推荐搭配")
async def recommend_outfit(req: schemas.RecommendationRequest, db: Session = Depends(get_db)):
    # 1. 获取天气
    weather_ctx = await get_weather_info(req.location)
    if "error" in weather_ctx:
        raise HTTPException(status_code=500, detail=weather_ctx["error"])

    # 2. 初始化推荐引擎
    recommender = ProfessionalRecommender(db, req.user_id, weather_ctx, req)

    # 3. 计算推荐
    try:
        result = await recommender.recommend()
    except Exception as e:
        logger.error(f"Recommendation logic error: {e}", exc_info=True)
        return {"status": "failed", "message": "推荐计算过程中发生错误，请稍后再试"}

    # 检查 result 是否包含错误信息
    if not result or "error" in result:
        return {
            "status": "failed", 
            "message": result.get("error") if result else "无法生成有效搭配，请检查衣橱是否有足够衣物。",
            "weather_summary": weather_ctx.get("summary_text", "未知")
        }

    outfit_data = result.get("outfit_items", {}) # 获取内层字典
    
    # 核心单品校验（保留上衣下装的基础校验）
    if not outfit_data.get("top") or not outfit_data.get("bottom"):
         return {"status": "failed", "message": "推荐结果缺失核心单品"}

    # 构造推荐衣物的字典（适配image_gen_service的入参格式）
    outfit_items_obj = {
        "top": outfit_data.get("top"),
        "bottom": outfit_data.get("bottom")
    }
    # 如有外套则添加
    if "outer" in outfit_data and outfit_data["outer"]:
        outfit_items_obj["outer"] = outfit_data["outer"]

    # 构建用户画像字典
    user_profile = {
        "gender": req.gender,
        "style": req.style
    }
    gender_en = "man" if "男" in str(req.gender) else "woman"
    user_profile["gender"] = gender_en

    # 调用图片生成服务
    generated_image_url = None
    try:
        # 这里的 outfit_items_obj 已经是正确的结构了
        generated_image_url = await image_gen_service.generate_outfit_image(
            outfit_items_obj, 
            user_profile, 
            weather_ctx
        )
        logger.info(f"成功生成穿搭效果图: {generated_image_url}")
    except Exception as e:
        logger.error(f"生成穿搭效果图失败: {e}", exc_info=True)
        generated_image_url = None

    # 4. 生成 AI 点评
    outfit_desc_list = []
    for key, item in outfit_data.items():
        if item:
            outfit_desc_list.append(f"{_get_cn_label(key)}:{item.category_sub}({item.main_color})")
    
    outfit_desc = ", ".join(outfit_desc_list)

    # 使用推荐服务返回的 reasoning 作为上下文，或者直接用天气
    weather_desc = f"{weather_ctx['current']['temp_real']}度 {weather_ctx['current']['skycon']}"
    
    # 优先使用 recommendation_service 生成的 reasoning (因为它包含了画像逻辑)
    ai_reasoning = result.get("reasoning", "")
    
    comment = await ai_service.generate_outfit_comment(weather_desc, outfit_desc + f". 推荐逻辑: {ai_reasoning}")
    if isinstance(comment, dict) and "error" in comment:
        comment = f"这套搭配很适合今天！({ai_reasoning})"

    # 5. 格式化输出
    formatted_outfit = {}

    def format_item(item):
        if not item: return None
        return {
            "id": item.id,
            "name": f"{item.main_color}{item.category_sub}",
            "image_url": item.image_url,
            "warmth": item.warmth_level,
            "type": item.category_main,
            "gender": item.gender # ✅ 确保返回 gender
        }

    # 动态遍历所有单品类型，不再硬编码
    for key, item in outfit_data.items():
        formatted_outfit[key] = format_item(item)

    return {
        "status": "success",
        "weather_summary": f"{weather_desc}, {weather_ctx.get('summary_text', '')}",
        "outfit": formatted_outfit, # 现在包含所有动态的 key（top/bottom/outer/shoes/bag 等）
        "ai_comment": comment,
        "score": result.get("score", 0),
        "virtual_tryon_url": generated_image_url
    }

@app.post("/recommend/feedback", summary="记录用户对推荐的反馈")
def submit_feedback(req: schemas.FeedbackRequest, db: Session = Depends(get_db)):
    history = models.OutfitHistory(
        user_id=req.user_id,
        top_id=req.top_id,
        bottom_id=req.bottom_id,
        outer_id=req.outer_id,
        one_piece_id=req.one_piece_id,
        feedback_score=req.feedback_code,
        weather_temp=req.weather_temp,
        scenario="user_feedback"
    )
    db.add(history)
    db.commit()
    return {"status": "success", "message": "反馈已记录，系统将会学习您的偏好"}

@app.post("/items/generate_virtual", summary="生成虚拟衣物并入库")
async def generate_virtual_item(req: VirtualItemRequest, db: Session = Depends(get_db)):
    # 1. 准备属性字典
    attrs = req.dict()
    
    # 2. 调用 AI 生成图片链接
    img_url = await image_gen_service.generate_virtual_item_image(attrs)
    if not img_url:
        raise HTTPException(status_code=500, detail="AI 图片生成失败")
    
    # 3. 下载图片并保存到本地
    try:
        filename = f"virtual_{uuid4().hex}.jpg"
        local_path = os.path.join(VIRTUAL_DIR, filename).replace("\\", "/")
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(img_url)
            if resp.status_code == 200:
                # 写入文件
                with open(local_path, "wb") as f:
                    f.write(resp.content)
            else:
                raise Exception("无法下载 AI 生成的图片")
    except Exception as e:
        logger.error(f"Save virtual image failed: {e}")
        raise HTTPException(status_code=500, detail="图片保存失败")

    # 4. 构造数据库对象
    # 补全其他必填字段的默认值
    db_item = models.ClothingItem(
        user_id=req.user_id,
        image_url=local_path, # 存本地路径
        
        category_main=req.category_main,
        category_sub=req.category_sub,
        main_color=req.main_color,
        materials=req.materials,
        styles=req.styles,
        seasons=req.seasons,
        warmth_level=req.warmth_level,
        gender=req.gender,
        
        # 默认填充字段
        status="未拥有", # 核心标记
        color_pattern="纯色", 
        fit="合身",
        is_windproof=False,
        waterproof_level="无",
        breathability="中",
        occasions=["休闲"], # 默认场景
        embedding_vector=[] # 虚拟物品暂时没有向量
    )
    
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    return db_item

# ==========================================
# 新增：获取用户所有用过的风格和场景标签接口
# ==========================================
# 定义默认标签作为保底
DEFAULT_STYLES = ["休闲", "商务", "运动", "街头", "复古", "极简", "优雅", "日系", "工装", "甜酷"]
DEFAULT_SCENARIOS = ["通勤", "居家", "户外", "约会", "正式宴会", "旅行", "运动", "逛街"]

@app.get("/user/tags", summary="获取用户所有用过的风格和场景标签")
def get_user_tags(user_id: str, db: Session = Depends(get_db)):
    # 1. 查出用户所有衣服
    items = db.query(models.ClothingItem).filter(models.ClothingItem.user_id == user_id).all()
    
    # 2. 使用集合去重，初始化为默认标签
    style_set = set(DEFAULT_STYLES)
    occasion_set = set(DEFAULT_SCENARIOS)
    
    # 3. 遍历衣物，把自定义的标签加进去
    for item in items:
        # item.styles 是 JSON 列表，可能为空
        if item.styles:
            for s in item.styles:
                if s: style_set.add(s)
        
        # item.occasions 是 JSON 列表
        if item.occasions:
            for o in item.occasions:
                if o: occasion_set.add(o)
                
    return {
        "styles": list(style_set),
        "occasions": list(occasion_set)
    }