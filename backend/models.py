from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Role(db.Model):
    __tablename__ = 'roles'

    id = db.Column(db.Integer, primary_key=True)
    # SQL: role varchar(50) unique not null
    name = db.Column(db.String(50), unique=True, nullable=False)

    users = db.relationship('User', backref='role', lazy=True)

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    # SQL: username varchar(50) unique not null
    username = db.Column(db.String(50), unique=True, nullable=False)
    # SQL: password_hash varchar(255) not null
    password_hash = db.Column(db.String(255), nullable=False)
    
    # SQL: first_name / last_name varchar(100) not null
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    
    # SQL: email varchar(255) unique not null
    email = db.Column(db.String(255), unique=True, nullable=False)

    # Foreign Key
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'