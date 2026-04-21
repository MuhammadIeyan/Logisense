from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib
import xgboost as xgb
import shap
import google.generativeai as genai
import os
import io

from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# 1. LOAD THE NEW ADVANCED MODELS
print("Loading Advanced ML Models...")
model = joblib.load('logisense_advanced_xgb.joblib')
explainer = joblib.load('logisense_advanced_shap.joblib')
expected_features = joblib.load('advanced_expected_features.joblib')
print("Advanced Models loaded successfully!")

# 2. UPGRADE THE DATA SCHEMA TO INCLUDE GEOGRAPHY
class OrderData(BaseModel):
    scheduled_days: int
    shipping_mode: str
    order_month: int
    order_day_of_week: int
    order_type: str
    order_region: str
    market: str

@app.post("/predict")
async def predict(order: OrderData):
    # Create an empty dataframe with the exact columns the new model expects
    input_df = pd.DataFrame(0, index=[0], columns=expected_features)
    
    # Fill in the numerical values
    input_df.at[0, 'Days for shipment (scheduled)'] = order.scheduled_days
    input_df.at[0, 'Order_Month'] = order.order_month
    input_df.at[0, 'Order_DayOfWeek'] = order.order_day_of_week
    
    # Fill in the categorical values (One-Hot Encoding)
    if f"Shipping Mode_{order.shipping_mode}" in input_df.columns:
        input_df.at[0, f"Shipping Mode_{order.shipping_mode}"] = 1
    if f"Type_{order.order_type}" in input_df.columns:
        input_df.at[0, f"Type_{order.order_type}"] = 1
    if f"Order Region_{order.order_region}" in input_df.columns:
        input_df.at[0, f"Order Region_{order.order_region}"] = 1
    if f"Market_{order.market}" in input_df.columns:
        input_df.at[0, f"Market_{order.market}"] = 1

    # 1. BASELINE PREDICTION
    probability = model.predict_proba(input_df)[0][1]
    is_late = bool(probability > 0.40)
    
    # 2. RUN SHAP (Game Theory Impacts)
    shap_values = explainer.shap_values(input_df)
    feature_impacts = []
    for i, feature_name in enumerate(expected_features):
        impact = float(shap_values[0][i])
        if abs(impact) > 0.05:
            feature_impacts.append({"feature": feature_name, "impact": impact})
            
    feature_impacts = sorted(feature_impacts, key=lambda x: abs(x["impact"]), reverse=True)[:5]
    
    # 3. THE COUNTERFACTUAL SIMULATION ENGINE
    simulation_text = "No simulation required (Baseline risk is within acceptable SLA parameters)."
    
    # If it's high risk, and we aren't already using the fastest mode, run a simulation
    if is_late and order.shipping_mode not in ["First Class", "Same Day"]:
        # Create a digital twin of the input data
        simulated_df = input_df.copy()
        
        # Turn off the current shipping mode
        if f"Shipping Mode_{order.shipping_mode}" in simulated_df.columns:
            simulated_df.at[0, f"Shipping Mode_{order.shipping_mode}"] = 0
            
        # Turn on the upgraded shipping mode
        if "Shipping Mode_First Class" in simulated_df.columns:
            simulated_df.at[0, "Shipping Mode_First Class"] = 1
            
        # Run the simulation through XGBoost
        simulated_prob = model.predict_proba(simulated_df)[0][1]
        risk_reduction = (probability - simulated_prob) * 100
        
        # Evaluate the ROI of the simulation
        if risk_reduction > 10.0:
            simulation_text = f"SIMULATION SUCCESS: Upgrading to First Class reduces delay risk from {probability*100:.1f}% down to {simulated_prob*100:.1f}% (an absolute reduction of {risk_reduction:.1f}%)."
        else:
            simulation_text = f"SIMULATION FAILED: Upgrading to First Class only reduces risk by {risk_reduction:.1f}%. The risk reduction does not justify the premium freight cost. Look for regional routing alternatives."

    # 4. GENERATE ROI-FOCUSED LLM INSIGHT
    llm_insight = "LLM Insight unavailable. Please check API Key."
    if GEMINI_API_KEY:
        try:
            llm_model = genai.GenerativeModel('gemini-2.5-flash')
            prompt = f"""
            You are a senior supply chain strategist advising a logistics manager.
            Target Market: {order.market} ({order.order_region})
            Baseline Delay Risk: {probability*100:.1f}%
            
            Systemic delay drivers (SHAP): {feature_impacts}
            
            Simulation Engine Output:
            {simulation_text}
            
            CRITICAL CONSTRAINTS:
            1. Analyze the Simulation Engine Output. If the simulation succeeded, write a 2-sentence business justification to approve the premium upgrade cost.
            2. If the simulation failed (or wasn't run), recommend a specific, non-obvious operational intervention based strictly on the SHAP drivers.
            3. DO NOT give generic advice (e.g., "monitor the situation" or "optimize timelines"). Focus on ROI, system optimization, and protecting the SLA.
            """
            response = llm_model.generate_content(prompt)
            llm_insight = response.text
        except Exception as e:
            print(f"Gemini Error: {e}")
            
    return {
        "probability": float(probability),
        "is_late": is_late,
        "top_reasons": feature_impacts,
        "llm_insight": llm_insight
    }

@app.post("/predict_batch")
async def predict_batch(file: UploadFile = File(...)):
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    
    batch_input = pd.DataFrame(0, index=np.arange(len(df)), columns=expected_features)
    
    # Safely map the advanced batch data
    if 'Days for shipment (scheduled)' in df.columns:
        batch_input['Days for shipment (scheduled)'] = df['Days for shipment (scheduled)']
    if 'Order_Month' in df.columns:
        batch_input['Order_Month'] = df['Order_Month']
    if 'Order_DayOfWeek' in df.columns:
        batch_input['Order_DayOfWeek'] = df['Order_DayOfWeek']
        
    for i, row in df.iterrows():
        if 'Shipping Mode' in df.columns and f"Shipping Mode_{row['Shipping Mode']}" in batch_input.columns:
            batch_input.at[i, f"Shipping Mode_{row['Shipping Mode']}"] = 1
        if 'Type' in df.columns and f"Type_{row['Type']}" in batch_input.columns:
            batch_input.at[i, f"Type_{row['Type']}"] = 1
        if 'Order Region' in df.columns and f"Order Region_{row['Order Region']}" in batch_input.columns:
            batch_input.at[i, f"Order Region_{row['Order Region']}"] = 1
        if 'Market' in df.columns and f"Market_{row['Market']}" in batch_input.columns:
            batch_input.at[i, f"Market_{row['Market']}"] = 1

    probabilities = model.predict_proba(batch_input)[:, 1]
    total_orders = len(df)
    high_risk_orders = sum(prob > 0.40 for prob in probabilities)
    average_risk = (sum(probabilities) / total_orders) * 100
    
    return {
        "total_processed": total_orders,
        "high_risk_count": int(high_risk_orders),
        "average_risk_percentage": float(average_risk)
    }