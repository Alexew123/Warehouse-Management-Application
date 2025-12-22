from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from flask_jwt_extended import create_access_token

# Import the User model
from models import User

# Create the Blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    # 1. Get the data from the frontend
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # 2. Find the user in the database
    user = User.query.filter_by(username=username).first()

    # 3. Check if user exists AND the password hash matches
    if user and check_password_hash(user.password_hash, password):
        
        role_name = user.role.name
        
        # 4. Create the JWT Token
        # FIX: Identity uses the username (String), Role goes in additional_claims
        access_token = create_access_token(
            identity=user.username, 
            additional_claims={'role': role_name}
        )
        
        # 5. Send Success Response
        return jsonify({
            "msg": "Login successful",
            "access_token": access_token,
            "role": role_name
        }), 200
    
    # 6. Send Failure Response
    return jsonify({"msg": "Invalid username or password"}), 401