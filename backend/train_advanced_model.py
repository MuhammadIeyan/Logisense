import pandas as pd
import numpy as np
import xgboost as xgb
import shap
import joblib

print("Loading massive DataCo dataset (this might take a few seconds)...")
# Note: This specific Kaggle dataset often requires 'latin-1' encoding to load properly!
df = pd.read_csv('../DataCoSupplyChainDataset.csv', encoding='latin-1')

print(f"Dataset loaded! Processing {len(df)} logistics records...")

# 1. FEATURE ENGINEERING: Extracting Time and Seasonality
print("Extracting seasonality and temporal features...")
# Convert the order date to a datetime object
df['Order Date'] = pd.to_datetime(df['order date (DateOrders)'])
df['Order_Month'] = df['Order Date'].dt.month
df['Order_DayOfWeek'] = df['Order Date'].dt.dayofweek

# 2. SELECTING THE VITAL FEATURES
# We select a mix of scheduled parameters, transaction types, and geographic routing
features = [
    'Days for shipment (scheduled)', 
    'Order_Month', 
    'Order_DayOfWeek',
    'Shipping Mode', 
    'Type', 
    'Order Region',
    'Market'
]

X = df[features].copy()
y = df['Late_delivery_risk']

# 3. DATA PREPARATION: One-Hot Encoding
# XGBoost needs numbers, not text. This converts categorical columns into binary (1 or 0) columns.
print("Vectorizing geographic and categorical features...")
X_encoded = pd.get_dummies(X, columns=['Shipping Mode', 'Type', 'Order Region', 'Market'])
X_encoded = X_encoded.astype(float)

# Save the exact column layout so our FastAPI backend knows what shape to expect later
expected_features = list(X_encoded.columns)
joblib.dump(expected_features, 'advanced_expected_features.joblib')

# 4. TRAIN THE XGBOOST MODEL
print("Training the Advanced XGBoost Classifier...")
model = xgb.XGBClassifier(
    n_estimators=150, 
    learning_rate=0.1, 
    max_depth=6, 
    random_state=42,
    eval_metric='logloss',
    n_jobs=-1 # Uses all your CPU cores to train faster!
)
model.fit(X_encoded, y)

# 5. BUILD THE SHAP EXPLAINER (Game Theory Math)
print("Calculating SHAP global feature impacts...")
# We use a random sample for the explainer to save memory, as 180k rows will crash most laptops
explainer = shap.TreeExplainer(model, data=shap.sample(X_encoded, 500))

# 6. SAVE THE BRAIN
print("Saving the models to disk...")
joblib.dump(model, 'logisense_advanced_xgb.joblib')
joblib.dump(explainer, 'logisense_advanced_shap.joblib')

print("SUCCESS! Advanced AI Models successfully trained and exported.")