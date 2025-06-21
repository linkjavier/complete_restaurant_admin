#!/bin/bash

CSV_FILE="scripts/productos_completos_20250621_013513.csv"

# Crear usuario si no existe y obtener token
echo "Registrando usuario..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paola@test.com",
    "password": "12345678",
    "firstName": "Paola",
    "lastName": "User",
    "role": "SUPER_ADMIN"
  }')

# Intentar login
echo "Iniciando sesión..."
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paola@test.com",
    "password": "12345678"
  }' | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "Error: no se pudo obtener el token"
  echo "Respuesta de registro: $REGISTER_RESPONSE"
  exit 1
fi

echo "Token obtenido: $TOKEN"

# Crear ubicación
LOCATION_ID=$(curl -s -X POST http://localhost:3000/locations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Paola",
    "address": "Calle Falsa 123",
    "phone": "3001234567"
  }' | jq -r '.id')

if [ -z "$LOCATION_ID" ] || [ "$LOCATION_ID" == "null" ]; then
  echo "Error: no se pudo crear la ubicación"
  exit 1
fi

echo "Location creada con ID: $LOCATION_ID"

# Crear categorías usando Python
echo "Creando categorías..."
python3 -c "
import csv
import json
import subprocess

# Leer categorías únicas del CSV
categories = set()
with open('$CSV_FILE', 'r', encoding='utf-8') as file:
    reader = csv.DictReader(file)
    for row in reader:
        category_name = row['Categoría Nombre'].strip()
        if category_name:
            categories.add(category_name)

# Crear cada categoría
category_ids = {}
for category in categories:
    print(f'Creando categoría: {category}')
    
    category_data = {
        'name': category,
        'description': f'Categoría autoimportada: {category}'
    }
    
    curl_cmd = [
        'curl', '-s', '-X', 'POST', 'http://localhost:3000/categories',
        '-H', 'Content-Type: application/json',
        '-H', f'Authorization: Bearer $TOKEN',
        '-d', json.dumps(category_data)
    ]
    
    result = subprocess.run(curl_cmd, capture_output=True, text=True)
    if result.returncode == 0:
        response = json.loads(result.stdout)
        if 'id' in response:
            category_ids[category] = response['id']
            print(f'  Categoría creada con ID: {response[\"id\"]}')
        else:
            print(f'  Error creando categoría: {response}')
    else:
        print(f'  Error en curl: {result.stderr}')

# Guardar los IDs de categorías en un archivo temporal
with open('/tmp/category_ids.json', 'w') as f:
    json.dump(category_ids, f)

print(f'Categorías creadas: {len(category_ids)}')
"

# Crear productos usando Python
echo "Creando productos..."
python3 -c "
import csv
import json
import subprocess

# Cargar IDs de categorías
with open('/tmp/category_ids.json', 'r') as f:
    category_ids = json.load(f)

# Leer productos del CSV
with open('$CSV_FILE', 'r', encoding='utf-8') as file:
    reader = csv.DictReader(file)
    for row in reader:
        name = row['Nombre'].strip()
        description = row['Descripción'].strip() if row['Descripción'] else ''
        price = int(row['Precio']) if row['Precio'] else 0
        image = row['Imagen'].strip() if row['Imagen'] else None
        category_name = row['Categoría Nombre'].strip()
        
        # Obtener el ID de la categoría
        category_id = category_ids.get(category_name)
        if not category_id:
            print(f'Error: No se encontró categoría para {name}')
            continue
        
        # Preparar datos del producto
        product_data = {
            'name': name,
            'description': description,
            'price': price,
            'categoryId': category_id,
            'locationId': '$LOCATION_ID',
            'isActive': True
        }
        
        if image and image != 'null':
            product_data['image'] = image
        
        # Crear el producto
        curl_cmd = [
            'curl', '-s', '-X', 'POST', 'http://localhost:3000/products',
            '-H', 'Content-Type: application/json',
            '-H', f'Authorization: Bearer $TOKEN',
            '-d', json.dumps(product_data)
        ]
        
        result = subprocess.run(curl_cmd, capture_output=True, text=True)
        if result.returncode == 0:
            response = json.loads(result.stdout)
            if 'id' in response:
                print(f'Producto creado: {name}')
            else:
                print(f'Error creando producto {name}: {response}')
        else:
            print(f'Error en curl para {name}: {result.stderr}')

# Limpiar archivo temporal
import os
os.remove('/tmp/category_ids.json')
"

echo "Importación completa desde el archivo $CSV_FILE"
