import json
import uuid
from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
import mysql.connector
from datetime import datetime, date
import os  # <-- Import OS
from dotenv import load_dotenv  # <-- Import dotenv

# --- 1. SETUP & CONFIGURATION ---
load_dotenv()  # <-- Load the .env file
app = Flask(__name__)
CORS(app)

# ⚠️ --- CONFIG IS VERIFIED --- ⚠️
MYSQL_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': os.getenv('DB_PASSWORD'),  # <-- Read from .env
    'database': 'calander_project_try1',
    'connection_timeout': 5
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


# --- (CHANGED) This route now handles GET (read) and POST (create) ---
@app.route('/api/data/<table_name>', methods=['GET', 'POST'])
def handle_table_data(table_name):
    # --- First, validate the table name to prevent SQL injection ---
    try:
        cnx_val = mysql.connector.connect(**MYSQL_CONFIG)
        cursor_val = cnx_val.cursor()
        query_val = f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{MYSQL_CONFIG['database']}'"
        cursor_val.execute(query_val)
        all_tables = [row[0] for row in cursor_val.fetchall()]
        cursor_val.close()
        cnx_val.close()
    except Exception as e:
        print(f"\n!!! DATABASE ERROR (Validation) !!!\n{e}\n")
        return make_response(jsonify({"error": f"Failed to validate table list: {e}"}), 500)

    if table_name not in all_tables:
        print(f"--- ERROR: Invalid table name requested: {table_name} ---")
        return make_response(jsonify({"error": f"Invalid or unauthorized table name: {table_name}"}), 400)

    # --- Handle GET Request (Fetch Data) ---
    if request.method == 'GET':
        print(f"--- GET: Fetching data for {table_name}... ---")
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
            print(f"\n!!! DATABASE ERROR (GET {table_name}) !!!\n{e}\n")
            response = make_response(jsonify({"error": f"Failed to fetch data for {table_name}. Details: {e}"}), 500)
            return response

    # --- Handle POST Request (Insert Data) ---
    if request.method == 'POST':
        print(f"--- POST: Inserting data into {table_name}... ---")
        try:
            data = request.json
            if not data:
                return make_response(jsonify({"error": "No data provided in request body"}), 400)

            # --- ⭐️ NEW FIX (Problem 1) ⭐️ ---
            # Your schema uses CHAR(36) for all 'id' fields.
            # The form doesn't send an 'id', so we must generate one.
            data['id'] = str(uuid.uuid4())
            # --- END FIX ---

            # Dynamically build the INSERT query to be secure
            # We use backticks (`) to safely handle column names
            columns = ", ".join([f"`{col}`" for col in data.keys()])
            # We use %s placeholders for values to prevent SQL injection
            placeholders = ", ".join(["%s"] * len(data))

            query = f"INSERT INTO `{table_name}` ({columns}) VALUES ({placeholders})"

            # The mysql-connector driver requires values as a tuple
            values = tuple(data.values())

            cnx = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor()
            cursor.execute(query, values)

            # --- IMPORTANT: Commit the changes to the database ---
            cnx.commit()

            new_id = cursor.lastrowid

            cursor.close()
            cnx.close()

            print(f"--- SUCCESS: Inserted new row. ID: {new_id} ---")
            # Note: lastrowid doesn't work well with UUIDs, but the success message is good.
            return jsonify({"success": True, "message": f"New row inserted into {table_name}", "id": data['id']})

        except mysql.connector.Error as err:
            # Handle specific database errors (e.g., duplicate key, data too long)
            print(f"\n!!! DATABASE ERROR (POST {table_name}) !!!\n{err}\n")
            response = make_response(jsonify({"error": f"Database error: {err.msg}"}), 400)
            return response
        except Exception as e:
            print(f"\n!!! GENERIC ERROR (POST {table_name}) !!!\n{e}\n")
            response = make_response(jsonify({"error": f"Failed to insert data. Details: {e}"}), 500)
            return response


# --- 4. RUN THE APP ---
if __name__ == '__main__':
    print("--- Starting Flask server on http://127.0.0.1:5001 ---")
    app.run(debug=True, port=5001)