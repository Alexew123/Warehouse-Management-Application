from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from models import db, Product, Stock, Warehouse
from sqlalchemy import select

inventory_bp = Blueprint('inventory', __name__)

@inventory_bp.route('/global', methods=['GET'])
@jwt_required()
def get_global_inventory():
    try:
        all_products = Product.query.all()
        
        inventory_map = {
            p.id: {
                'id': p.id,
                'name': p.name,
                'category': p.category,
                'price': p.price,
                'total_quantity': 0,
                'breakdown': []
            } 
            for p in all_products
        }

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

                with db.Session(bind=engine) as session:
                    stmt = select(Stock)
                    stock_items = session.execute(stmt).scalars().all()

                    for item in stock_items:
                        if item.product_id in inventory_map:
                            inventory_map[item.product_id]['total_quantity'] += item.quantity
                            
                            inventory_map[item.product_id]['breakdown'].append({
                                'location': target.name,
                                'quantity': item.quantity
                            })

            except Exception as e:
                print(f"⚠️ Error reading inventory from {target.name}: {e}")

        results = list(inventory_map.values())
        return jsonify(results), 200

    except Exception as e:
        return jsonify({"msg": "Error fetching global inventory", "error": str(e)}), 500


@inventory_bp.route('/products', methods=['GET'])
@jwt_required()
def get_products():
    products = Product.query.all()
    result = [{'id': p.id, 'name': p.name, 'category': p.category, 'price': p.price} for p in products]
    return jsonify(result), 200

@inventory_bp.route('/products', methods=['POST'])
@jwt_required()
def create_product():
    data = request.get_json()
    new_prod = Product(
        name=data['name'],
        category=data['category'],
        price=data.get('price', 0),
        description=data.get('description', '')
    )
    try:
        db.session.add(new_prod)
        db.session.commit()
        return jsonify({"msg": "Product created"}), 201
    except Exception as e:
        return jsonify({"msg": "Error", "error": str(e)}), 500


@inventory_bp.route('/stock', methods=['POST'])
@jwt_required()
def add_stock():
    data = request.get_json()
    target_bind = data.get('warehouse_bind_key')
    product_id = data.get('product_id')
    quantity = int(data.get('quantity'))

    if target_bind == 'null' or target_bind == "": target_bind = None

    try:
        if target_bind is None:
            engine = db.engine
        else:
            engine = db.engines[target_bind]

        with db.Session(bind=engine) as session:
            stmt = select(Stock).filter_by(product_id=product_id)
            existing_stock = session.execute(stmt).scalar_one_or_none()

            if existing_stock:
                existing_stock.quantity += quantity
            else:
                new_stock = Stock(product_id=product_id, quantity=quantity)
                session.add(new_stock)
            
            session.commit()
            return jsonify({"msg": "Stock updated"}), 201

    except Exception as e:
        return jsonify({"msg": "Error updating stock", "error": str(e)}), 500
    
@inventory_bp.route('/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    try:
        warehouses = Warehouse.query.all()
        class MainMock:
             bind_key = None
        targets = [MainMock()] + warehouses

        for target in targets:
            try:
                if target.bind_key is None:
                    engine = db.engine
                else:
                    engine = db.engines[target.bind_key]
                
                with db.Session(bind=engine) as session:
                    stmt = select(Stock).filter_by(product_id=product_id)
                    stock_entries = session.execute(stmt).scalars().all()
                    for entry in stock_entries:
                        session.delete(entry)
                    session.commit()
            except Exception as e:
                print(f"⚠️ Failed to clean stock in {target.bind_key}: {e}")

        product = Product.query.get(product_id)
        if product:
            db.session.delete(product)
            db.session.commit()
            return jsonify({"msg": "Product and all distributed stock deleted"}), 200
        else:
            return jsonify({"msg": "Product not found"}), 404

    except Exception as e:
        return jsonify({"msg": "Error deleting product", "error": str(e)}), 500


@inventory_bp.route('/stock', methods=['DELETE'])
@jwt_required()
def delete_stock():
    product_id = request.args.get('product_id')
    target_bind = request.args.get('warehouse_bind_key')

    if target_bind == 'null': target_bind = None

    try:
        if target_bind is None:
             engine = db.engine
        else:
             engine = db.engines[target_bind]

        with db.Session(bind=engine) as session:
            stmt = select(Stock).filter_by(product_id=product_id)
            stock_item = session.execute(stmt).scalar_one_or_none()
            
            if stock_item:
                session.delete(stock_item)
                session.commit()
                return jsonify({"msg": "Stock removed from warehouse"}), 200
            else:
                return jsonify({"msg": "Stock not found in this warehouse"}), 404

    except Exception as e:
         return jsonify({"msg": "Error removing stock", "error": str(e)}), 500
    
    
@inventory_bp.route('/local', methods=['GET'])
@jwt_required()
def get_local_stock():
    location = request.args.get('location')
    
    try:
        all_products = Product.query.all()
        product_map = {p.id: {'name': p.name, 'category': p.category} for p in all_products}

        if not location or location == 'main':
            engine = db.engine
        else:
            engine = db.engines.get(location)
            if not engine: return jsonify([]), 200

        local_stock = []
        with db.Session(bind=engine) as session:
            stocks = session.execute(db.select(Stock)).scalars().all()
            
            for s in stocks:
                p_details = product_map.get(s.product_id, {'name': 'Unknown', 'category': '-'})
                local_stock.append({
                    'id': s.product_id,
                    'name': p_details['name'],
                    'category': p_details['category'],
                    'quantity': s.quantity
                })

        return jsonify(local_stock), 200

    except Exception as e:
        return jsonify({"msg": "Error fetching local stock", "error": str(e)}), 500