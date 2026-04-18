from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import joblib
import xgboost as xgb
import shap
import google.generativeai as genai
import os

# ==========================================
# 1. SETUP GEMINI API (Paste your key here!)
# ==========================================
# We will securely inject this password via the cloud dashboard later
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
llm = genai.GenerativeModel('gemini-2.5-flash')

# Initialize the API
app = FastAPI(title="LogiSense AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the ML Models
print("Loading ML Models...")
model = joblib.load('logisense_xgb_model.joblib')
explainer = joblib.load('logisense_shap_explainer.joblib')
expected_features = joblib.load('model_features.joblib')
print("Models loaded successfully!")

class ShipmentData(BaseModel):
    scheduled_days: int
    shipping_mode: str
    order_month: int
    order_type: str

@app.post("/predict")
def predict_risk(data: ShipmentData):
    
    input_dict = {feature: 0 for feature in expected_features}
    input_dict['Days for shipment (scheduled)'] = data.scheduled_days
    input_dict['Order_Month'] = data.order_month
    
    if f"Shipping Mode_{data.shipping_mode}" in input_dict:
        input_dict[f"Shipping Mode_{data.shipping_mode}"] = 1
    if f"Type_{data.order_type}" in input_dict:
        input_dict[f"Type_{data.order_type}"] = 1
        
    input_df = pd.DataFrame([input_dict])
    
    # 1. GET THE MATH PREDICTION
    probability = float(model.predict_proba(input_df)[0, 1])
    is_late = bool(probability > 0.40) 
    
    # 2. GET THE SHAP REASONS
    shap_values = explainer.shap_values(input_df)
    feature_impacts = []
    for i, feature_name in enumerate(expected_features):
        impact = float(shap_values[0][i])
        if impact != 0:
            feature_impacts.append({"feature": feature_name, "impact": impact})
            
    feature_impacts.sort(key=lambda x: abs(x["impact"]), reverse=True)
    top_3_reasons = feature_impacts[:3]
    
    # ==========================================
    # 3. ASK GEMINI TO ANALYZE THE MATH
    # ==========================================
    # We build a prompt using the live math data
    prompt = f"""
    You are an expert Chief Supply Chain Officer. Analyze this shipping data:
    - Delay Risk: {probability * 100:.1f}%
    - Top Mathematical Drivers: {top_3_reasons}
    
    Write a 2-3 sentence strategic briefing. 
    Explain in plain, professional English why this is happening based ONLY on the data provided, and recommend one quick operational action to mitigate the risk. Do not use markdown formatting.
    """
    
    # Call the LLM
    try:
        response = llm.generate_content(prompt)
        llm_insight = response.text
    except Exception as e:
        print(f"🚨 GEMINI ERROR: {e}") # This prints the real error in your terminal
        llm_insight = f"API Error: {str(e)}" # This sends the real error to your React dashboard
    
    # 4. SEND EVERYTHING TO REACT
    return {
        "probability": probability,
        "is_late": is_late,
        "top_reasons": top_3_reasons,
        "llm_insight": llm_insight  # We added the LLM text to the payload!
    }