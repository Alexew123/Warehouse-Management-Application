import os
from flask import Flask
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from dotenv import load_dotenv

from models import db, User, Warehouse
from routes.auth import auth_bp
from routes.users import users_bp
from routes.warehouse import warehouses_bp

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL_MAIN')
app.config['SQLALCHEMY_BINDS'] = {
    'cluj':  os.getenv('DATABASE_URL_CLUJ'),
    'mures': os.getenv('DATABASE_URL_MURES')
}
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')


db.init_app(app)
jwt = JWTManager(app)
CORS(app)

app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(users_bp, url_prefix='/users')
app.register_blueprint(warehouses_bp, url_prefix='/warehouses')

if __name__ == '__main__':
    with app.app_context():
        try:
            db.create_all()

            db.metadata.create_all(bind=db.engines['cluj'])

            db.metadata.create_all(bind=db.engines['mures'])
            print("Databases connected.")
        except Exception as e:
            print(f"Databases connection failed: {e}")

    app.run(debug=True)