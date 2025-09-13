import json
from .. import db
from .ml_model import predict
from .gemini_service import analyze_with_gemini

def analyze_email(email):
    """
    Analyze an email for phishing using multiple detection methods
    Adds risk_level classification (Safe, Suspicious, High Risk).
    """
    results = {}
    is_phishing = False
    phishing_score = 0
    detection_method = 'none'
    risk_level = "Safe"  # Default

    # 1. ML model analysis
    try:
        ml_result = predict(email.body_text)
        results['ml_analysis'] = ml_result

        if ml_result['is_phishing'] and ml_result['confidence'] in ['high', 'medium']:
            is_phishing = True
            phishing_score = ml_result['probability'] * 100
            detection_method = 'ml'
    except Exception as e:
        results['ml_error'] = str(e)

    # 2. Rule-based checks
    rule_score = 0
    rule_indicators = []

    if email.sender and '@' in email.sender:
        sender_domain = email.sender.split('@')[-1].lower()
        common_domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com']

        if sender_domain in common_domains and any(term in email.subject.lower() for term in ['bank', 'account', 'verify', 'security', 'update']):
            rule_score += 20
            rule_indicators.append('Suspicious sender domain for financial content')

    if email.spf_pass is False or email.dkim_pass is False or email.dmarc_pass is False:
        rule_score += 30
        rule_indicators.append('Email authentication failure')

    suspicious_terms = ['urgent', 'verify', 'account', 'suspended', 'update', 'security', 'unusual activity', 'login']
    if email.subject:
        if any(term in email.subject.lower() for term in suspicious_terms):
            rule_score += 15
            rule_indicators.append('Suspicious keywords in subject')

    links = email.get_links()
    suspicious_link_count = 0
    for link in links:
        url = link.get('url', '')
        text = link.get('text', '')
        domain = link.get('domain', '')

        if text and 'http' in text and url not in text:
            suspicious_link_count += 1

        if domain and all(c.isdigit() or c == '.' for c in domain):
            suspicious_link_count += 1

    if suspicious_link_count > 0:
        rule_score += min(suspicious_link_count * 10, 30)
        rule_indicators.append(f'Found {suspicious_link_count} suspicious links')

    results['rule_analysis'] = {
        'score': rule_score,
        'indicators': rule_indicators
    }

    if rule_score >= 50 and not is_phishing:
        is_phishing = True
        phishing_score = rule_score
        detection_method = 'rules'

    # 3. AI analysis (optional, for borderline cases)
    if (not is_phishing and rule_score >= 30) or (is_phishing and phishing_score < 70):
        try:
            metadata = {
                'sender': email.sender,
                'subject': email.subject,
                'spf_pass': 'Yes' if email.spf_pass else 'No' if email.spf_pass is False else 'Unknown',
                'dkim_pass': 'Yes' if email.dkim_pass else 'No' if email.dkim_pass is False else 'Unknown',
                'dmarc_pass': 'Yes' if email.dmarc_pass else 'No' if email.dmarc_pass is False else 'Unknown',
                'has_attachment': 'Yes' if email.has_attachment else 'No'
            }

            ai_result = analyze_with_gemini(email.body_text, metadata)
            results['ai_analysis'] = ai_result

            if ai_result.get('is_phishing') and ai_result.get('phishing_score', 0) > 70:
                is_phishing = True
                phishing_score = ai_result.get('phishing_score', 70)
                detection_method = 'ai'
            elif is_phishing and not ai_result.get('is_phishing') and ai_result.get('phishing_score', 100) < 30:
                phishing_score = max(phishing_score * 0.7, 50)
        except Exception as e:
            results['ai_error'] = str(e)

    # --- NEW: Risk Level classification ---
    if phishing_score > 80:
        risk_level = "High Risk"
    elif phishing_score > 50:
        risk_level = "Suspicious"
    else:
        risk_level = "Safe"

    # Update email with analysis results
    email.is_phishing = is_phishing
    email.phishing_score = phishing_score
    email.detection_method = detection_method
    email.analysis_result = json.dumps(results)
    email.risk_level = risk_level  # store risk level

    db.session.commit()

    return {
        'is_phishing': is_phishing,
        'phishing_score': phishing_score,
        'detection_method': detection_method,
        'risk_level': risk_level,
        'results': results
    }
