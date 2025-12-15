from sqlalchemy import Column, Integer, String, JSON, DateTime, Boolean, Float
from sqlalchemy.sql import func
from database import Base

class ClothingItem(Base):
    __tablename__ = "clothing_items"

    id = Column(Integer, primary_key=True, index=True)
    
    # --- 基础信息 ---
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(String, default="default_user", index=True)
    
    # --- 1. 核心分类 ---
    category_main = Column(String, index=True)  # 上衣/下装/连身装/鞋包配饰
    category_sub = Column(String, index=True)   # 子类目
    default_layer = Column(String, nullable=True)  # 上衣层级(Base/Mid/Outer等)
    
    # --- 2. 气象与物理属性 ---
    warmth_level = Column(Integer)  # 1-5
    materials = Column(JSON)         # 材质成分
    is_windproof = Column(Boolean)   # 防风性
    waterproof_level = Column(String)# 防水性
    breathability = Column(String)   # 透气性
    collar_type = Column(String, nullable=True)
    length_type = Column(String, nullable=True)
    
    # --- 3. 基础外观与状态 ---
    color_pattern = Column(String)
    main_color = Column(String)
    status = Column(String, default="正常")
    seasons = Column(JSON)
    fit = Column(String)
    gender = Column(String, default="中性")
    
    # --- 4. 场景与风格 ---
    styles = Column(JSON)
    occasions = Column(JSON)

    # --- 5. 核心推荐特征 ---
    # 存储 CLIP 视觉向量 (List[float])，用于计算搭配兼容度
    embedding_vector = Column(JSON, nullable=True)

class OutfitHistory(Base):
    """
    穿搭历史记录表 (数据闭环的核心)
    """
    __tablename__ = "outfit_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    date = Column(DateTime(timezone=True), server_default=func.now())
    one_piece_id = Column(Integer, nullable=True)
    
    # 记录当时的上下文
    weather_temp = Column(Integer)  # 当时气温
    weather_desc = Column(String)   # 当时天气
    scenario = Column(String)       # 场景
    
    # 推荐的组合 (存 Item ID)
    top_id = Column(Integer, nullable=True)
    bottom_id = Column(Integer, nullable=True)
    outer_id = Column(Integer, nullable=True)
    
    # 用户反馈: 1:采纳, 0:忽略, -1:太冷, -2:太热, -3:风格不搭
    feedback_score = Column(Integer, default=0)
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True) # 关联 User 表的 username 或 uid
    
    # 1. 生理感知
    thermal_sensitivity = Column(Integer, default=0) # -2:极怕冷, -1:怕冷, 0:正常, 1:怕热, 2:极怕热
    sweat_tendency = Column(Boolean, default=False)  # 是否易出汗
    body_shape = Column(String, default="标准")      # 梨形, 苹果形, 倒三角, H形
    
    # 2. 场景与生活
    commute_method = Column(String, default="骑行") # 驾车, 地铁/公交, 骑行, 步行
    occupation = Column(String, default="学生") # 金融/体制内, 学生, 户外...
    
    # 3. 审美偏好
    fit_preference = Column(String, default="合身")  # 修身, 合身, 宽松
    avoid_colors = Column(JSON, default=[])          # 讨厌的颜色列表
    preferred_colors = Column(JSON, default=[])
    preferred_styles = Column(JSON, default=[])      # 偏好风格列表

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())