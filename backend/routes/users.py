from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.security import generate_password_hash
from models import db, User, Warehouse

users_bp = Blueprint('users', __name__)

@users_bp.route('/', methods=['GET'])
@jwt_required()
def get_all_users():
    all_users = []
    
    warehouses = Warehouse.query.all()
    
    class MainMock:
        name = "Headquarters"
        bind_key = None 
    
    targets = [MainMock()] + warehouses

    for target in targets:
        try:
            if target.bind_key is None:
                engine = db.engine
            else:
                engine = db.engines[target.bind_key]
            
            with db.Session(bind=engine) as temp_session:
                stmt = db.select(User)
                users_in_db = temp_session.execute(stmt).scalars().all()

                for u in users_in_db:
                    all_users.append({
                        'id': u.id,
                        'username': u.username,
                        'first_name': u.first_name,
                        'last_name': u.last_name,
                        'email': u.email,
                        'role': u.role_name,
                        'warehouse': target.name,
                        'bind_key': target.bind_key
                    })
        except Exception as e:
            print(f"Could not read from {target.name}: {e}")

    return jsonify(all_users), 200

@users_bp.route('/', methods=['POST'])
@jwt_required()
def create_user():
    data = request.get_json()
    target_bind = data.get('warehouse_bind_key') 
    
    if not data.get('username') or not data.get('password'):
        return jsonify({"msg": "Missing data"}), 400

    new_user = User(
        username=data['username'],
        password_hash=generate_password_hash(data['password']),
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''),
        email=data.get('email', ''),
        role_name=data.get('role', 'employee')
    )

    try:
        if target_bind is None:
             engine = db.engine
        else:
             engine = db.engines[target_bind]

        with db.Session(bind=engine) as temp_session:
            temp_session.add(new_user)
            temp_session.commit()
            
        return jsonify({"msg": "User created successfully"}), 201
    except Exception as e:
        return jsonify({"msg": "Error creating user", "error": str(e)}), 500
    
@users_bp.route('/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    target_bind = request.args.get('warehouse_bind_key')

    if target_bind == 'null':
        target_bind = None

    try:
        if target_bind is None:
             engine = db.engine
        else:
             engine = db.engines[target_bind]

        with db.Session(bind=engine) as temp_session:
            user_to_delete = temp_session.get(User, user_id)
            if user_to_delete:
                temp_session.delete(user_to_delete)
                temp_session.commit()
                return jsonify({"msg": "User deleted"}), 200
            else:
                return jsonify({"msg": "User not found"}), 404

    except Exception as e:
        return jsonify({"msg": "Error deleting user", "error": str(e)}), 500