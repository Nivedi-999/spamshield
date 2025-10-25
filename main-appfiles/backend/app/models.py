# models.py
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
    
    emails = db.relationship('Email', backref='user', lazy=True)
    sender_tags = db.relationship('SenderTag', backref='user', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.email}>'

class SenderTag(db.Model):
    __tablename__ = 'sender_tags'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    sender_email = db.Column(db.String(255), nullable=False)
    tag = db.Column(db.String(50), nullable=False)  # 'important', 'urgent', etc.
    
    # Unique constraint: one tag per sender per user
    __table_args__ = (db.UniqueConstraint('user_id', 'sender_email', name='unique_sender_tag'),)
    def __repr__(self):
        return f'<SenderTag {self.sender_email} → {self.tag}>'

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
    phishing_score = db.Column(db.Float, default=0.0)
    detection_method = db.Column(db.String(50), default='none')
    analysis_result = db.Column(db.Text, nullable=True)
    
    # Email metadata
    has_attachment = db.Column(db.Boolean, default=False)
    attachment_info = db.Column(db.Text, nullable=True)
    links = db.Column(db.Text, nullable=True)
    spf_pass = db.Column(db.Boolean, nullable=True)
    dkim_pass = db.Column(db.Boolean, nullable=True)
    dmarc_pass = db.Column(db.Boolean, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<Email {self.subject}>'
    
    def get_links(self):
        return json.loads(self.links) if self.links else []
    
    def get_attachment_info(self):
        return json.loads(self.attachment_info) if self.attachment_info else []
    
    def get_analysis_result(self):
        return json.loads(self.analysis_result) if self.analysis_result else {}

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
            'created_at': self.created_at.isoformat() if self.created_at else None
        }