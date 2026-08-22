from flask import Flask, request, jsonify, send_from_directory, Response

print("SERVER STARTED")

import json
import os

app = Flask(__name__)

USERS_FILE = "users.json"


# -------------------------
# โหลดข้อมูลผู้ใช้
# -------------------------
def load_users():
    if not os.path.exists(USERS_FILE):
        return []

    with open(USERS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except:
            return []


# -------------------------
# บันทึกข้อมูลผู้ใช้
# -------------------------
def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=4)


# -------------------------
# เปิดหน้าเว็บ
# -------------------------
@app.route("/")
def home():
    return send_from_directory(".", "index.html")


@app.route("/<path:path>")
def static_file(path):
    return send_from_directory(".", path)


# -------------------------
# สมัครสมาชิก
# -------------------------
@app.route("/register", methods=["POST"])
def register():

    data = request.json

    users = load_users()

    for user in users:
        if user["email"] == data["email"]:
            return jsonify({
                "success": False,
                "message": "อีเมลนี้ถูกใช้งานแล้ว"
            })

    users.append(data)

    save_users(users)

    return jsonify({
        "success": True
    })


# -------------------------
# Login
# -------------------------
@app.route("/login", methods=["POST"])
def login():

    data = request.json

    users = load_users()

    for user in users:

        if (
            user["email"] == data["email"]
            and
            user["password"] == data["password"]
        ):

            return jsonify({
                "success": True,
                "user": user
            })

    return jsonify({
        "success": False,
        "message": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
    })

# -------------------------
# Run
# -------------------------

if __name__ == "__main__":
    print("SERVER STARTED")
    # host="0.0.0.0" ทำให้เครื่องอื่นในวงแลนเดียวกันเชื่อมต่อเข้ามาได้
    # (ของเดิม app.run(debug=True) ฟังแค่ 127.0.0.1 คือเข้าได้แค่เครื่องตัวเอง)
    app.run(
    host="0.0.0.0",
    port=5000,
    debug=False,
    use_reloader=False
)