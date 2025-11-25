import json
import uuid
import os
from datetime import datetime, date, timedelta
from flask import Flask, jsonify, make_response, request
from flask_cors import CORS
import mysql.connector
from dotenv import load_dotenv
import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool

# --- 1. SETUP & CONFIGURATION ---
load_dotenv()
app = Flask(__name__)
CORS(app)

MYSQL_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': os.getenv('DB_PASSWORD'),
    'database': 'calander_project_try1',
    'connection_timeout': 5
}

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)): return obj.isoformat()
        if isinstance(obj, uuid.UUID): return str(obj)
        if isinstance(obj, bytes):
            try: return obj.decode('utf-8')
            except: return obj.hex()
        return super().default(obj)

app.json_encoder = CustomJSONEncoder

# --- HELPER FUNCTIONS ---
def link_item_to_goal(cnx, goal_id, item_type, item_id):
    try:
        cursor = cnx.cursor()
        link_id = str(uuid.uuid4())
        query = "INSERT INTO goal_links (id, goal_id, item_type, item_id) VALUES (%s, %s, %s, %s)"
        cursor.execute(query, (link_id, goal_id, item_type, item_id))
        cnx.commit()
        cursor.close()
    except Exception as e:
        print(f"--- WARNING: Failed to link to goal: {e} ---")

def get_validated_tables(cnx):
    cursor = cnx.cursor()
    cursor.execute(f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{MYSQL_CONFIG['database']}'")
    tables = [row[0] for row in cursor.fetchall()]
    cursor.close()
    return tables

def get_default_user_id():
    try:
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor()
        cursor.execute("SELECT id FROM users LIMIT 1")
        result = cursor.fetchone()
        cnx.close()
        return result[0] if result else "00000000-0000-0000-0000-000000000000"
    except:
        return "00000000-0000-0000-0000-000000000000"

# --- 4. AI TOOLS ---

def create_goal_tool(title: str, end_date: str, description: str):
    try:
        print(f"--- AI TOOL: Creating Goal '{title}' ---")
        user_id = get_default_user_id()
        new_id = str(uuid.uuid4())
        start_date = date.today().isoformat()
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor()
        query = "INSERT INTO goals (id, user_id, title, description, start_date, end_date, status, progress_type) VALUES (%s, %s, %s, %s, %s, %s, 'active', 'manual')"
        cursor.execute(query, (new_id, user_id, title, description, start_date, end_date))
        cnx.commit()
        cursor.close()
        cnx.close()
        return f"{new_id}" 
    except Exception as e: return f"Error: {str(e)}"

def batch_create_tasks_tool(goal_id: str, tasks_json: str):
    try:
        tasks = json.loads(tasks_json)
        print(f"--- AI TOOL: Batch Creating {len(tasks)} Tasks for Goal {goal_id} ---")
        user_id = get_default_user_id()
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor()
        count = 0
        for task in tasks:
            new_id = str(uuid.uuid4())
            title = task.get('title', 'Untitled Task')
            due_date = task.get('due_date', date.today().isoformat())
            description = task.get('description', '')
            query = "INSERT INTO tasks (id, user_id, title, due_date, description, status) VALUES (%s, %s, %s, %s, %s, 'pending')"
            cursor.execute(query, (new_id, user_id, title, due_date, description))
            if goal_id:
                link_id = str(uuid.uuid4())
                link_q = "INSERT INTO goal_links (id, goal_id, item_type, item_id) VALUES (%s, %s, 'task', %s)"
                cursor.execute(link_q, (link_id, goal_id, new_id))
            count += 1
        cnx.commit()
        cursor.close()
        cnx.close()
        return f"Success! Created {count} distinct tasks."
    except Exception as e:
        return f"Error in batch creation: {str(e)}"

def create_event_tool(title: str, start_time: str, end_time: str, description: str):
    try:
        user_id = get_default_user_id()
        new_id = str(uuid.uuid4())
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor()
        query = "INSERT INTO events (id, user_id, title, start_time, end_time, description) VALUES (%s, %s, %s, %s, %s, %s)"
        cursor.execute(query, (new_id, user_id, title, start_time, end_time, description))
        cnx.commit()
        cursor.close()
        cnx.close()
        return f"Success! Event created."
    except Exception as e: return f"Error: {str(e)}"

def create_task_tool(title: str, due_date: str, description: str):
    try:
        user_id = get_default_user_id()
        new_id = str(uuid.uuid4())
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = cnx.cursor()
        query = "INSERT INTO tasks (id, user_id, title, due_date, description, status) VALUES (%s, %s, %s, %s, %s, 'pending')"
        cursor.execute(query, (new_id, user_id, title, due_date, description))
        cnx.commit()
        cursor.close()
        cnx.close()
        return f"Success! Task created."
    except Exception as e: return f"Error: {str(e)}"

tools_list = [create_goal_tool, batch_create_tasks_tool, create_event_tool, create_task_tool]

# --- EXISTING ROUTES ---
@app.route('/', methods=['GET'])
def home(): return jsonify({"message": "Server Online"})

@app.route('/api/tables', methods=['GET'])
def get_table_list():
    try:
        cnx = mysql.connector.connect(**MYSQL_CONFIG)
        data = get_validated_tables(cnx)
        cnx.close()
        return jsonify(data)
    except Exception as e: return make_response(jsonify({"error": str(e)}), 500)

@app.route('/api/data/<table_name>', methods=['GET', 'POST'])
def handle_table_data(table_name):
    try:
        cnx_val = mysql.connector.connect(**MYSQL_CONFIG)
        all_tables = get_validated_tables(cnx_val)
        cnx_val.close()
    except Exception as e: return make_response(jsonify({"error": str(e)}), 500)

    if table_name not in all_tables: return make_response(jsonify({"error": "Invalid table"}), 400)

    if request.method == 'GET':
        try:
            cnx = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor(dictionary=True) 
            
            # ⭐️ NEW LOGIC: Check for 'created_at' column and sort ⭐️
            # 1. Check if column exists
            cursor.execute(f"SHOW COLUMNS FROM `{table_name}` LIKE 'created_at'")
            has_created_at = cursor.fetchone()
            
            # 2. Build query
            if has_created_at:
                query = f"SELECT * FROM `{table_name}` ORDER BY created_at DESC LIMIT 100"
            else:
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
        except Exception as e: return make_response(jsonify({"error": str(e)}), 400)

@app.route('/api/data/<table_name>/<item_id>', methods=['PUT', 'DELETE'])
def handle_item(table_name, item_id):
    if request.method == 'DELETE':
        try:
            cnx = mysql.connector.connect(**MYSQL_CONFIG)
            cursor = cnx.cursor()
            cursor.execute(f"DELETE FROM `{table_name}` WHERE id = %s", (item_id,))
            cnx.commit()
            cursor.close()
            cnx.close()
            return jsonify({"success": True})
        except Exception as e: return make_response(jsonify({"error": str(e)}), 400)

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
        except Exception as e: return make_response(jsonify({"error": str(e)}), 400)

# --- AI CHAT ---
chat_session = None

@app.route('/api/chat', methods=['POST'])
def chat_with_ai():
    global chat_session
    
    try:
        user_message = request.json.get('message', '')
        
        if chat_session is None:
            system_instruction = """
            You are an expert Personal Coach and Curriculum Designer.
            Current Date/Time: {CURRENT_TIME}.
            YOUR RULES:
            1. **No Summaries:** Do NOT create single "Week 1-4" tasks. User wants DETAILED schedule.
            2. **Granularity:** If user asks "4 times a week for 3 months", generate ~48 UNIQUE tasks.
            3. **Progression:** Don't repeat "Piano Practice". Be specific: "Session 1: Middle C", "Session 2: Scales".
            4. **Batching:** Generate full JSON list and send to `batch_create_tasks_tool`.
            PROCESS:
            1. Ask clarifying questions if needed.
            2. Design curriculum.
            3. Call `create_goal_tool`.
            4. Call `batch_create_tasks_tool` with full detailed list (JSON string).
            """
            model = genai.GenerativeModel('gemini-2.0-flash', tools=tools_list, system_instruction=system_instruction)
            chat_session = model.start_chat(enable_automatic_function_calling=True)

        today_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        day_name = datetime.now().strftime("%A")
        context_prompt = f"[SYSTEM: Current Time is {day_name}, {today_str}]\nUser: {user_message}"
        
        response = chat_session.send_message(context_prompt)
        
        if not response.parts: return jsonify({"response": "I've processed your request."})
        return jsonify({"response": response.text})

    except Exception as e:
        print(f"AI Error: {e}")
        return make_response(jsonify({"error": f"AI Error: {str(e)}"}), 500)

if __name__ == '__main__':
    print("--- Starting Flask server on http://127.0.0.1:5001 ---")
    app.run(debug=True, port=5001)