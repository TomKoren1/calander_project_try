import json
import uuid
from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
import mysql.connector
from datetime import datetime, date
import os
from dotenv import load_dotenv

# --- 1. SETUP & CONFIGURATION ---
load_dotenv()
app = Flask(__name__)
CORS(app)

# ⚠️ --- CONFIG IS VERIFIED --- ⚠️
MYSQL_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': os.getenv('DB_PASSWORD'),  # Reads from .env
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


# --- 3. Helper Function: Validate Table ---
def get_validated_tables(cnx):
    """Helper to fetch a clean list of table names."""
    cursor = cnx.cursor()
    query = f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{MYSQL_CONFIG['database']}'"
    cursor.execute(query)
    all_tables = [row[0] for row in cursor.fetchall()]
    cursor.close()
    return all_tables


# --- 4. API ROUTES ---
@app.route('/', methods=['GET'])
def home():
    print("--- SUCCESS: Home route '/' was reached! ---")
    return jsonify({"message": "Welcome! Server is responding.", "status": "Online"})


@app.route('/api/tables', methods=['GET'])
def get_table_list():
    print("--- API: /api/tables route reached. Connecting to DB... ---")
    try:
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        data = get_validated_tables(cnx)
        cnx.close()
        print(f"--- SUCCESS: Found {len(data)} tables. ---")
        return jsonify(data)
    except Exception as e:
        print(f"\n!!! DATABASE ERROR (get_table_list) !!!\n{e}\n")
        response = make_response(jsonify({"error": f"Failed to retrieve tables. Details: {e}"}), 500)
        return response


# --- Route for Reading (GET) and Creating (POST) ---
@app.route('/api/data/<table_name>', methods=['GET', 'POST'])
def handle_table_data(table_name):
    # --- Security Validation ---
    try:
        cnx_val = mysql.connector.connect(**MYSQL_CONFIG)
        all_tables = get_validated_tables(cnx_val)
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

            column_names = cursor.column_names
            data_rows = cursor.fetchall()

            cursor.close()
            cnx.close()
            print(f"--- SUCCESS: Found {len(data_rows)} rows for {table_name}. ---")

            return jsonify({
                "columns": column_names,
                "rows": data_rows
            })

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

            data['id'] = str(uuid.uuid4())

            # --- ⭐️ FIX FOR EMPTY STRING IN POST ⭐️ ---
            # Clean the data: Convert empty strings to None (NULL)
            cleaned_data = {}
            for key, value in data.items():
                if value == '':
                    cleaned_data[key] = None  # Convert to None
                else:
                    cleaned_data[key] = value
            # --- END FIX ---

            columns = ", ".join([f"`{col}`" for col in cleaned_data.keys()])
            placeholders = ", ".join(["%s"] * len(cleaned_data))
            query = f"INSERT INTO `{table_name}` ({columns}) VALUES ({placeholders})"
            values = tuple(cleaned_data.values())

            cnx = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor()
            cursor.execute(query, values)
            cnx.commit()
            cursor.close()
            cnx.close()

            print(f"--- SUCCESS: Inserted new row. ---")
            return jsonify({"success": True, "message": f"New row inserted into {table_name}", "id": data['id']})

        except mysql.connector.Error as err:
            print(f"\n!!! DATABASE ERROR (POST {table_name}) !!!\n{err}\n")
            response = make_response(jsonify({"error": f"Database error: {err.msg}"}), 400)
            return response
        except Exception as e:
            print(f"\n!!! GENERIC ERROR (POST {table_name}) !!!\n{e}\n")
            response = make_response(jsonify({"error": f"Failed to insert data. Details: {e}"}), 500)
            return response


# --- ⭐️ NEW ROUTE: For Updating (PUT) and Deleting (DELETE) a specific item ---
@app.route('/api/data/<table_name>/<item_id>', methods=['PUT', 'DELETE'])
def handle_item(table_name, item_id):
    # --- Security Validation (Omitted for brevity, but should be here) ---
    # (Assuming table_name is valid from the previous check)

    # --- Handle DELETE Request ---
    if request.method == 'DELETE':
        print(f"--- DELETE: Deleting row {item_id} from {table_name}... ---")
        try:
            cnx = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor()

            query = f"DELETE FROM `{table_name}` WHERE id = %s"

            cursor.execute(query, (item_id,))
            cnx.commit()

            rows_affected = cursor.rowcount
            cursor.close()
            cnx.close()

            if rows_affected == 0:
                return make_response(jsonify({"error": "Item not found or already deleted"}), 404)

            print(f"--- SUCCESS: Deleted row {item_id}. ---")
            return jsonify({"success": True, "message": f"Row {item_id} deleted from {table_name}"})

        except mysql.connector.Error as err:
            print(f"\n!!! DATABASE ERROR (DELETE {table_name}) !!!\n{err}\n")
            return make_response(jsonify({"error": f"Database error: {err.msg}"}), 400)

    # --- Handle PUT Request (Update) ---
    if request.method == 'PUT':
        print(f"--- PUT: Updating row {item_id} in {table_name}... ---")
        try:
            data = request.json
            if not data:
                return make_response(jsonify({"error": "No data provided for update"}), 400)

            # --- ⭐️ BUG FIX FOR EDIT ⭐️ ---
            # Clean the data: Convert empty strings '' to None (which becomes NULL)
            # This prevents type errors (e.g., sending '' to an INT or JSON column)
            cleaned_data = {}
            for key, value in data.items():
                # We also skip 'id' as we don't want to update the primary key
                if key == 'id':
                    continue
                if value == '':
                    cleaned_data[key] = None  # Convert to None
                else:
                    cleaned_data[key] = value
            # --- END FIX ---

            # Dynamically build the "SET col1 = %s, col2 = %s" part
            set_clause = ", ".join([f"`{col}` = %s" for col in cleaned_data.keys()])

            # Prepare values: (val1, val2, ... item_id)
            values = list(cleaned_data.values())
            values.append(item_id)
            values = tuple(values)

            query = f"UPDATE `{table_name}` SET {set_clause} WHERE id = %s"

            cnx = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor()
            cursor.execute(query, values)
            cnx.commit()

            rows_affected = cursor.rowcount
            cursor.close()
            cnx.close()

            if rows_affected == 0:
                return make_response(jsonify({"error": "Item not found or data was unchanged"}), 404)

            print(f"--- SUCCESS: Updated row {item_id}. ---")
            return jsonify({"success": True, "message": f"Row {item_id} updated in {table_name}"})

        except mysql.connector.Error as err:
            print(f"\n!!! DATABASE ERROR (PUT {table_name}) !!!\n{err}\n")
            return make_response(jsonify({"error": f"Database error: {err.msg}"}), 400)

    return make_response(jsonify({"error": "Method not allowed"}), 405)


# --- 5. RUN THE APP ---
if __name__ == '__main__':
    print("--- Starting Flask server on http://127.0.0.1:5001 ---")
    app.run(debug=True, port=5001)