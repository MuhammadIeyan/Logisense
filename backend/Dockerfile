# 1. Start with a lightweight Linux server running Python 3.12
FROM python:3.12-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Install system dependencies required by XGBoost and ML libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy the requirements file and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy all the AI models, scripts, and API code into the container
COPY . .

# 6. Expose the port FastAPI uses
EXPOSE 8000

# 7. Start the Uvicorn server automatically when the container boots
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]