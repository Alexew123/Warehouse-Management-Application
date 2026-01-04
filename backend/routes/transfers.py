from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Transfer, Product, User, Stock, Warehouse
from sqlalchemy import or_, select, and_

transfers_bp = Blueprint('transfers', __name__)

def get_engine(location):
    if not location or location == 'main' or location == 'null':
        return db.engine
    return db.engines.get(location)

@transfers_bp.route('/', methods=['GET'])
@jwt_required()
def get_transfers():
    user_location = request.args.get('location')
    
    try:
        products = Product.query.all()
        prod_map = {p.id: p.name for p in products}

        query = Transfer.query
        if user_location and user_location != 'main' and user_location != 'null':
            query = query.filter(
                (Transfer.source_warehouse == user_location) | 
                (Transfer.dest_warehouse == user_location)
            )
            
        transfers = query.order_by(Transfer.created_at.desc()).all()
        
        result = []
        for t in transfers:
            result.append({
                'id': t.id,
                'product_name': prod_map.get(t.product_id, 'Unknown'),
                'quantity': t.quantity,
                'source': t.source_warehouse,
                'destination': t.dest_warehouse,
                'status': t.status,
                'sender_id': t.sender_id,
                'receiver_id': t.receiver_id,
                'created_at': t.created_at.strftime("%Y-%m-%d %H:%M")
            })
            
        return jsonify(result), 200

    except Exception as e:
        return jsonify({"msg": "Error fetching transfers", "error": str(e)}), 500

@transfers_bp.route('/tasks', methods=['GET'])
@jwt_required()
def get_my_tasks():
    current_username = get_jwt_identity()
    
    user_id = None
    user_location = None
    targets = [None] + [w.bind_key for w in Warehouse.query.all()]
    
    for bind in targets:
        try:
            engine = get_engine(bind)
            if engine:
                with db.Session(bind=engine) as session:
                    found = session.execute(select(User).filter_by(username=current_username)).scalar_one_or_none()
                    if found:
                        user_id = found.id
                        user_location = bind if bind else 'main'
                        break
        except Exception:
            continue

    if user_id is None:
        return jsonify({"msg": "User not found"}), 400

    tasks = Transfer.query.filter(
        or_(
            and_(
                Transfer.sender_id == user_id, 
                Transfer.source_warehouse == user_location,
                Transfer.status.in_(['APPROVED', 'IN_TRANSIT'])
            ),
            and_(
                Transfer.receiver_id == user_id, 
                Transfer.dest_warehouse == user_location,
                Transfer.status.in_(['IN_TRANSIT', 'COMPLETED'])
            )
        )
    ).order_by(Transfer.created_at.desc()).all()

    products = Product.query.all()
    prod_map = {p.id: p.name for p in products}

    result = []
    for t in tasks:
        if t.sender_id == user_id and t.source_warehouse == user_location:
            role = 'sender'
        elif t.receiver_id == user_id and t.dest_warehouse == user_location:
            role = 'receiver'
        else:
            role = 'viewer'

        result.append({
            'id': t.id,
            'product_name': prod_map.get(t.product_id, 'Unknown'),
            'quantity': t.quantity,
            'source': t.source_warehouse,
            'destination': t.dest_warehouse,
            'status': t.status,
            'my_role': role,
            'note': t.note
        })
    
    return jsonify(result), 200

@transfers_bp.route('/employees', methods=['GET'])
@jwt_required()
def get_local_employees():
    location = request.args.get('location')
    try:
        engine = get_engine(location)
        if not engine: return jsonify([]), 200

        with db.Session(bind=engine) as session:
            stmt = select(User).filter_by(role_name='employee')
            employees = session.execute(stmt).scalars().all()
            result = [{'id': u.id, 'name': f"{u.first_name} {u.last_name}"} for u in employees]
            return jsonify(result), 200
    except Exception as e:
        return jsonify({"msg": "Error fetching employees", "error": str(e)}), 500

@transfers_bp.route('/check_stock', methods=['GET'])
@jwt_required()
def check_stock():
    product_id = request.args.get('product_id')
    warehouse_bind = request.args.get('warehouse')
    engine = get_engine(warehouse_bind)
    if not engine: return jsonify({"quantity": 0}), 200
    try:
        with db.Session(bind=engine) as session:
            stock = session.execute(select(Stock).filter_by(product_id=product_id)).scalar_one_or_none()
            qty = stock.quantity if stock else 0
            return jsonify({"quantity": qty}), 200
    except Exception: return jsonify({"quantity": 0}), 200

@transfers_bp.route('/', methods=['POST'])
@jwt_required()
def create_transfer():
    data = request.get_json()

    source_bind = data['source']
    dest_bind = data['destination']
    product_id = data['product_id']
    quantity = int(data['quantity'])
    
    sender_id = data.get('sender_id') 

    if source_bind == dest_bind:
        return jsonify({"msg": "Cannot transfer to same warehouse"}), 400

    try:
        engine = get_engine(source_bind)
        if not engine: return jsonify({"msg": "Invalid source"}), 400

        with db.Session(bind=engine) as session:
            stock_item = session.execute(select(Stock).filter_by(product_id=product_id)).scalar_one_or_none()
            available_qty = stock_item.quantity if stock_item else 0
            
            if available_qty < quantity:
                return jsonify({"msg": f"Insufficient stock at source! Available: {available_qty}"}), 400

    except Exception as e:
        return jsonify({"msg": "Error validating stock", "error": str(e)}), 500


    new_transfer = Transfer(
        product_id=product_id,
        quantity=quantity,
        source_warehouse=source_bind,
        dest_warehouse=dest_bind,
        status='PENDING',
        note=data.get('note', ''),
        sender_id=sender_id
    )

    try:
        db.session.add(new_transfer)
        db.session.commit()
        return jsonify({"msg": "Transfer request created"}), 201
    except Exception as e:
        return jsonify({"msg": "Error creating transfer", "error": str(e)}), 500

@transfers_bp.route('/<int:transfer_id>/respond', methods=['PUT'])
@jwt_required()
def respond_transfer(transfer_id):
    data = request.get_json()
    action = data.get('action') 
    receiver_id = data.get('receiver_id')
    note = data.get('note', '')

    transfer = Transfer.query.get(transfer_id)
    if not transfer: return jsonify({"msg": "Transfer not found"}), 404

    if action == 'approve':
        transfer.status = 'APPROVED'
        if receiver_id: transfer.receiver_id = receiver_id
    elif action == 'deny':
        transfer.status = 'DENIED'
    
    if note: transfer.note = note
    try:
        db.session.commit()
        return jsonify({"msg": f"Transfer {action}d"}), 200
    except Exception as e:
        return jsonify({"msg": "Error updating transfer", "error": str(e)}), 500

@transfers_bp.route('/<int:transfer_id>/assign', methods=['PUT'])
@jwt_required()
def assign_receiver(transfer_id):
    data = request.get_json()
    transfer = Transfer.query.get(transfer_id)
    if not transfer: return jsonify({"msg": "Not found"}), 404
    transfer.receiver_id = data.get('receiver_id')
    db.session.commit()
    return jsonify({"msg": "Receiver assigned successfully"}), 200

@transfers_bp.route('/<int:transfer_id>/assign_sender', methods=['PUT'])
@jwt_required()
def assign_sender(transfer_id):
    data = request.get_json()
    sender_id = data.get('sender_id')
    
    transfer = Transfer.query.get(transfer_id)
    if not transfer: return jsonify({"msg": "Not found"}), 404
    
    transfer.sender_id = sender_id
    transfer.status = 'APPROVED' 
    
    db.session.commit()
    return jsonify({"msg": "Sender assigned and request Approved"}), 200

@transfers_bp.route('/<int:transfer_id>/process', methods=['POST'])
@jwt_required()
def process_transfer(transfer_id):
    current_username = get_jwt_identity()
    
    user_id = None
    user_location = None
    targets = [None] + [w.bind_key for w in Warehouse.query.all()]
    
    for bind in targets:
        try:
            engine = get_engine(bind)
            if engine:
                with db.Session(bind=engine) as session:
                    found = session.execute(select(User).filter_by(username=current_username)).scalar_one_or_none()
                    if found:
                        user_id = found.id
                        user_location = bind if bind else 'main'
                        break
        except Exception: continue
        
    if user_id is None: 
        return jsonify({"msg": "User not found"}), 400

    data = request.get_json()
    action = data.get('action') 
    transfer = Transfer.query.get(transfer_id)
    if not transfer: return jsonify({"msg": "Transfer not found"}), 404

    if action == 'send':
        if transfer.sender_id != user_id or transfer.source_warehouse != user_location: 
            return jsonify({"msg": "Not authorized to send (Wrong User or Location)"}), 403
        
        try:
            source_engine = get_engine(transfer.source_warehouse)
            with db.Session(bind=source_engine) as session:
                stock_item = session.execute(select(Stock).filter_by(product_id=transfer.product_id)).scalar_one_or_none()
                if not stock_item or stock_item.quantity < transfer.quantity:
                    return jsonify({"msg": "Not enough stock in warehouse!"}), 400
                stock_item.quantity -= transfer.quantity
                session.commit()
            transfer.status = 'IN_TRANSIT'
            db.session.commit()
            return jsonify({"msg": "Items shipped!"}), 200
        except Exception as e:
            return jsonify({"msg": "Error updating stock", "error": str(e)}), 500

    elif action == 'receive':
        if transfer.receiver_id != user_id or transfer.dest_warehouse != user_location:
            return jsonify({"msg": "Not authorized to receive (Wrong User or Location)"}), 403

        try:
            dest_engine = get_engine(transfer.dest_warehouse)
            with db.Session(bind=dest_engine) as session:
                stock_item = session.execute(select(Stock).filter_by(product_id=transfer.product_id)).scalar_one_or_none()
                if stock_item:
                    stock_item.quantity += transfer.quantity
                else:
                    new_stock = Stock(product_id=transfer.product_id, quantity=transfer.quantity)
                    session.add(new_stock)
                session.commit()
            transfer.status = 'COMPLETED'
            db.session.commit()
            return jsonify({"msg": "Items received!"}), 200
            
        except Exception as e:
            return jsonify({"msg": "Error updating stock", "error": str(e)}), 500

    return jsonify({"msg": "Invalid action"}), 400