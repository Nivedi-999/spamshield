from flask import Blueprint, jsonify, request, Response
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from sqlalchemy import or_, func, case, and_
from .. import db
from ..models import Email, SenderTag
from ..services.email_service import fetch_emails
from ..services.phishing_detection import analyze_email
import json
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

email_bp = Blueprint('email', __name__, url_prefix='/emails')
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))


@email_bp.route('/')
@login_required
def get_emails():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search_term = request.args.get('searchTerm', '') or request.args.get('query', '')
    search_term = search_term.strip().lower() if search_term else ''

    is_phishing = request.args.get('is_phishing', None)
    if is_phishing is not None:
        is_phishing = is_phishing.lower() == 'true'

    sender_filter = request.args.get('from', None)
    subject_filter = request.args.get('subject', None)
    date_from = request.args.get('date_from', None)
    date_to = request.args.get('date_to', None)
    status = request.args.get('status', None)
    detection_method = request.args.get('detection_method', None)
    has_attachment = request.args.get('has_attachment', None)
    if has_attachment is not None:
        has_attachment = has_attachment.lower() == 'true'

    tag_filter = request.args.get('tag', None)

    query = Email.query.filter_by(user_id=current_user.id)

    if is_phishing is not None:
        query = query.filter_by(is_phishing=is_phishing)

    if sender_filter:
        query = query.filter(Email.sender.ilike(f"%{sender_filter}%"))
    if subject_filter:
        query = query.filter(Email.subject.ilike(f"%{subject_filter}%"))
    if date_from:
        query = query.filter(Email.received_date >= date_from)
    if date_to:
        query = query.filter(Email.received_date <= date_to)

    if status:
        status = status.lower()
        if status == 'phishing':
            query = query.filter_by(is_phishing=True)
        elif status == 'safe':
            query = query.filter_by(is_phishing=False)

    if detection_method:
        query = query.filter_by(detection_method=detection_method)
    if has_attachment is not None:
        query = query.filter_by(has_attachment=has_attachment)

    if tag_filter:
        query = query.join(
            SenderTag,
            and_(
                SenderTag.sender_email == Email.sender,
                SenderTag.user_id == current_user.id
            )
        ).filter(SenderTag.tag == tag_filter)

    keywords = search_term.split() if search_term else []
    if keywords:
        query = query.filter(
            or_(*[
                or_(
                    Email.subject.ilike(f"%{word}%"),
                    Email.sender.ilike(f"%{word}%"),
                    Email.body_text.ilike(f"%{word}%"),
                    Email.body_html.ilike(f"%{word}%")
                ) for word in keywords
            ])
        )

    query = query.order_by(Email.received_date.desc())
    emails_pagination = query.paginate(page=page, per_page=per_page)

    emails = []
    for email in emails_pagination.items:
        sender_tag = SenderTag.query.filter_by(
            user_id=current_user.id,
            sender_email=email.sender
        ).first()
        tag = sender_tag.tag if sender_tag else 'none'

        emails.append({
            'id': email.id,
            'message_id': email.message_id,
            'sender': email.sender,
            'subject': email.subject,
            'received_date': email.received_date.isoformat() if email.received_date else None,
            'is_phishing': email.is_phishing,
            'phishing_score': email.phishing_score,
            'has_attachment': email.has_attachment,
            'tag': tag
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
    
    # GET TAG FROM SenderTag
    sender_tag = SenderTag.query.filter_by(
        user_id=current_user.id,
        sender_email=email.sender
    ).first()
    tag = sender_tag.tag if sender_tag else 'none'

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
        'dmarc_pass': email.dmarc_pass,
        'tag': tag  # FIXED
    }
    
    return jsonify(email_data)


@email_bp.route('/<int:email_id>/tag', methods=['PATCH'])
@login_required
def update_sender_tag(email_id):
    data = request.get_json()
    tag = data.get('tag')

    valid_tags = ['important', 'urgent', 'casual', 'no-reply']
    if tag is not None and tag not in valid_tags:
        return jsonify({'error': 'Invalid tag'}), 400

    email = Email.query.filter_by(id=email_id, user_id=current_user.id).first_or_404()
    sender_email = email.sender

    sender_tag = SenderTag.query.filter_by(
        user_id=current_user.id,
        sender_email=sender_email
    ).first()

    if sender_tag:
        if tag is None:
            db.session.delete(sender_tag)
        else:
            sender_tag.tag = tag
    else:
        if tag:
            new_tag = SenderTag(user_id=current_user.id, sender_email=sender_email, tag=tag)
            db.session.add(new_tag)

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Sender {sender_email} tagged as {tag or "none"}',
        'tag': tag
    })


@email_bp.route('/trends')
@login_required
def get_phishing_trends():
    return jsonify({
        "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "datasets": [
            {
                "label": "Phishing %",
                "data": [12, 19, 3, 5, 8, 15, 10],
                "borderColor": "#f44336",
                "backgroundColor": "rgba(244, 67, 54, 0.1)",
                "fill": True
            },
            {
                "label": "Safe %",
                "data": [88, 81, 97, 95, 92, 85, 90],
                "borderColor": "#4caf50",
                "backgroundColor": "rgba(76, 175, 80, 0.1)",
                "fill": True
            }
        ]
    })

@email_bp.route('/<int:email_id>/update-status', methods=['POST'])
@login_required
def update_email_status(email_id):
    """Update the phishing status of an email"""
    email = Email.query.get_or_404(email_id)
    if email.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    new_status = data.get('is_phishing')
    if new_status is None or not isinstance(new_status, bool):
        return jsonify({'error': 'is_phishing must be a boolean'}), 400

    email.is_phishing = new_status
    db.session.commit()
    return jsonify({
        'message': f'Status updated to {"Phishing" if new_status else "Safe"}',
        'id': email_id,
        'is_phishing': new_status
    })
@email_bp.route('/sync')
@login_required
def sync_emails():
    """Fetch new emails from Gmail with better error handling"""
    try:
        # Debug: Log user
        print(f"[SYNC] Starting sync for user: {current_user.id} ({current_user.email})")

        # Check if user has Gmail token
        if not current_user.access_token:
            print("[SYNC] No Gmail token found")
            return jsonify({'message': 'No Gmail account connected', 'count': 0}), 200

        # Call fetch_emails
        new_emails = fetch_emails(current_user)
        count = len(new_emails) if new_emails else 0

        print(f"[SYNC] Successfully synced {count} emails")
        return jsonify({
            'message': f'Successfully synced {count} new emails',
            'count': count
        }), 200

    except Exception as e:
        error_msg = str(e)
        print(f"[SYNC ERROR] {error_msg}")

        # Classify common errors
        if "invalid_grant" in error_msg or "Token has been expired" in error_msg:
            return jsonify({'error': 'Gmail token expired. Please reconnect your account.'}), 401
        elif "Rate limit" in error_msg:
            return jsonify({'error': 'Gmail rate limit exceeded. Try again later.'}), 429
        elif "service" in error_msg.lower():
            return jsonify({'error': 'Gmail service unavailable. Try again later.'}), 503
        else:
            return jsonify({'error': 'Sync failed. Check server logs.'}), 500

@email_bp.route('/<int:email_id>/analyze')
@login_required
def analyze_single_email(email_id):
    email = Email.query.filter_by(id=email_id, user_id=current_user.id).first_or_404()
    try:
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