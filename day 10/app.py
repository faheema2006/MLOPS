from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import os
from inference import YOLOInference

app = Flask(__name__)

UPLOAD_FOLDER = "inputs"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
MAX_CONTENT_LENGTH = 500 * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

try:
    inference = YOLOInference(
        model_path="yolov8n.pt",
        confidence=0.4
    )
    model_loaded = True
except Exception as e:
    print(f"Error loading model: {e}")
    model_loaded = False


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in ALLOWED_EXTENSIONS
    )


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/detect", methods=["POST"])
def detect():

    if not model_loaded:
        return render_template(
            "index.html",
            error="Model not loaded"
        )

    if "file" not in request.files:
        return render_template(
            "index.html",
            error="No file uploaded"
        )

    file = request.files["file"]

    if file.filename == "":
        return render_template(
            "index.html",
            error="No file selected"
        )

    if not allowed_file(file.filename):
        return render_template(
            "index.html",
            error="Invalid file type"
        )

    filename = secure_filename(file.filename)

    filepath = os.path.join(
        app.config["UPLOAD_FOLDER"],
        filename
    )

    file.save(filepath)

    try:
        result = inference.predict_image(
            filepath,
            save=True
        )

        return render_template(
            "index.html",
            result=result,
            uploaded_file=filename
        )

    except Exception as e:
        return render_template(
            "index.html",
            error=str(e)
        )


@app.route("/health")
def health():

    return jsonify(
        {
            "status": "healthy",
            "model_loaded": model_loaded,
            "service": "YOLO API"
        }
    )


@app.route("/info")
def info():

    if not model_loaded:
        return jsonify(
            {
                "error": "Model not loaded"
            }
        )

    return jsonify(
        {
            "model": "YOLOv8",
            "framework": "Ultralytics",
            "classes": inference.model.names
        }
    )


@app.errorhandler(404)
def not_found(error):

    return jsonify(
        {
            "error": "Endpoint not found"
        }
    ), 404


@app.errorhandler(413)
def too_large(error):

    return jsonify(
        {
            "error": "File too large"
        }
    ), 413


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )