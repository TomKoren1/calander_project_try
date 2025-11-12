import json
from flask import Flask, jsonify, make_response
from flask_cors import CORS

# NOTE ON MYSQL: You will need to install a MySQL connector.
# The most common one is 'mysql-connector-python'.
# Installation: pip install Flask mysql-connector-python flask-cors

# --- 1. SETUP & CONFIGURATION ---
app = Flask(__name__)
# Enable CORS for development so your HTML file can talk to the Flask server
CORS(app)

# Replace these placeholders with your actual MySQL credentials
MYSQL_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': 'Tom7845120!',
    'database': 'mydb_test'
}


# --- 2. MOCK DATA (Fallback for Testing) ---
def get_mock_data():
    """Returns mock data structure identical to the simulated SQL result."""
    return [
        # Existing Products
        {"id": 1001, "name": "Ergonomic Mechanical Keyboard", "category": "Electronics", "price": 129.99, "stock": 45},
        {"id": 1002, "name": "4K Ultra-Wide Monitor", "category": "Electronics", "price": 799.00, "stock": 12},
        {"id": 2003, "name": "Organic Coffee Beans (Guatemala)", "category": "Food & Beverage", "price": 18.50,
         "stock": 200},
        {"id": 3005, "name": "Noise Cancelling Headphones", "category": "Electronics", "price": 249.99, "stock": 30},
        {"id": 7010, "name": "Weighted Blanket (20 lbs)", "category": "Home Goods", "price": 85.00, "stock": 110},

        # Added Products to make the "sheet" longer
        {"id": 4011, "name": "Running Shoes (Athletic Fit)", "category": "Apparel", "price": 95.50, "stock": 150},
        {"id": 4012, "name": "Bamboo Fiber Socks (Pack of 5)", "category": "Apparel", "price": 19.99, "stock": 300},
        {"id": 5013, "name": "Modular Sofa Sectional", "category": "Furniture", "price": 1800.00, "stock": 5},
        {"id": 5014, "name": "Smart Home Hub v2", "category": "Electronics", "price": 199.99, "stock": 75},
        {"id": 6015, "name": "Gourmet Dark Chocolate Bar", "category": "Food & Beverage", "price": 8.95, "stock": 500},
        {"id": 6016, "name": "Portable Power Bank (20,000mAh)", "category": "Electronics", "price": 45.00,
         "stock": 120},
        {"id": 7017, "name": "Travel Backpack (Waterproof)", "category": "Accessories", "price": 65.00, "stock": 88},
        {"id": 7018, "name": "Yoga Mat (Extra Thick)", "category": "Home Goods", "price": 29.99, "stock": 160},
        {"id": 8019, "name": "Electric Toothbrush Set", "category": "Personal Care", "price": 79.00, "stock": 90},
        {"id": 8020, "name": "Essential Oil Diffuser", "category": "Home Goods", "price": 39.99, "stock": 210},
        {"id": 9999, "name": "NEW_TEST", "category": "TOM", "price": 1039.99, "stock": 2},
    ]


# --- 3. DATABASE API ROUTES ---

@app.route('/', methods=['GET'])
def home():
    """Provides a simple instruction message for the base URL."""
    return jsonify({
        "message": "Welcome to the Product Catalog API.",
        "instructions": "Access data at the /api/products endpoint.",
        "status": "Online"
    })


@app.route('/api/products', methods=['GET'])
def get_products():
    """
    Connects to MySQL, executes a query, and returns the results as JSON.
    """
    try:
        # NOTE: You MUST uncomment and install 'mysql.connector' to use this block.
        import mysql.connector

        # --- PRODUCTION CODE (Uncomment when ready to connect to MySQL) ---

        # 1. Establish Connection
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor(dictionary=True)

        # 2. Define SQL Query (Ensure column names match the frontend's expectation: id, name, category, price, stock)
        query = ("SELECT id, name, catagory, price, stock "
                 "FROM products LIMIT 100")

        # 3. Execute Query
        cursor.execute(query)
        data = cursor.fetchall() # Fetches all rows as a list of dictionaries

        # 4. Close resources
        cursor.close()
        cnx.close()

        # 5. Return data
        return jsonify(data)


        # --- DEVELOPMENT/MOCK DATA FALLBACK (Used if the above block is commented out) ---
        # If the production code is commented out, return mock data for initial testing.
        return jsonify(get_mock_data())

    except ImportError:
        # This handles the case if 'mysql.connector' is not installed
        error_msg = "Error: 'mysql-connector-python' is not installed. Using mock data."
        print(error_msg)
        return jsonify(get_mock_data())

    except Exception as e:
        # Handle connection or query errors
        print(f"Database error: {e}")
        # Return a 500 error response
        response = make_response(jsonify({"error": "Failed to retrieve data from the database."}), 500)
        return response


# --- 4. RUN THE APP ---
if __name__ == '__main__':
    # Flask runs on http://127.0.0.1:5000 by default.
    app.run(debug=True, port=5000)