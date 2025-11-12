import json
import uuid
from flask import Flask, jsonify, make_response
from flask_cors import CORS
import mysql.connector
from datetime import datetime, date


# NOTE: Dependencies needed: pip install Flask mysql-connector-python flask-cors

# --- 1. SETUP & CONFIGURATION ---
app = Flask(__name__)
# Enable CORS for development
CORS(app)

# ⚠️ --- CONFIG IS VERIFIED - NO CHANGES NEEDED --- ⚠️
MYSQL_CONFIG = {
    'host': '127.0.0.1',            # Use 127.0.0.1
    'port': 3306,                   # Explicitly state the port
    'user': 'root',
    'password': 'Tom7845120!',          # Make sure this is correct
    'database': 'calander_project_try1',
    'connection_timeout': 5         # Keep the 5-second timeout
}
# ---------------------------------------------


# --- 2. Custom JSON Encoder ---
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, bytes):
            try:
                return obj.decode('utf-8')
            except UnicodeDecodeError:
                return obj.hex()
        return super().default(obj)

app.json_encoder = CustomJSONEncoder


# --- 3. API ROUTES ---
@app.route('/', methods=['GET'])
def home():
    # This route has no database code. If it works, the server is running.
    print("--- SUCCESS: Home route '/' was reached! ---")
    return jsonify({"message": "Welcome! Server is responding.", "status": "Online"})


@app.route('/api/tables', methods=['GET'])
def get_table_list():
    print("--- API: /api/tables route reached. Connecting to DB... ---")
    try:
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor()
        query = f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{MYSQL_CONFIG['database']}'"
        cursor.execute(query)
        data = [row[0] for row in cursor.fetchall()]
        cursor.close()
        cnx.close()
        print(f"--- SUCCESS: Found {len(data)} tables. ---")
        return jsonify(data)
    except Exception as e:
        print(f"\n!!! DATABASE ERROR (get_table_list) !!!\n{e}\n")
        response = make_response(jsonify({"error": f"Failed to retrieve tables. Details: {e}"}), 500)
        return response


@app.route('/api/data/<table_name>', methods=['GET'])
def get_data_by_table(table_name):
    print(f"--- API: /api/data/{table_name} route reached. Validating... ---")
    # We fetch the *real* table list first for validation
    try:
        cnx_val = mysql.connector.connect(**MYSQL_CONFIG)
        cursor_val = cnx_val.cursor()
        query_val = f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{MYSQL_CONFIG['database']}'"
        cursor_val.execute(query_val)
        all_tables = [row[0] for row in cursor_val.fetchall()]
        cursor_val.close()
        cnx_val.close()
    except Exception as e:
         print(f"\n!!! DATABASE ERROR (get_data_by_table - validation) !!!\n{e}\n")
         return make_response(jsonify({"error": f"Failed to validate table list: {e}"}), 500)

    if table_name not in all_tables:
        print(f"--- ERROR: Invalid table name requested: {table_name} ---")
        return make_response(jsonify({"error": f"Invalid or unauthorized table name: {table_name}"}), 400)

    print(f"--- Validated. Fetching data for {table_name}... ---")
    try:
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor(dictionary=True)
        query = f"SELECT * FROM `{table_name}` LIMIT 100"
        cursor.execute(query)
        data = cursor.fetchall()
        cursor.close()
        cnx.close()
        print(f"--- SUCCESS: Found {len(data)} rows for {table_name}. ---")
        return jsonify(data)
    except Exception as e:
        print(f"\n!!! DATABASE ERROR (get_data_by_table - fetch) !!!\n{e}\n")
        response = make_response(jsonify({"error": f"Failed to fetch data for {table_name}. Details: {e}"}), 500)
        return response

# --- 4. RUN THE APP ---
if __name__ == '__main__':
    # ⚠️ --- RUNNING ON A NEW PORT: 5001 --- ⚠️
    print("--- Starting Flask server on http://127.0.0.1:5001 ---")
    app.run(debug=True, port=5001)