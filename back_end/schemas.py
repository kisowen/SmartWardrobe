from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

# 基础属性模型
class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str  # 返回给前端存起来
    username: str
    
class ItemBase(BaseModel):
    user_id: str = Field(..., description="用户唯一标识")
    category_main: str
    category_sub: str
    default_layer: Optional[str] = None
    
    warmth_level: int = Field(..., ge=1, le=5)
    materials: List[str]
    is_windproof: bool
    waterproof_level: str
    # 改为 Optional 并设置默认值 "中"
    breathability: Optional[str] = "中"
    collar_type: Optional[str] = None
    length_type: Optional[str] = None
    
    # 改为 Optional 并设置默认值 "纯色"
    color_pattern: Optional[str] = "纯色"
    main_color: str
    status: str = "正常"
    seasons: List[str]
    fit: str
    styles: List[str]
    # 改为 Optional 并设置默认空列表
    occasions: Optional[List[str]] = []
    gender: Optional[str] = "中性"
    
    # 接收前端回传的向量 (分析时生成，创建时存入)
    embedding_vector: Optional[List[float]] = None

class ItemCreate(ItemBase):
    image_url: str

class ItemResponse(ItemBase):
    id: int
    image_url: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ItemUpdate(BaseModel):
    user_id: Optional[str] = None
    category_main: Optional[str] = None
    category_sub: Optional[str] = None
    default_layer: Optional[str] = None
    warmth_level: Optional[int] = Field(None, ge=1, le=5)
    materials: Optional[List[str]] = None
    is_windproof: Optional[bool] = None
    waterproof_level: Optional[str] = None
    breathability: Optional[str] = None
    collar_type: Optional[str] = None
    length_type: Optional[str] = None
    color_pattern: Optional[str] = None
    main_color: Optional[str] = None
    status: Optional[str] = None
    seasons: Optional[List[str]] = None
    fit: Optional[str] = None
    styles: Optional[List[str]] = None
    occasions: Optional[List[str]] = None

class RecommendationRequest(BaseModel):
    user_id: str
    scenario: str
    style: str
    location: str = "厦门市"
    gender: str = "男士"
    target_categories: List[str] = ["上衣", "裤子"]

class FeedbackRequest(BaseModel):
    user_id: str
    top_id: Optional[int] = None   
    bottom_id: Optional[int] = None 
    outer_id: Optional[int] = None
    one_piece_id: Optional[int] = None
    feedback_code: int 
    weather_temp: int
    gender: str = "中性"

class UserProfileBase(BaseModel):
    thermal_sensitivity: int = 0
    sweat_tendency: bool = False
    body_shape: str = "标准"
    commute_method: str = "骑行"
    occupation: str = "学生"
    fit_preference: str = "合身"
    avoid_colors: List[str] = []
    preferred_styles: List[str] = []
    preferred_colors: List[str] = []

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileResponse(UserProfileBase):
    user_id: str
    updated_at: datetime
    
    class Config:
        from_attributes = True