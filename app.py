import os
import json
import uuid
from functools import wraps
from datetime import datetime

from flask import Flask, request, jsonify, session, render_template, send_from_directory
from dotenv import load_dotenv

from utils.pdf_extractor import extract_pdf_text
from utils.ai_extractor import extract_contract_data
from utils.chargebee_client import ChargebeeClient

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

AUTH_PIN = os.getenv("APP_AUTH_PIN", "12345")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "storage", "uploads")
EXTRACT_DIR = os.path.join(os.path.dirname(__file__), "storage", "extracted")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXTRACT_DIR, exist_ok=True)

# Initialize Chargebee client
cb_client = ChargebeeClient(
    site=os.getenv("CHARGEBEE_SITE"),
    api_key=os.getenv("CHARGEBEE_API_KEY"),
    enabled=os.getenv("CHARGEBEE_ENABLED", "1") == "1"
)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("authenticated"):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


@app.route("/")
def index():
    return render_template("dashboard.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/upload")
def upload():
    return render_template("upload.html")

@app.route("/contracts")
def contracts():
    return render_template("contracts.html")

@app.route("/settings")
def settings():
    return render_template("settings.html")


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    pin = str(data.get("pin", ""))

    if pin != AUTH_PIN:
        return jsonify({"success": False, "error": "Invalid PIN"}), 403

    session["authenticated"] = True
    return jsonify({"success": True})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})


@app.route("/api/auth/session", methods=["GET"])
def get_session():
    return jsonify({"authenticated": session.get("authenticated", False)})


@app.route("/api/contracts/upload", methods=["POST"])
@login_required
def upload_contract():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    contract_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()

    # Save uploaded file
    filename = f"{contract_id}.pdf"
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    try:
        # Extract text from PDF
        pdf_text = extract_pdf_text(filepath)

        # Extract structured data using AI
        extracted_data = extract_contract_data(
            pdf_text,
            os.getenv("GOOGLE_API_KEY"),
            os.getenv("GEMINI_MODEL", "gemini-2.0-flash-preview-02-05")
        )

        # Save extraction result
        result = {
            "contract_id": contract_id,
            "filename": file.filename,
            "timestamp": timestamp,
            "status": "extracted",
            "extracted": extracted_data,
            "raw_text": pdf_text[:5000]  # Store first 5000 chars
        }

        result_path = os.path.join(EXTRACT_DIR, f"{contract_id}.json")
        with open(result_path, "w") as f:
            json.dump(result, f, indent=2)

        return jsonify({
            "success": True,
            "contract_id": contract_id,
            "filename": file.filename,
            "timestamp": timestamp,
            "extracted": extracted_data
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/contracts/confirm", methods=["POST"])
@login_required
def confirm_contract():
    data = request.get_json() or {}
    contract_id = data.get("contract_id")
    extracted = data.get("extracted")

    if not contract_id or not extracted:
        return jsonify({"error": "Missing contract_id or extracted data"}), 400

    try:
        # Save reviewed data
        result_path = os.path.join(EXTRACT_DIR, f"{contract_id}.json")

        if os.path.exists(result_path):
            with open(result_path, "r") as f:
                result = json.load(f)

            result["extracted"] = extracted
            result["status"] = "confirmed"
            result["confirmed_at"] = datetime.now().isoformat()

            with open(result_path, "w") as f:
                json.dump(result, f, indent=2)

        # Create in Chargebee
        if cb_client.enabled:
            chargebee_result = cb_client.create_subscription(extracted)
            return jsonify({
                "success": True,
                "chargebee": chargebee_result
            })
        else:
            return jsonify({
                "success": True,
                "chargebee": {"skipped": True, "reason": "Chargebee disabled"}
            })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/contracts/history", methods=["GET"])
@login_required
def get_history():
    try:
        contracts = []

        for filename in sorted(os.listdir(EXTRACT_DIR), reverse=True):
            if filename.endswith(".json"):
                filepath = os.path.join(EXTRACT_DIR, filename)
                with open(filepath, "r") as f:
                    data = json.load(f)
                    contracts.append({
                        "contract_id": data.get("contract_id"),
                        "filename": data.get("filename"),
                        "timestamp": data.get("timestamp"),
                        "status": data.get("status"),
                    })

        return jsonify({"contracts": contracts})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/contracts/<contract_id>", methods=["GET"])
@login_required
def get_contract(contract_id):
    try:
        filepath = os.path.join(EXTRACT_DIR, f"{contract_id}.json")

        if not os.path.exists(filepath):
            return jsonify({"error": "Contract not found"}), 404

        with open(filepath, "r") as f:
            data = json.load(f)

        return jsonify(data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/contracts/delete", methods=["DELETE"])
@login_required
def delete_all_contracts():
    try:
        # Delete all files from uploads directory
        if os.path.exists(UPLOAD_DIR):
            for filename in os.listdir(UPLOAD_DIR):
                filepath = os.path.join(UPLOAD_DIR, filename)
                if os.path.isfile(filepath):
                    os.remove(filepath)

        # Delete all files from extracted directory
        if os.path.exists(EXTRACT_DIR):
            for filename in os.listdir(EXTRACT_DIR):
                filepath = os.path.join(EXTRACT_DIR, filename)
                if os.path.isfile(filepath):
                    os.remove(filepath)

        return jsonify({
            "success": True,
            "message": "All files deleted successfully"
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "message": "Error deleting files"
        }), 500


@app.route("/health")

def health():
    return jsonify({"status": "healthy"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
