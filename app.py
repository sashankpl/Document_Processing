import os
from flask import Flask, request, render_template, jsonify, url_for
from dotenv import load_dotenv
import boto3
import json
import fitz
import logging
from google.generativeai import GenerativeModel

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Environment Variables
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
AWS_REGION = os.getenv("AWS_REGION")
BUCKET_NAME = os.getenv("BUCKET_NAME")

# Set the API key for Google Generative AI
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

# Initialize AWS clients
lambda_client = boto3.client('lambda', region_name=AWS_REGION)
s3 = boto3.client('s3')

# Create local directory if it doesn't exist
local_directory = 'static/files'
os.makedirs(local_directory, exist_ok=True)

# Initialize Gemini Model
model = GenerativeModel("gemini-1.5-flash")

def split_text(text, max_length=500):
    return [text[i:i + max_length] for i in range(0, len(text), max_length)]

@app.route('/')
def index():
    return render_template('login.html')

@app.route('/home', methods=['GET'])
def home():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return 'No file part', 400

    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400

    s3_key = file.filename
    local_file_path = os.path.join(local_directory, s3_key)
    file.save(local_file_path)

    try:
        with open(local_file_path, 'rb') as f:
            s3.upload_fileobj(f, BUCKET_NAME, s3_key)
    except Exception as e:
        return f'Error uploading file to S3: {str(e)}', 500

    file_url = url_for('static', filename=f'files/{s3_key}')

    try:
        if file.filename.endswith('.pdf'):
            file_type = 'pdf'
        elif file.filename.endswith('.csv'):
            file_type = 'csv'
        elif file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            file_type = 'excel'
        else:
            return 'Unsupported file type', 400

        response = lambda_client.invoke(
            FunctionName='DocumentTextExtractor',
            InvocationType='RequestResponse',
            Payload=json.dumps({'bucket': BUCKET_NAME, 'key': s3_key, 'file_type': file_type})
        )

        payload = json.loads(response['Payload'].read())

        if response['StatusCode'] == 200:
            extracted_text = json.loads(payload.get('body', '{}')).get('text', '')
            if not extracted_text:
                return "No extracted text returned from Lambda.", 500
        else:
            return "Lambda function failed.", 500

    except Exception as e:
        return f'Error invoking Lambda function: {str(e)}', 500

    return render_template('result.html', text=extracted_text, bucket=BUCKET_NAME, key=s3_key, file_url=file_url)

@app.route('/ask', methods=['POST'])
def ask_question():
    question = request.json.get('question')
    text = request.json.get('text')

    chunks = split_text(text)
    full_text = " ".join(chunks)
    input_text = f"Answer the question: {question} \nContext: {full_text}"

    try:
        response = model.generate_content(input_text)
        answer = response.text.strip()

        if not answer:
            return jsonify({'error': 'No answer generated'}), 400

        answer = answer.replace("**", "<strong>")
        answer = answer.replace("*", "<strong>")

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify({'answer': answer})

@app.route('/submit_comment', methods=['POST'])
def submit_comment():
    comment = request.json.get('comment')
    if not comment:
        return jsonify({'error': 'Comment cannot be empty'}), 400

    try:
        with open('comments.txt', 'a') as f:
            f.write(comment + "\n")

        sentiment = analyze_comment_sentiment(comment)

        return jsonify({'message': 'Comment submitted successfully', 'sentiment': sentiment}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def analyze_comment_sentiment(comment):
    try:
        input_text = f"Analyze the sentiment of this comment and respond with only 'Good' or 'Bad' or 'Neutral': {comment}"
        response = model.generate_content(input_text)
        return response.text.strip()
    except Exception:
        return "Error analyzing sentiment"

@app.route('/comment', methods=['POST'])
def add_comment():
    comment_text = request.json.get('comment')
    if not comment_text:
        return jsonify({'error': 'No comment provided'}), 400

    input_text = f"Categorize this comment as good or bad: {comment_text}"

    try:
        response = model.generate_content(input_text)
        comment_category = response.text.strip()

        with open('comments.txt', 'a') as f:
            f.write(f"Comment: {comment_text}\nCategory: {comment_category}\n\n")

        return jsonify({'message': 'Comment added successfully', 'category': comment_category}), 200

    except Exception as e:
        return jsonify({'error': f"Error analyzing comment: {str(e)}"}), 500

@app.route('/comments')
def comments():
    comments_list = []

    try:
        with open('comments.txt', 'r') as f:
            comments_data = f.readlines()

        for comment in comments_data:
            sentiment = analyze_comment_sentiment(comment.strip())
            comments_list.append({'text': comment.strip(), 'sentiment': sentiment})

    except Exception as e:
        return f"Error reading comments: {str(e)}", 500

    return render_template('comments.html', comments=comments_list)

@app.route('/dashboard')
def dashboard():
    documents = []

    try:
        response = s3.list_objects_v2(Bucket=BUCKET_NAME)

        for obj in response.get('Contents', []):
            key = obj['Key']
            presigned_url = s3.generate_presigned_url('get_object',
                                                      Params={'Bucket': BUCKET_NAME, 'Key': key},
                                                      ExpiresIn=3600)
            page_count = 0
            if key.endswith('.pdf'):
                file_obj = s3.get_object(Bucket=BUCKET_NAME, Key=key)
                pdf_file = file_obj['Body'].read()
                doc = fitz.open(stream=pdf_file, filetype="pdf")
                page_count = doc.page_count

            documents.append({
                'key': key,
                'url': presigned_url,
                'page_count': page_count
            })
    except Exception as e:
        return f"Error fetching documents from S3: {str(e)}", 500

    return render_template('dashboard.html', documents=documents)

@app.route('/delete_file', methods=['POST'])
def delete_file():
    bucket_name = request.json.get('bucket')
    file_key = request.json.get('key')

    if not bucket_name or not file_key:
        return jsonify({'error': 'Bucket name and file key are required.'}), 400

    local_file_path = os.path.join(local_directory, file_key)

    try:
        s3.delete_object(Bucket=bucket_name, Key=file_key)

        if os.path.exists(local_file_path):
            os.remove(local_file_path)
            print(f"Local file {local_file_path} deleted.")
        else:
            print(f"Local file {local_file_path} not found.")

        return jsonify({'message': 'File successfully deleted from both S3 and local storage.'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)
