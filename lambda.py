import json
import boto3
import pandas as pd
import io
import time
s3 = boto3.client('s3')
textract = boto3.client('textract')

def lambda_handler(event, context):
    bucket = event['bucket']
    document = event['key']
    file_type = event['file_type']

    if file_type == 'pdf':
        # Start Textract job for PDF
        response = textract.start_document_text_detection(
            DocumentLocation={'S3Object': {'Bucket': bucket, 'Name': document}}
        )
        job_id = response['JobId']

        status = 'IN_PROGRESS'
        while status == 'IN_PROGRESS':
            time.sleep(5)
            response = textract.get_document_text_detection(JobId=job_id)
            status = response['JobStatus']

        if status == 'SUCCEEDED':
            text = ''
            for result in response['Blocks']:
                if result['BlockType'] == 'LINE':
                    text += result['Text'] + '\n'
            return {'statusCode': 200, 'body': json.dumps({'text': text})}
        else:
            return {'statusCode': 500, 'body': json.dumps({'error': 'Textract job failed'})}

    elif file_type == 'csv':
        # Extract text from CSV using pandas
        csv_obj = s3.get_object(Bucket=bucket, Key=document)
        df = pd.read_csv(io.BytesIO(csv_obj['Body'].read()))
        text = df.to_string()
        return {'statusCode': 200, 'body': json.dumps({'text': text})}

    elif file_type == 'excel':
        # Extract text from Excel using pandas
        excel_obj = s3.get_object(Bucket=bucket, Key=document)
        df = pd.read_excel(io.BytesIO(excel_obj['Body'].read()))
        text = df.to_string()
        return {'statusCode': 200, 'body': json.dumps({'text': text})}

    return {'statusCode': 400, 'body': json.dumps({'error': 'Unsupported file type'})}
