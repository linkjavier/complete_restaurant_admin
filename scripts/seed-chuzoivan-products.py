import requests
import json

# Configuración
BASE_URL = "http://chuzoivan.localhost:3000"
LOGIN_ENDPOINT = "/auth/login"
PRODUCTS_ENDPOINT = "/products"
EMAIL = "chuzoivan@test.com"
PASSWORD = "chuzoivan1234"
JSON_PATH = "../../scripts/chuzo_ivan.json"

# 1. Autenticación
login_resp = requests.post(
    BASE_URL + LOGIN_ENDPOINT,
    json={"email": EMAIL, "password": PASSWORD}
)
login_data = login_resp.json()
access_token = login_data.get("access_token")
if not access_token:
    print("Error autenticando:", login_resp.text)
    exit(1)
headers = {"Authorization": f"Bearer {access_token}", "Host": "chuzoivan.localhost:3000"}

# 2. Obtener ubicaciones
loc_resp = requests.get(BASE_URL + "/locations", headers=headers)
if loc_resp.status_code == 200:
    locations = loc_resp.json()
    if not locations:
        print("No hay ubicaciones disponibles. Crea una ubicación primero.")
        exit(1)
    print("\nUbicaciones disponibles:")
    for loc in locations:
        print(f"- {loc.get('name')} (id: {loc.get('id')})")
    location_id = locations[0].get('id')
    print(f"\nUsando locationId: {location_id}\n")
else:
    print("No se pudieron obtener las ubicaciones:", loc_resp.text)
    exit(1)

# 3. Leer productos del JSON
with open(JSON_PATH, encoding="utf-8") as f:
    data = json.load(f)

# 4. Crear categorías y mapear sus IDs
category_ids = {}
for categoria in data.keys():
    cat_payload = {"name": categoria.title(), "description": f"Categoría {categoria.title()}"}
    cat_resp = requests.post(BASE_URL + "/categories", json=cat_payload, headers=headers)
    if cat_resp.status_code in (200, 201):
        cat_id = cat_resp.json().get('id')
        category_ids[categoria] = cat_id
        print(f"✔ Categoría creada: {categoria.title()} (id: {cat_id})")
    else:
        print(f"✗ Error creando categoría {categoria.title()}: {cat_resp.status_code} {cat_resp.text}")
        exit(1)

# 5. Crear productos
for categoria, productos in data.items():
    if not isinstance(productos, dict):
        continue
    for nombre, prod in productos.items():
        if not isinstance(prod, dict):
            continue
        payload = {
            "name": nombre.replace("_", " ").title(),
            "categoryId": category_ids[categoria],
            "locationId": location_id,
            "price": prod.get("precio"),
            "description": prod.get("descripcion", ""),
            "isActive": True
        }
        if not payload["price"]:
            continue
        resp = requests.post(BASE_URL + PRODUCTS_ENDPOINT, json=payload, headers=headers)
        if resp.status_code in (200, 201):
            print(f"✔ Producto creado: {payload['name']} ({categoria})")
        else:
            print(f"✗ Error creando {payload['name']}: {resp.status_code} {resp.text}") 