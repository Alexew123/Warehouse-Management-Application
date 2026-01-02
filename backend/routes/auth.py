from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from flask_jwt_extended import create_access_token
from models import db, User, Warehouse

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    print(f"🔍 Attempting login for: {username}")

    warehouses = Warehouse.query.all()
    binds = [None] + [w.bind_key for w in warehouses]

    found_user_data = None  # We will store the user data here if found

    for bind in binds:
        try:
            # 1. Select the correct Engine
            if bind is None:
                engine = db.engine
            else:
                engine = db.engines[bind]

            # 2. Create a temporary session just for this database
            with db.Session(bind=engine) as temp_session:
                stmt = db.select(User).filter_by(username=username)
                user = temp_session.execute(stmt).scalar_one_or_none()
                
                if user and check_password_hash(user.password_hash, password):
                    print(f"   ✅ User found in {bind if bind else 'Main'}!")
                    
                    # 3. SAVE DATA NOW (Because 'user' dies when the session closes)
                    found_user_data = {
                        'username': user.username,
                        'role_name': user.role_name
                    }
                    break # Stop searching
                    
        except Exception as e:
            print(f"   ⚠️ Error checking {bind}: {e}")
            continue

    # 4. Use the saved data to create the token
    if found_user_data:
        token = create_access_token(
            identity=found_user_data['username'],
            additional_claims={'role': found_user_data['role_name']}
        )
        return jsonify({
            "msg": "Login successful", 
            "access_token": token, 
            "role": found_user_data['role_name']
        }), 200

    return jsonify({"msg": "Invalid credentials"}), 401