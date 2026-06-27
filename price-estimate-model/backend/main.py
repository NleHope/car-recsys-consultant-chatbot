from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import joblib
import re
import torch
import io
import sys
from PIL import Image
from transformers import AutoImageProcessor, AutoModel
import catboost as cb
import lightgbm as lgb
import xgboost as xgb
import warnings

# Tích hợp bộ Parse NLP
try:
    from title_parser import parse_title
except ImportError:
    print("❌ LỖI NGHIÊM TRỌNG: Không tìm thấy file 'title_parser.py' trong cùng thư mục!")
    sys.exit(1)

warnings.filterwarnings('ignore')

# =====================================================================
# 1. KHỞI TẠO FASTAPI VÀ CẤU HÌNH CORS
# =====================================================================
app = FastAPI(title="Car Valuation API - V7 (Full Power)", version="7.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Liveness + model-loaded probe (used to verify a deploy)."""
    return {"status": "ok", "model_loaded": "meta_model" in globals()}

# =====================================================================
# 2. LOAD ARTIFACTS (V7)
# =====================================================================
print("⏳ Đang nạp hệ thống AI V7 (9.83% MAPE)...")
ARTIFACTS_DIR = "./model_artifacts" 

try:
    pca = joblib.load(f"{ARTIFACTS_DIR}/pca.pkl")
    te_mappings = joblib.load(f"{ARTIFACTS_DIR}/target_encodings.pkl")
    meta_model = joblib.load(f"{ARTIFACTS_DIR}/meta_model.pkl")
    config = joblib.load(f"{ARTIFACTS_DIR}/config.pkl")
    
    anchor_stats = joblib.load(f"{ARTIFACTS_DIR}/anchor_stats.pkl")
    anchor_broad = joblib.load(f"{ARTIFACTS_DIR}/anchor_broad.pkl")
    engine_disp_median = joblib.load(f"{ARTIFACTS_DIR}/engine_disp_median.pkl")

    model_cb = cb.CatBoostRegressor()
    model_cb.load_model(f"{ARTIFACTS_DIR}/cb_model.cbm")
    
    model_lgb = lgb.Booster(model_file=f"{ARTIFACTS_DIR}/lgb_model.txt")
    
    model_xgb = xgb.XGBRegressor()
    model_xgb.load_model(f"{ARTIFACTS_DIR}/xgb_model.json")
    
    GLOBAL_MEDIAN_PRICE_LOG = np.log1p(28000)
    
    # Load LabelEncoders cho LightGBM nếu có (xem hướng dẫn artifacts)
    try:
        lgb_label_encoders = joblib.load(f"{ARTIFACTS_DIR}/lgb_label_encoders.pkl")
        print("✅ LightGBM LabelEncoders loaded.")
    except FileNotFoundError:
        lgb_label_encoders = None
        print("⚠️  lgb_label_encoders.pkl không tìm thấy — LGBMRegressor sẽ dùng factorize fallback (kém chính xác hơn). Xem BUG FIX 2.")

    print("✅ Load 3 Base Models & Meta Model V7 thành công!")
except Exception as e:
    print(f"❌ Lỗi load model V7. Chi tiết: {e}")

# =====================================================================
# 3. KHỞI TẠO MẮT THẦN DINOv2
# =====================================================================
print("⏳ Đang khởi tạo DINOv2-Small...")
try:
    processor = AutoImageProcessor.from_pretrained("facebook/dinov2-small")
    dino = AutoModel.from_pretrained("facebook/dinov2-small").eval()
    print("✅ Hệ thống đã sẵn sàng nhận Request!")
except Exception as e:
    print(f"❌ Lỗi load DINOv2. Chi tiết: {e}")

# =====================================================================
# 4. BỘ LỌC CHUẨN HÓA DỮ LIỆU & ENGINE PARSER
# =====================================================================
class InputNormalizer:
    @staticmethod
    def _clean_text(text: str) -> str:
        if not text or not str(text).strip(): return "Unknown"
        return " ".join(str(text).split()).title()

    @staticmethod
    def get_age_group(age):
        if age <= 3: return "1_3_yrs"
        elif age <= 7: return "4_7_yrs"
        elif age <= 12: return "8_12_yrs"
        else: return "over_12_yrs"
        
    @staticmethod
    def get_year_bucket(year):
        if year <= 2017: return 'pre2018'
        elif year <= 2020: return '2018_20'
        elif year <= 2022: return '2021_22'
        elif year <= 2024: return '2023_24'
        else: return '2025plus'

_CYL_PATTERNS = [
    (r'V12', 'V12'), (r'V8', 'V8'), (r'V6', 'V6'),
    (r'I6',  'I6'),  (r'I5', 'I5'), (r'I4', 'I4'),
    (r'I3',  'I3'),  (r'Boxer-6', 'Boxer6'), (r'Boxer-4', 'Boxer4'),
]
def _get_cyl(s):
    for pat, name in _CYL_PATTERNS:
        if re.search(pat, str(s)): return name
    return 'Electric' if 'Electric' in str(s) else 'other'

def parse_engine_v7(s):
    s = str(s)
    is_turbo  = int('Turbo' in s)
    is_sc     = int('Supercharged' in s)
    is_diesel = int(any(x in s for x in ['Diesel', 'Cummins', 'Duramax', 'PowerStroke']))
    is_hybrid = int('Hybrid' in s)
    is_electric = int(s.strip() == 'Electric')
    
    m = re.search(r'(\d+\.?\d*)L', s)
    disp = float(m.group(1)) if m else engine_disp_median if not is_electric else 0.0
    cyl = _get_cyl(s)
    
    tier = 'other'
    if is_electric: tier = 'electric'
    elif is_diesel: tier = 'diesel'
    elif is_hybrid: tier = 'hybrid'
    elif cyl == 'V12': tier = 'ultra'
    elif cyl == 'V8' and (is_sc or is_turbo or disp >= 6.2): tier = 'v8_high'
    elif cyl == 'V8': tier = 'v8_std'
    elif cyl == 'I6': tier = 'i6'
    elif cyl in ('V6', 'Boxer6') and (is_turbo or disp >= 3.5): tier = 'v6_high'
    elif cyl in ('V6', 'Boxer6'): tier = 'v6_std'
    elif cyl in ('I4', 'Boxer4') and (is_turbo or disp >= 2.3): tier = 'i4_high'
    elif cyl in ('I4', 'Boxer4'): tier = 'i4_std'
    elif cyl == 'I3': tier = 'i3'

    return disp, tier, is_turbo, is_diesel, is_hybrid, is_sc, is_electric

# =====================================================================
# 5. API ENDPOINT ĐỊNH GIÁ
# =====================================================================
@app.post("/predict_price")
async def predict_car_price(
    title: str = Form(...),
    brand: str = Form(...),
    model_style: str = Form(...),
    engine: str = Form(...),
    fuel_type: str = Form(...),
    transmission: str = Form(...),
    exterior_color: str = Form(...),
    condition: str = Form("Used"),
    year: int = Form(...),
    mileage: int = Form(...),
    rating_reliability: float = Form(4.5),
    rating_performance: float = Form(4.5),
    rating_exterior: float = Form(4.5),
    rating_interior: float = Form(4.5),
    rating_comfort: float = Form(4.5),
    has_accidents: str = Form("NO"),
    warranty: str = Form("NO"),
    images: list[UploadFile] = File(None)
):
    try:
        # --- BƯỚC 1: LÀM SẠCH INPUT ---
        raw_brand = InputNormalizer._clean_text(brand)
        model_style = InputNormalizer._clean_text(model_style)
        
        # [SỬA LỖI CHÍ MẠNG 1]: Tích hợp title_parser để lấy model_name và cờ ẩn
        parsed_title_dict = parse_title(str(title), str(raw_brand))
        
        final_brand = parsed_title_dict['brand']
        model_name = parsed_title_dict['model_name']
        trim = parsed_title_dict['trim']
        drivetrain = parsed_title_dict['drivetrain']
        is_ev_hybrid = parsed_title_dict['is_ev_hybrid']
        is_offroad = parsed_title_dict['is_offroad']
            
        # Chuẩn hóa Transmission (U2) & Color (U3)
        trans_norm = "Other"
        t_low = str(transmission).lower()
        if 'cvt' in t_low: trans_norm = 'CVT'
        elif 'manual' in t_low or ' mt' in t_low: trans_norm = 'Manual'
        elif 'dct' in t_low or 'dual' in t_low or 'dsg' in t_low or 'pdk' in t_low: trans_norm = 'DCT'  # [BUG FIX 4] thêm pdk
        elif 'automatic' in t_low or 'auto' in t_low: trans_norm = 'Automatic'
            
        # [BUG FIX 1] Color normalization: khớp đủ 9 categories + keywords với v7 training
        color_norm = "Other"
        c_low = str(exterior_color).lower()
        if any(x in c_low for x in ['black','ebony','onyx','obsidian','jet','noir','agate']):
            color_norm = 'Black'
        elif any(x in c_low for x in ['white','pearl','ivory','cream','oxford','ice cap','snow','summit','platinum']):
            color_norm = 'White'
        elif any(x in c_low for x in ['silver','gray','grey','graphite','granite','gun metal','titanium','pewter','celestial silver']):
            color_norm = 'Silver_Gray'
        elif any(x in c_low for x in ['red','scarlet','ruby','crimson','cherry','maroon','burgundy','flame']):
            color_norm = 'Red'
        elif any(x in c_low for x in ['blue','navy','cobalt','sapphire','celestial blue','steel blue','velocity blue']):
            color_norm = 'Blue'
        elif any(x in c_low for x in ['brown','tan','bronze','copper','mocha','beige','sand','champagne','cognac']):
            color_norm = 'Brown_Tan'
        elif any(x in c_low for x in ['green','olive','forest','emerald','sage','dark forest']):
            color_norm = 'Green'
        elif any(x in c_low for x in ['yellow','gold','amber','orange','sunglow']):
            color_norm = 'Yellow_Gold'

        # --- BƯỚC 2: FEATURE ENGINEERING V7 ---
        current_year = 2026
        car_age = max(1, current_year - year)
        brand_model = f"{final_brand}_{model_name}"
        age_group = InputNormalizer.get_age_group(car_age)
        depreciation_profile = f"{brand_model}_{trim}_{age_group}"
        
        # Engine Features
        disp, engine_tier, is_turbo, is_diesel, is_hybrid, is_sc, is_electric = parse_engine_v7(engine)
        
        # Numeric Cross Features
        mileage_log = np.log1p(mileage)
        # [BUG FIX 3] mileage_age_ratio đã bị xóa — feature này không tồn tại trong v7 training
        age_x_mileage_log = car_age * mileage_log
        displacement_x_age = disp * car_age
        
        LUXURY_BRANDS = {'BMW', 'Mercedes-Benz', 'Audi', 'Lexus', 'Porsche', 'Cadillac', 'Volvo', 'Infiniti', 'Acura', 'Lincoln', 'Alfa Romeo', 'Genesis', 'Land Rover', 'Jaguar', 'Maserati', 'Bentley', 'Ferrari', 'Lamborghini'}
        is_luxury = 1 if final_brand in LUXURY_BRANDS else 0
        rating_mean = (rating_reliability + rating_performance + rating_exterior + rating_interior + rating_comfort) / 5
        luxury_x_rating = is_luxury * rating_mean
        style_is_truck_suv = 1 if model_style in ['SUV', 'Pickup Truck'] else 0
        accidents_x_age = (1 if has_accidents.upper() == 'YES' else 0) * car_age
        
        # --- BƯỚC 3: ANCHOR FEATURES & TARGET ENCODING (U4 & U8) ---
        year_bucket = InputNormalizer.get_year_bucket(year)
        anchor_key = f"{final_brand}_{model_style}_{year_bucket}"
        anchor_key_broad = f"{final_brand}_{model_style}"
        
        anchor_median = anchor_stats.get(anchor_key, np.expm1(GLOBAL_MEDIAN_PRICE_LOG))
        anchor_median_broad = anchor_broad.get(anchor_key_broad, np.expm1(GLOBAL_MEDIAN_PRICE_LOG))
        
        # Map biến cục bộ để Target Encoding nội suy
        te_vars = {
            'brand_model': brand_model, 'trim': trim, 
            'depreciation_profile': depreciation_profile, 'engine': engine, 
            'anchor_key': anchor_key, 'model_style': model_style
        }
        
        te_features = {}
        for col in config['encode_cols']:
            val = te_vars.get(col, "Unknown")
            mapping_dict = te_mappings.get(col, {})
            global_mean = te_mappings.get(f'{col}_global_mean', 0)
            te_features[f'te_{col}'] = mapping_dict.get(val, global_mean)

        # --- BƯỚC 4: XỬ LÝ ẢNH BẰNG DINOv2 + PCA ---
        valid_imgs = []
        if images:
            for file in images:
                try:
                    img_bytes = await file.read()
                    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                    valid_imgs.append(img)
                except: pass 
                
        if len(valid_imgs) == 0:
            avg_raw_emb = np.zeros(384) 
        else:
            inputs = processor(images=valid_imgs, return_tensors="pt")
            with torch.no_grad():
                feature_vectors = dino(**inputs).last_hidden_state[:, 0, :].numpy()
            avg_raw_emb = np.mean(feature_vectors, axis=0)
        
        emb_pca = pca.transform(avg_raw_emb.reshape(1, -1))[0]

        # --- BƯỚC 5: XÂY DỰNG DATAFRAME CHO MÔ HÌNH ---
        input_dict = {
            'brand': final_brand, 'model_name': model_name, 'trim': trim, 'brand_model': brand_model,
            'fuel_type': fuel_type, 'transmission_norm': trans_norm, 'color_norm': color_norm,
            'model_style': model_style, 'condition': condition, 'age_group': age_group,
            'depreciation_profile': depreciation_profile, 'drivetrain': drivetrain,
            'engine': engine, 'engine_tier': engine_tier, 'year_bucket': year_bucket,
            'anchor_key': anchor_key, 'anchor_key_broad': anchor_key_broad,
            
            # Numeric
            'year': year, 'mileage': mileage, 'car_age': car_age, 
            'mileage_per_year': mileage / car_age, 'mileage_sqrt': np.sqrt(mileage), 
            'mileage_log': mileage_log, 'age_sq': car_age ** 2,
            
            # V7 Specifics
            # [BUG FIX 3] 'mileage_age_ratio' đã bị xóa — không có trong training features
            'mileage_pct_in_age_group': 0.5, 
            'mileage_pct_in_brand_age': 0.5,
            'anchor_median': anchor_median, 'anchor_median_broad': anchor_median_broad,
            'log_anchor_median': np.log1p(anchor_median), 'log_anchor_median_broad': np.log1p(anchor_median_broad),
            'age_x_mileage_log': age_x_mileage_log, 'luxury_x_rating': luxury_x_rating,
            'accidents_x_age': accidents_x_age, 'displacement_x_age': displacement_x_age,
            'style_is_truck_suv': style_is_truck_suv,
            'engine_displacement_L': disp, 'engine_is_turbo': is_turbo, 'engine_is_diesel': is_diesel,
            'engine_is_hybrid': is_hybrid, 'engine_is_supercharged': is_sc, 'engine_is_electric': is_electric,
            
            # Từ title_parser
            'is_ev_hybrid': is_ev_hybrid, 'is_offroad': is_offroad,
            
            # Rating & Flags
            'has_warranty': 1 if warranty.upper() == 'YES' else 0,
            'has_accidents_flag': 1 if has_accidents.upper() == 'YES' else 0,
            'is_luxury': is_luxury,
            'rating_reliability': rating_reliability, 'rating_performance': rating_performance,
            'rating_exterior': rating_exterior, 'rating_interior': rating_interior, 'rating_comfort': rating_comfort,
            'rating_mean': rating_mean, 'rating_min': min(rating_reliability, rating_performance, rating_exterior, rating_interior, rating_comfort),
            'rating_std': np.std([rating_reliability, rating_performance, rating_exterior, rating_interior, rating_comfort]), 
            'rating_luxury_score': rating_exterior * 0.4 + rating_interior * 0.4 + rating_comfort * 0.2,
        }
        
        # Thêm TE và PCA
        input_dict.update(te_features)
        for i in range(config['best_pca_comp']): input_dict[f'emb_{i}'] = emb_pca[i]
            
        df_infer = pd.DataFrame([input_dict])
        cat_cols = config['cat_features']
        
        # --- BƯỚC 6: SUY LUẬN (INFERENCE) VÀ STACKING ---
        
        # 6.1 CatBoost (Xử lý chuỗi)
        cb_features = model_cb.feature_names_
        df_cb = df_infer.reindex(columns=cb_features).copy()
        for col in cat_cols:
            if col in df_cb.columns: df_cb[col] = df_cb[col].astype(str)
        pred_cb = model_cb.predict(df_cb)[0]
        
        # 6.2 LightGBM
        # [BUG FIX 2] Training dùng LabelEncoder(int), không phải pandas category.
        # Nếu lgb_label_encoders.pkl có sẵn → dùng exact mapping.
        # Nếu không → factorize theo sorted order (fallback, kém hơn).
        lgb_features = model_lgb.feature_name()
        df_lgb = df_infer.reindex(columns=lgb_features).copy()
        for col in cat_cols:
            if col not in df_lgb.columns:
                continue
            val = str(df_lgb[col].iloc[0])
            if lgb_label_encoders is not None:
                le = lgb_label_encoders.get(col)
                if le is not None:
                    encoded = le.transform([val])[0] if val in le.classes_ else 0
                else:
                    encoded = 0
            else:
                # Fallback: factorize với sorted categories (không khớp training nhưng tránh crash)
                df_lgb[col] = df_lgb[col].astype('category')
                encoded = df_lgb[col].cat.codes.iloc[0]
            df_lgb[col] = encoded
        pred_lgb = model_lgb.predict(df_lgb)[0]
        
        # 6.3 XGBoost (Ép Category)
        xgb_features = model_xgb.get_booster().feature_names
        df_xgb = df_infer.reindex(columns=xgb_features).copy()
        for col in cat_cols:
            if col in df_xgb.columns: df_xgb[col] = df_xgb[col].astype('category')
        pred_xgb = model_xgb.predict(df_xgb)[0]
        
        # META MODEL BLENDING
        meta_features = np.column_stack(([pred_cb], [pred_lgb], [pred_xgb]))
        log_final_price = meta_model.predict(meta_features)[0]
        
        final_price_usd = np.expm1(log_final_price)
        
        # Áp dụng dải băng lỗi ±9.83% theo thành tích của V7
        price_low = final_price_usd * (1 - 0.0983) 
        price_high = final_price_usd * (1 + 0.0983)
        
        return {
            "status": "success",
            "car_info": f"{year} {final_brand} {model_name} {trim} ({engine})",
            "dino_vector_status": "Small 384d OK" if len(valid_imgs) > 0 else "Fallback Zeros",
            "estimated_price_usd": round(final_price_usd, -2), 
            "price_range_usd": {"low": round(price_low, -2), "high": round(price_high, -2)},
            "debug_diagnostics": {
                "cb": round(np.expm1(pred_cb)), "lgb": round(np.expm1(pred_lgb)), "xgb": round(np.expm1(pred_xgb))
            }
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))