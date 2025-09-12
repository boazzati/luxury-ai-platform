import os
import uuid
import redis
from flask import Flask, request, jsonify
from flask_cors import CORS
from rq import Queue
from rq.job import Job
import openai
import time
import hashlib

# --- Configuration ---
app = Flask(__name__)
CORS(app) # Enable CORS for frontend requests

redis_url = os.getenv("REDIS_URL")
if not redis_url:
    raise ValueError("REDIS_URL environment variable is required")
redis_conn = redis.from_url(redis_url)

# RQ Queue
q = Queue("ai_analysis", connection=redis_conn)

# OpenAI API Key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Simple in-memory cache for this MVP
cache = {}

# --- AI Worker Function ---
def perform_ai_analysis(prompt, input_data):
    """The worker function that calls the OpenAI API."""
    try:
        # Simple caching mechanism
        cache_key = hashlib.md5((prompt + input_data).encode()).hexdigest()
        if cache_key in cache:
            return cache[cache_key]

        # Construct the prompt for GPT-4o
        full_prompt = f"{prompt}\n\nInput: {input_data}"

        # Call the OpenAI API with retry logic
        for attempt in range(3):
            try:
                response = openai.ChatCompletion.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": full_prompt}],
                    temperature=0.7,
                    max_tokens=500, # Token optimization
                )
                result = response.choices[0].message["content"].strip()
                cache[cache_key] = result # Store result in cache
                return result
            except openai.error.RateLimitError as e:
                if attempt < 2:
                    time.sleep(2 ** (attempt + 1)) # Exponential backoff
                else:
                    raise e

    except Exception as e:
        # Log the error for monitoring
        print(f"Error in AI analysis: {e}")
        return {"error": str(e)}

# --- API Endpoints ---
@app.route("/api/v1/analyze", methods=["POST"])
def submit_analysis_job():
    """Receives a request and adds it to the job queue."""
    data = request.get_json()
    if not data or "prompt" not in data or "input" not in data:
        return jsonify({"error": "Invalid request payload"}), 400

    # Sanitize input (basic example)
    prompt = str(data["prompt"])
    input_data = str(data["input"])

    # Enqueue the job
    job = q.enqueue(perform_ai_analysis, prompt, input_data)

    return jsonify({"job_id": job.get_id()}), 202

@app.route("/api/v1/results/<job_id>", methods=["GET"])
def get_analysis_result(job_id):
    """Retrieves the result of a job by its ID."""
    try:
        job = Job.fetch(job_id, connection=redis_conn)
    except Exception:
        return jsonify({"error": "Invalid job ID"}), 404

    if job.is_finished:
        return jsonify({"status": "completed", "result": job.result}), 200
    elif job.is_failed:
        return jsonify({"status": "failed"}), 500
    else:
        return jsonify({"status": "in_progress"}), 202

if __name__ == "__main__":
    app.run(debug=True)

