import json
import uuid
import os
from datetime import datetime, date, timedelta
from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
import mysql.connector
from dotenv import load_dotenv

# --- NEW: Import Google Gemini ---
import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool

# --- 1. SETUP & CONFIGURATION ---
load_dotenv()
app = Flask(__name__)
CORS(app)

# ⚠️ --- CONFIG --- ⚠️
MYSQL_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': os.getenv('DB_PASSWORD'),
    'database': 'calander_project_try1',
    'connection_timeout': 5
}

# --- CONFIGURE GEMINI ---
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# --- 2. Custom JSON Encoder ---
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, bytes):
            try: return obj.decode('utf-8')
            except: return obj.hex()
        return super().default(obj)

app.json_encoder = CustomJSONEncoder

# --- 3. HELPER FUNCTIONS ---
def get_validated_tables(cnx):
    cursor = cnx.cursor()
    query = f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{MYSQL_CONFIG['database']}'"
    cursor.execute(query)
    all_tables = [row[0] for row in cursor.fetchall()]
    cursor.close()
    return all_tables

def get_default_user_id():
    """Fetches the first user ID found to use as default for AI actions."""
    try:
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor()
        cursor.execute("SELECT id FROM users LIMIT 1")
        result = cursor.fetchone()
        cnx.close()
        if result:
            return result[0]
        return "00000000-0000-0000-0000-000000000000" # Fallback dummy ID
    except:
        return "00000000-0000-0000-0000-000000000000"

# --- 4. AI TOOLS (The Functions Gemini can call) ---

def create_event_tool(title: str, start_time: str, end_time: str, description: str = ""):
    """
    Creates a new calendar event in the database.
    
    Args:
        title: The title of the event (e.g., "Meeting with Bob").
        start_time: Start time in 'YYYY-MM-DD HH:MM:SS' format.
        end_time: End time in 'YYYY-MM-DD HH:MM:SS' format.
        description: (Optional) A short description.
    """
    try:
        print(f"--- AI TOOL: Creating Event '{title}' ---")
        user_id = get_default_user_id()
        new_id = str(uuid.uuid4())
        
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor()
        
        query = """
            INSERT INTO events (id, user_id, title, start_time, end_time, description)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (new_id, user_id, title, start_time, end_time, description))
        cnx.commit()
        cursor.close()
        cnx.close()
        return f"Success! Event created with ID: {new_id}"
    except Exception as e:
        return f"Error creating event: {str(e)}"

def create_task_tool(title: str, due_date: str):
    """
    Creates a new task in the database.
    
    Args:
        title: The task name (e.g., "Buy Milk").
        due_date: Due date in 'YYYY-MM-DD' format.
    """
    try:
        print(f"--- AI TOOL: Creating Task '{title}' ---")
        user_id = get_default_user_id()
        new_id = str(uuid.uuid4())
        
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor()
        
        query = """
            INSERT INTO tasks (id, user_id, title, due_date, status)
            VALUES (%s, %s, %s, %s, 'pending')
        """
        cursor.execute(query, (new_id, user_id, title, due_date))
        cnx.commit()
        cursor.close()
        cnx.close()
        return f"Success! Task created with ID: {new_id}"
    except Exception as e:
        return f"Error creating task: {str(e)}"

# Define the dictionary of tools for Gemini
tools_list = [create_event_tool, create_task_tool]

# --- 5. EXISTING API ROUTES (Tables, CRUD) ---
@app.route('/', methods=['GET'])
def home():
    return jsonify({"message": "Welcome! Server is responding.", "status": "Online"})

@app.route('/api/tables', methods=['GET'])
def get_table_list():
    try:
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        data = get_validated_tables(cnx)
        cnx.close()
        return jsonify(data)
    except Exception as e:
        return make_response(jsonify({"error": str(e)}), 500)

@app.route('/api/data/<table_name>', methods=['GET', 'POST'])
def handle_table_data(table_name):
    # ... (Your existing validation logic here) ...
    try:
        cnx_val = mysql.connector.connect(**MYSQL_CONFIG)
        all_tables = get_validated_tables(cnx_val)
        cnx_val.close()
    except Exception as e:
         return make_response(jsonify({"error": str(e)}), 500)

    if table_name not in all_tables:
        return make_response(jsonify({"error": "Invalid table"}), 400)

    if request.method == 'GET':
        try:
            cnx = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor(dictionary=True) 
            query = f"SELECT * FROM `{table_name}` LIMIT 100" 
            cursor.execute(query)
            cols = cursor.column_names
            rows = cursor.fetchall()
            cursor.close()
            cnx.close()
            return jsonify({"columns": cols, "rows": rows})
        except Exception as e:
            return make_response(jsonify({"error": str(e)}), 500)

    if request.method == 'POST':
        try:
            data = request.json
            data['id'] = str(uuid.uuid4())
            cleaned_data = {k: (None if v == '' else v) for k, v in data.items()}
            
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
            return jsonify({"success": True, "id": data['id']})
        except Exception as e:
            return make_response(jsonify({"error": str(e)}), 400)

@app.route('/api/data/<table_name>/<item_id>', methods=['PUT', 'DELETE'])
def handle_item(table_name, item_id):
    # ... (Your existing PUT/DELETE logic here) ...
    if request.method == 'DELETE':
        try:
            cnx = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor()
            cursor.execute(f"DELETE FROM `{table_name}` WHERE id = %s", (item_id,))
            cnx.commit()
            cursor.close()
            cnx.close()
            return jsonify({"success": True})
        except Exception as e:
            return make_response(jsonify({"error": str(e)}), 400)

    if request.method == 'PUT':
        try:
            data = request.json
            cleaned_data = {k: (None if v == '' else v) for k, v in data.items() if k != 'id'}
            set_clause = ", ".join([f"`{col}` = %s" for col in cleaned_data.keys()])
            values = list(cleaned_data.values())
            values.append(item_id)
            
            cnx = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor()
            cursor.execute(f"UPDATE `{table_name}` SET {set_clause} WHERE id = %s", tuple(values))
            cnx.commit()
            cursor.close()
            cnx.close()
            return jsonify({"success": True})
        except Exception as e:
            return make_response(jsonify({"error": str(e)}), 400)


# --- 6. ⭐️ NEW AI CHAT ROUTE (Updated for Gemini 2.0) ⭐️ ---
@app.route('/api/chat', methods=['POST'])
def chat_with_ai():
    try:
        user_message = request.json.get('message', '')
        
        # ⭐️ UPDATE: Using a model from your available list ⭐️
        model_name = 'gemini-2.0-flash' 
        
        model = genai.GenerativeModel(model_name, tools=tools_list)
        
        # 2. Start a chat session (enable automatic function calling)
        chat = model.start_chat(enable_automatic_function_calling=True)
        
        # 3. Create System Prompt
        today_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        day_name = datetime.now().strftime("%A")
        
        system_context = f"""
        You are a helpful Calendar Assistant.
        Current Date/Time: {day_name}, {today_str}.
        
        If the user asks to create an event or task, use the provided tools.
        For events, assume a default duration of 1 hour if not specified.
        If the user doesn't specify a year, assume the current year.
        Answer briefly and confirm when an action is taken.
        """
        
        # 4. Send message
        full_prompt = f"{system_context}\n\nUser: {user_message}"
        response = chat.send_message(full_prompt)
        
        # 5. Return result
        # Handle cases where response might be blocked or empty
        if not response.parts:
             return jsonify({"response": "I processed the action, but I have no text response."})
             
        return jsonify({"response": response.text})

    except Exception as e:
        print(f"AI Error: {e}")
        # Return a clean error so we see it in the chat bubble
        return make_response(jsonify({"error": f"Model Error ({model_name}): {str(e)}"}), 500)

if __name__ == '__main__':
    print("--- Starting Flask server on http://127.0.0.1:5001 ---")
    app.run(debug=True, port=5001)