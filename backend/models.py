from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Warehouse(db.Model):
    __tablename__ = 'warehouses'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    bind_key = db.Column(db.String(50), unique=True, nullable=False)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    role_name = db.Column(db.String(50), nullable=False, default='employee')

    def __repr__(self):
        return f'<User {self.username}>'
    
class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False) # e.g. "Dell XPS 15"
    category = db.Column(db.String(50), nullable=False)           # e.g. "Laptops"
    price = db.Column(db.Float, default=0.0)
    description = db.Column(db.String(200))

class Stock(db.Model):
    __tablename__ = 'stock'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, nullable=False) 
    quantity = db.Column(db.Integer, default=0)
    __table_args__ = (db.UniqueConstraint('product_id', name='_product_uc'),)

class Transfer(db.Model):
    __tablename__ = 'transfers'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    source_warehouse = db.Column(db.String(50), nullable=False)
    dest_warehouse = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='PENDING')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    note = db.Column(db.String(255))
    sender_id = db.Column(db.Integer, nullable=True)
    receiver_id = db.Column(db.Integer, nullable=True)