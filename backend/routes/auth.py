from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User, Warehouse

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    warehouses = Warehouse.query.all()
    binds = [None] + [w.bind_key for w in warehouses]

    found_user_data = None

    for bind in binds:
        try:
            if bind is None:
                engine = db.engine
            else:
                engine = db.engines[bind]

            with db.Session(bind=engine) as temp_session:
                stmt = db.select(User).filter_by(username=username)
                user = temp_session.execute(stmt).scalar_one_or_none()
                
                if user and check_password_hash(user.password_hash, password):
                    
                    found_user_data = {
                        'username': user.username,
                        'role_name': user.role_name,
                        'first_name': user.first_name,
                        'last_name': user.last_name
                    }
                    break
                    
        except Exception as e:
            continue

    if found_user_data:
        token = create_access_token(
            identity=found_user_data['username'],
            additional_claims={'role': found_user_data['role_name']}
        )
        user_location = bind if bind else 'main'
        full_name = f"{found_user_data['first_name']} {found_user_data['last_name']}"
        return jsonify({
            "msg": "Login successful", 
            "access_token": token, 
            "role": found_user_data['role_name'],
            "location": user_location,
            "full_name": full_name
        }), 200

    return jsonify({"msg": "Invalid credentials"}), 401

@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def get_all_users():
    all_users = []
    
    try:
        main_users = User.query.all()
        for u in main_users:
            all_users.append({'id': u.id, 'name': f"{u.first_name} {u.last_name} (HQ)"})
        
        warehouses = Warehouse.query.all()
        for w in warehouses:
            try:
                engine = db.engines.get(w.bind_key)
                if engine:
                    with db.Session(bind=engine) as session:
                        shard_users = session.execute(db.select(User)).scalars().all()
                        for u in shard_users:
                            all_users.append({
                                'id': u.id, 
                                'name': f"{u.first_name} {u.last_name} ({w.name})"
                            })
            except Exception as e:
                print(f"Skipping {w.name}: {e}")
                continue

        return jsonify(all_users), 200

    except Exception as e:
        return jsonify({"msg": "Error fetching global users", "error": str(e)}), 500