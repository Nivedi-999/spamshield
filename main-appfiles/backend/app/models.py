from . import db
from flask_login import UserMixin
from datetime import datetime
import json

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=True)
    profile_pic = db.Column(db.String(200), nullable=True)
    access_token = db.Column(db.Text, nullable=True)
    refresh_token = db.Column(db.Text, nullable=True)
    token_expiry = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship with emails
    emails = db.relationship('Email', backref='user', lazy=True)
    
    def __repr__(self):
        return f'<User {self.email}>'

class Email(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message_id = db.Column(db.String(200), nullable=False)
    sender = db.Column(db.String(120), nullable=False)
    recipient = db.Column(db.String(120), nullable=False)
    subject = db.Column(db.String(500), nullable=True)
    body_text = db.Column(db.Text, nullable=True)
    body_html = db.Column(db.Text, nullable=True)
    received_date = db.Column(db.DateTime, nullable=True)

    
    # Phishing detection results
    is_phishing = db.Column(db.Boolean, default=False)
    phishing_score = db.Column(db.Float, default=0.0)  # 0-100%
    detection_method = db.Column(db.String(50), default='none')  # 'ml', 'ai', 'rules', 'none'
    analysis_result = db.Column(db.Text, nullable=True)  # JSON string with detailed analysis
    
    # Email metadata
    has_attachment = db.Column(db.Boolean, default=False)
    attachment_info = db.Column(db.Text, nullable=True)  # JSON string with attachment details
    links = db.Column(db.Text, nullable=True)  # JSON string with links found in email
    spf_pass = db.Column(db.Boolean, nullable=True)
    dkim_pass = db.Column(db.Boolean, nullable=True)
    dmarc_pass = db.Column(db.Boolean, nullable=True)
    tag = db.Column(db.String(50), default='none')  # 'none', 'important', 'urgent', 'casual', 'no-reply'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Email {self.subject}>'
    
    def get_links(self):
        if self.links:
            return json.loads(self.links)
        return []
    
    def get_attachment_info(self):
        if self.attachment_info:
            return json.loads(self.attachment_info)
        return []
    
    def get_analysis_result(self):
        if self.analysis_result:
            return json.loads(self.analysis_result)
        return {} 

def to_dict(self):
        return {
            'id': self.id,
            'message_id': self.message_id,
            'sender': self.sender,
            'recipient': self.recipient,
            'subject': self.subject,
            'body_text': self.body_text,
            'body_html': self.body_html,
            'received_date': self.received_date.isoformat() if self.received_date else None,
            'is_phishing': self.is_phishing,
            'phishing_score': self.phishing_score,
            'detection_method': self.detection_method,
            'analysis_result': self.get_analysis_result(),
            'has_attachment': self.has_attachment,
            'attachment_info': self.get_attachment_info(),
            'links': self.get_links(),
            'spf_pass': self.spf_pass,
            'dkim_pass': self.dkim_pass,
            'dmarc_pass': self.dmarc_pass,
            'tag': self.tag,  # Include the new tag field
            'created_at': self.created_at.isoformat() if self.created_at else None
        }