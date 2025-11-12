import mysql.connector
import sys

# ⚠️ --- USE THE EXACT SAME CONFIG AS APP.PY --- ⚠️
MYSQL_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': 'Tom7845120!',  # <-- Make sure this matches app.py
    'database': 'calander_project_try1',
    'connection_timeout': 5
}
# ---------------------------------------------

print("--- Attempting to connect to MySQL ---")
print(f"Host: {MYSQL_CONFIG['host']}")
print(f"Port: {MYSQL_CONFIG['port']}")
print(f"User: {MYSQL_CONFIG['user']}")
print(f"Database: {MYSQL_CONFIG['database']}")

try:
    # 1. Try to connect
    cnx = mysql.connector.connect(**MYSQL_CONFIG)

    print("\n✅✅✅ SUCCESS: Connection established! ✅✅✅")

    # 2. Try to run a simple query
    cursor = cnx.cursor()
    query = f"SELECT table_name FROM information_schema.tables WHERE table_schema = '{MYSQL_CONFIG['database']}'"
    print(f"\nRunning query: {query}")
    cursor.execute(query)

    tables = [row[0] for row in cursor.fetchall()]

    print(f"\n✅ SUCCESS: Query ran successfully.")
    print(f"Tables found ({len(tables)}): {tables}")

    # 3. Clean up
    cursor.close()
    cnx.close()
    print("\nConnection closed.")

except Exception as e:
    print(f"\n❌❌❌ FAILURE: An error occurred ❌❌❌")
    print(f"Error details: {e}")
    sys.exit(1)  # Exit with an error code