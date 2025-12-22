from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.security import generate_password_hash
from models import db, User, Role

users_bp = Blueprint('users', __name__)

@users_bp.route('/', methods=['GET'])
@jwt_required()  # Only logged-in users can access this
def get_all_users():
    # 1. Fetch all users from the database
    users = User.query.all()
    
    # 2. Convert data to a list of dictionaries (JSON format)
    result = []
    for user in users:
        result.append({
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'role': user.role.name
        })
    
    return jsonify(result), 200

@users_bp.route('/', methods=['POST'])
@jwt_required()
def create_user():
    data = request.get_json()
    
    # 1. Validation
    if not data.get('username') or not data.get('password'):
        return jsonify({"msg": "Username and password are required"}), 400
    
    if not data.get('role'):
        return jsonify({"msg": "Role is required"}), 400

    # 2. Find the Role ID
    role = Role.query.filter_by(name=data['role']).first()
    if not role:
        return jsonify({"msg": "Invalid role selected"}), 400

    # 3. Create the User
    new_user = User(
        username=data['username'],
        password_hash=generate_password_hash(data['password']),
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''),
        email=data.get('email', ''),
        role=role
    )

    # 4. Save to DB
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"msg": "User created successfully"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error creating user", "error": str(e)}), 500