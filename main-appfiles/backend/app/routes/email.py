from flask import Blueprint, jsonify, request, Response
from flask_login import login_required, current_user
from .. import db
from ..models import Email
from ..services.email_service import fetch_emails, get_email_details
from ..services.phishing_detection import analyze_email
import json
import google.generativeai as genai
import os
from dotenv import load_dotenv
from sqlalchemy import func
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

email_bp = Blueprint('email', __name__, url_prefix='/emails')

# Initialize Gemini API
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

@email_bp.route('/')
@login_required
def get_emails():
    """Get all emails for the current user with pagination"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    # Filter options
    is_phishing = request.args.get('is_phishing', None)
    if is_phishing is not None:
        is_phishing = is_phishing.lower() == 'true'
    
    # Build query
    query = Email.query.filter_by(user_id=current_user.id)
    
    # Apply filters
    if is_phishing is not None:
        query = query.filter_by(is_phishing=is_phishing)
    
    # Order by received date (newest first)
    query = query.order_by(Email.received_date.desc())
    
    # Paginate
    emails_pagination = query.paginate(page=page, per_page=per_page)
    
    # Format response
    emails = []
    for email in emails_pagination.items:
        emails.append({
            'id': email.id,
            'message_id': email.message_id,
            'sender': email.sender,
            'subject': email.subject,
            'received_date': email.received_date.isoformat() if email.received_date else None,
            'is_phishing': email.is_phishing,
            'phishing_score': email.phishing_score,
            'has_attachment': email.has_attachment
        })
    
    return jsonify({
        'emails': emails,
        'total': emails_pagination.total,
        'pages': emails_pagination.pages,
        'current_page': page
    })

@email_bp.route('/<int:email_id>')
@login_required
def get_email(email_id):
    """Get details for a specific email"""
    email = Email.query.filter_by(id=email_id, user_id=current_user.id).first_or_404()
    
    # Format response with all details
    email_data = {
        'id': email.id,
        'message_id': email.message_id,
        'sender': email.sender,
        'recipient': email.recipient,
        'subject': email.subject,
        'body_text': email.body_text,
        'body_html': email.body_html,
        'received_date': email.received_date.isoformat() if email.received_date else None,
        'is_phishing': email.is_phishing,
        'phishing_score': email.phishing_score,
        'detection_method': email.detection_method,
        'analysis_result': email.get_analysis_result(),
        'has_attachment': email.has_attachment,
        'attachment_info': email.get_attachment_info(),
        'links': email.get_links(),
        'spf_pass': email.spf_pass,
        'dkim_pass': email.dkim_pass,
        'dmarc_pass': email.dmarc_pass
    }
    
    return jsonify(email_data)

@email_bp.route('/sync')
@login_required
def sync_emails():
    """Fetch new emails from Gmail"""
    try:
        # Fetch emails from Gmail
        new_emails = fetch_emails(current_user)
        
        return jsonify({
            'message': f'Successfully synced {len(new_emails)} new emails',
            'count': len(new_emails)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@email_bp.route('/<int:email_id>/analyze')
@login_required
def analyze_single_email(email_id):
    """Analyze a specific email for phishing"""
    email = Email.query.filter_by(id=email_id, user_id=current_user.id).first_or_404()
    
    try:
        # Analyze the email
        result = analyze_email(email)
        
        return jsonify({
            'message': 'Email analyzed successfully',
            'is_phishing': email.is_phishing,
            'phishing_score': email.phishing_score,
            'detection_method': email.detection_method,
            'analysis_result': email.get_analysis_result()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@email_bp.route('/<int:email_id>/analyze_with_ai', methods=['POST'])
@login_required
def analyze_email_with_ai(email_id):
    """Stream AI analysis of an email"""
    email = Email.query.get_or_404(email_id)
    
    if email.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    def generate():
        try:
            # Get email content (prefer text, fallback to html)
            content = email.body_text if email.body_text else email.body_html
            
            # Prepare email content for analysis
            email_content = f"""
            Subject: {email.subject}
            From: {email.sender}
            To: {email.recipient}
            Date: {email.received_date}
            
            Content:
            {content}
            """
            
            # Check if GEMINI_API_KEY is set
            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                yield f"data: {json.dumps({'error': 'GEMINI_API_KEY is not set in environment variables'})}\n\n"
                return
            
            # List of models to try in order of preference
            models_to_try = [
                'gemini-2.0-flash',
                'gemini-1.5-flash',
                'gemini-1.0-pro',
                'gemini-pro',
                'gemini-1.5-pro-latest'
            ]
            
            model = None
            model_name = None
            
            # Try each model until one works
            for model_name in models_to_try:
                try:
                    yield f"data: {json.dumps({'text': f'Trying model: {model_name}...'})}\n\n"
                    
                    # Try with full configuration first
                    try:
                        model = genai.GenerativeModel(
                            model_name,
                            generation_config=genai.GenerationConfig(
                                temperature=0.2,
                                top_p=0.95,
                                top_k=40,
                                max_output_tokens=4096,
                            ),
                            safety_settings=[
                                {
                                    "category": "HARM_CATEGORY_HARASSMENT",
                                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                                },
                                {
                                    "category": "HARM_CATEGORY_HATE_SPEECH",
                                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                                },
                                {
                                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                                },
                                {
                                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                                    "threshold": "BLOCK_MEDIUM_AND_ABOVE"
                                }
                            ]
                        )
                    except TypeError as type_error:
                        # If advanced configuration is not supported, try with basic configuration
                        if "unexpected keyword argument" in str(type_error):
                            yield f"data: {json.dumps({'text': f'Model {model_name} does not support advanced configuration, using basic initialization...'})}\n\n"
                            model = genai.GenerativeModel(model_name)
                        else:
                            # Re-raise if it's a different TypeError
                            raise
                    
                    # Test the model with a simple prompt
                    test_response = model.generate_content("Hello")
                    # If we get here, the model works
                    yield f"data: {json.dumps({'text': f'Successfully connected to model: {model_name}'})}\n\n"
                    break
                except Exception as e:
                    yield f"data: {json.dumps({'text': f'Model {model_name} failed: {str(e)}'})}\n\n"
                    continue
            
            if model is None:
                yield f"data: {json.dumps({'error': 'All models failed. Please check your Gemini API key and permissions.'})}\n\n"
                return
            
            # Create a chat session
            chat = model.start_chat(history=[])
            
            # Send the email for analysis
            prompt = f"""Analyze this email for potential phishing indicators. 

            Please structure your response using the following markdown format:
            
            # Email Phishing Analysis
            
            ## Overall Risk Assessment
            [Provide a clear risk level: Low, Medium, or High, with brief explanation and confidence level]
            
            ## Key Suspicious Elements
            [List all suspicious elements as bullet points with detailed explanations. Be thorough in your analysis.]
            
            ## Safe Indicators
            [List any safe indicators as bullet points with explanations]
            
            ## Technical Analysis
            [Provide in-depth technical details about:
            - Links and URLs (analyze domain reputation, URL structure, etc.)
            - Email headers and authentication (SPF, DKIM, DMARC)
            - Sender analysis (domain age, reputation, etc.)
            - Content analysis (urgency, threats, offers, etc.)
            - Any other technical indicators]
            
            ## Recommendations
            [Provide specific recommendations for the user based on your analysis]
            
            ## Final Verdict
            [Provide a final conclusion about whether this is phishing or not, with confidence level]
            
            Use **bold** for important points, organize with clear headings, and use bullet points for lists.
            Be thorough and detailed in your analysis, as this will be used to protect users from phishing attacks.
            
            Email to analyze:
            {email_content}"""
            
            yield f"data: {json.dumps({'text': 'Starting analysis...'})}\n\n"
            
            try:
                # Try with generation_config first
                try:
                    response = chat.send_message(
                        prompt,
                        generation_config=genai.GenerationConfig(
                            temperature=0.2,
                            top_p=0.95,
                            top_k=40,
                            max_output_tokens=4096,
                        ),
                        stream=True
                    )
                except TypeError as type_error:
                    # If generation_config is not supported, try without it
                    if "unexpected keyword argument" in str(type_error):
                        yield f"data: {json.dumps({'text': 'Model does not support advanced configuration, using default settings...'})}\n\n"
                        response = chat.send_message(prompt, stream=True)
                    else:
                        # Re-raise if it's a different TypeError
                        raise
                
                # Stream the response
                for chunk in response:
                    if chunk.text:
                        yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                        
            except Exception as e:
                # If streaming fails, try non-streaming
                yield f"data: {json.dumps({'text': 'Streaming failed, trying non-streaming mode...'})}\n\n"
                try:
                    # Try with generation_config first
                    try:
                        response = model.generate_content(
                            prompt,
                            generation_config=genai.GenerationConfig(
                                temperature=0.2,
                                top_p=0.95,
                                top_k=40,
                                max_output_tokens=4096,
                            )
                        )
                    except TypeError as type_error:
                        # If generation_config is not supported, try without it
                        if "unexpected keyword argument" in str(type_error):
                            yield f"data: {json.dumps({'text': 'Model does not support advanced configuration for non-streaming, using default settings...'})}\n\n"
                            response = model.generate_content(prompt)
                        else:
                            # Re-raise if it's a different TypeError
                            raise
                    
                    yield f"data: {json.dumps({'text': response.text})}\n\n"
                except Exception as non_stream_error:
                    yield f"data: {json.dumps({'error': f'Both streaming and non-streaming attempts failed: {str(non_stream_error)}'})}\n\n"
                    
        except Exception as e:
            error_message = str(e)
            # Add helpful context to the error message
            if "not found for API version" in error_message:
                error_message += " Please check your Gemini API key and ensure it has access to the required models."
            elif "quota" in error_message.lower():
                error_message += " You may have exceeded your API quota. Please check your Google AI Studio dashboard."
            
            yield f"data: {json.dumps({'error': error_message})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return Response(generate(), mimetype='text/event-stream') 
# --- DELETE EMAIL ENDPOINTS ---

@email_bp.route('/<int:email_id>', methods=['DELETE'])
@login_required
def delete_email(email_id):
    """
    Delete a single email that belongs to the current user.
    Returns 200 with a JSON message on success.
    """
    try:
        email = Email.query.filter_by(id=email_id, user_id=current_user.id).first()
        if not email:
            return jsonify({'error': 'Email not found'}), 404

        db.session.delete(email)
        db.session.commit()
        return jsonify({'message': 'Email deleted successfully', 'id': email_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete email: {str(e)}'}), 500


# Optional: POST fallback if your frontend currently calls POST instead of DELETE
@email_bp.route('/<int:email_id>/delete', methods=['POST'])
@login_required
def delete_email_post(email_id):
    return delete_email(email_id)
@email_bp.route('/stats')
@login_required
def email_stats():
    """
    Returns daily phishing vs safe email counts for the last 7 days
    """
    today = datetime.utcnow().date()
    last_week = today - timedelta(days=6)

    # Query emails grouped by date and phishing status
    results = (
        db.session.query(
            func.date(Email.received_date).label("date"),
            Email.is_phishing,
            func.count(Email.id).label("count")
        )
        .filter(Email.user_id == current_user.id)
        .filter(Email.received_date >= last_week)
        .group_by(func.date(Email.received_date), Email.is_phishing)
        .all()
    )

    # Format results
    stats = {}
    for row in results:
        date_str = row.date.isoformat()
        if date_str not in stats:
            stats[date_str] = {"phishing": 0, "safe": 0}
        if row.is_phishing:
            stats[date_str]["phishing"] = row.count
        else:
            stats[date_str]["safe"] = row.count

    # Ensure all days are present
    data = []
    for i in range(7):
        day = (last_week + timedelta(days=i)).isoformat()
        data.append({
            "date": day,
            "phishing": stats.get(day, {}).get("phishing", 0),
            "safe": stats.get(day, {}).get("safe", 0),
        })

    return jsonify(data)