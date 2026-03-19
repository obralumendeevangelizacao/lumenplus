import psycopg2

# Coloque o ID do usuário que você quer dar permissão
USER_ID = "8eddb0be-5591-41e2-9333-4dce3c62eeaa"

conn = psycopg2.connect(
    host="127.0.0.1", port=5432, user="postgres", password="NQL076700a@", dbname="lumenplus"
)
conn.autocommit = True
cur = conn.cursor()

# Buscar usuários
cur.execute("SELECT id, created_at FROM users")
users = cur.fetchall()
print("Usuários encontrados:")
for u in users:
    print(f"  ID: {u[0]} | Criado em: {u[1]}")

# Se quiser dar permissão, descomente abaixo e coloque o ID correto:
cur.execute(
    "INSERT INTO user_permissions (user_id, permission_code) VALUES (%s, 'CAN_SEND_INBOX')",
    (USER_ID,),
)
print("Permissão concedida!")

conn.close()
