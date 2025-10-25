# phishing_detection.py
import json
from .. import db
from .ml_model import predict
from .gemini_service import analyze_with_gemini


def analyze_email(email):
    """
    Analyze email with ML + Rules + AI → Final Verdict
    """
    results = {}
    is_phishing = False
    phishing_score = 0.0
    detection_method = 'none'

    # === 1. ML MODEL ===
    ml_score = 0.0
    try:
        ml_result = predict(email.body_text)
        results['ml_analysis'] = ml_result
        ml_score = ml_result['probability']  # 0.0 to 1.0
        if ml_result['is_phishing'] and ml_result['confidence'] in ['high', 'medium']:
            is_phishing = True
            phishing_score = ml_score * 100
            detection_method = 'ml'
    except Exception as e:
        results['ml_error'] = str(e)

    # === 2. RULE-BASED ===
    rule_score = 0
    rule_indicators = []

    # Suspicious sender + financial terms
    if email.sender and '@' in email.sender:
        sender_domain = email.sender.split('@')[-1].lower()
        common_domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com']
        if sender_domain in common_domains and any(term in (email.subject or '').lower() 
            for term in ['bank', 'account', 'verify', 'security', 'update']):
            rule_score += 20
            rule_indicators.append('Suspicious sender domain for financial content')

    # Auth failures
    if email.spf_pass is False or email.dkim_pass is False or email.dmarc_pass is False:
        rule_score += 30
        rule_indicators.append('Email authentication failure')

    # Suspicious subject
    suspicious_terms = ['urgent', 'verify', 'account', 'suspended', 'update', 'security', 'unusual activity', 'login']
    if email.subject and any(term in email.subject.lower() for term in suspicious_terms):
        rule_score += 15
        rule_indicators.append('Suspicious keywords in subject')

    # Suspicious links
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

    results['rule_analysis'] = {'score': rule_score, 'indicators': rule_indicators}

    # === 3. AI ANALYSIS (only if needed) ===
    ai_score = 0.0
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
            ai_score = ai_result.get('phishing_score', 0) / 100.0  # Normalize to 0–1

            # Only override if AI is *very confident*
            if ai_result.get('is_phishing') and ai_score > 0.7:
                is_phishing = True
                detection_method = 'ai'
            elif not ai_result.get('is_phishing') and ai_score < 0.3 and is_phishing:
                # Only downgrade if AI is *very confident safe*
                is_phishing = False
                detection_method = 'ai_override'
        except Exception as e:
            results['ai_error'] = str(e)

    # === 4. FINAL WEIGHTED ENSEMBLE ===
    final_score = (
        0.6 * ml_score +
        0.3 * ai_score +
        0.1 * (rule_score / 100.0)
    )

    # Final verdict
    is_phishing_final = final_score > 0.5
    phishing_score_final = round(final_score * 100, 1)

    # Update detection method
    if detection_method == 'none':
        detection_method = 'ensemble'

    # === 5. SAVE TO DB ===
    email.is_phishing = is_phishing_final
    email.phishing_score = phishing_score_final
    email.detection_method = detection_method
    email.analysis_result = json.dumps(results)
    db.session.commit()

    return {
        'is_phishing': is_phishing_final,
        'phishing_score': phishing_score_final,
        'detection_method': detection_method,
        'results': results
    }