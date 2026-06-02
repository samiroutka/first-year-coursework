import importlib.util
import sys
from pathlib import Path


fastapi_dir = Path(__file__).resolve().parent / "fastapi"
app_path = fastapi_dir / "app.py"

sys.path.insert(0, str(fastapi_dir))

spec = importlib.util.spec_from_file_location("parking_api_app", app_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

app = module.app
