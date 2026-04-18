import google.generativeai as genai

# Paste your API key here!
genai.configure(api_key="AIzaSyD96LiuLoxbe3skB3q1B2PyGDuvs3FcljQ")

print("Checking available models for your API key...\n")

try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print(f"Error connecting to Google: {e}")