from flask import Blueprint, jsonify, request
from models import db, Warehouse

warehouses_bp = Blueprint('warehouses', __name__)

@warehouses_bp.route('/', methods=['GET'])
def get_warehouses():
    items = Warehouse.query.all()
    result = []
    for w in items:
        result.append({
            'id': w.id,
            'name': w.name,
            'bind_key': w.bind_key
        })
    return jsonify(result), 200

@warehouses_bp.route('/', methods=['POST'])
def create_warehouse():
    data = request.get_json()
    new_w = Warehouse(name=data['name'], bind_key=data['bind_key'])
    db.session.add(new_w)
    db.session.commit()
    return jsonify({"msg": "Warehouse added to directory"}), 201