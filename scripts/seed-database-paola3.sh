#!/bin/bash

CSV_FILE="scripts/productos_completos3_20250626_012324.csv"
# CSV_FILE=$(ls -t $CSV_FILE | head -n 1) # Usar el más reciente

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
echo "Creando ubicación..."
LOCATION_RESPONSE=$(curl -s -X POST http://localhost:3000/locations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Paola",
    "address": "Calle Falsa 123",
    "phone": "3001234567"
  }')

echo "Respuesta de creación de ubicación: $LOCATION_RESPONSE"

LOCATION_ID=$(echo "$LOCATION_RESPONSE" | jq -r '.id')

if [ -z "$LOCATION_ID" ] || [ "$LOCATION_ID" == "null" ]; then
  echo "Error: no se pudo crear la ubicación"
  echo "Respuesta completa: $LOCATION_RESPONSE"
  exit 1
fi

echo "Location creada con ID: $LOCATION_ID"

# Actualizar el usuario con la ubicación creada
echo "Actualizando usuario con la ubicación..."

# Obtener el ID del usuario del token (decodificar el JWT)
USER_ID=$(echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub' 2>/dev/null)

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  echo "Error: no se pudo obtener el ID del usuario del token"
  # Intentar obtener el usuario por email
  USER_RESPONSE=$(curl -s -X GET "http://localhost:3000/users?email=paola@test.com" \
    -H "Authorization: Bearer $TOKEN")
  USER_ID=$(echo "$USER_RESPONSE" | jq -r '.[0].id' 2>/dev/null)
fi

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  echo "Error: no se pudo obtener el ID del usuario"
  echo "Continuando sin actualizar la ubicación del usuario..."
else
  echo "ID del usuario obtenido: $USER_ID"
  
  USER_UPDATE_RESPONSE=$(curl -s -X PATCH http://localhost:3000/users/$USER_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "locationId": "'$LOCATION_ID'"
    }')

  echo "Respuesta de actualización de usuario: $USER_UPDATE_RESPONSE"
fi

# Crear categorías usando Python
echo "Creando categorías..."
echo "Token: $TOKEN"
python3 -c "
import csv
import json
import subprocess

print('Iniciando creación de categorías...')

# Leer categorías únicas del CSV
categories = set()
with open('$CSV_FILE', 'r', encoding='utf-8') as file:
    reader = csv.DictReader(file)
    for row in reader:
        category_name = row['Categoría Nombre'].strip()
        if category_name:
            categories.add(category_name)

print(f'Categorías encontradas: {categories}')

# Crear cada categoría
category_ids = {}
categories_list = list(categories)
print(f'Lista de categorías: {categories_list}')

for i, category in enumerate(categories_list):
    print(f'Procesando categoría {i+1}/{len(categories_list)}: {category}')
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
        variant_groups_str = row['Grupos de Variantes'].strip() if row['Grupos de Variantes'] else ''
        variants_by_group_str = row['Variantes por Grupo'].strip() if row['Variantes por Grupo'] else ''
        
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
        
        # Procesar variantes si existen
        if variant_groups_str and variants_by_group_str:
            print(f'  Procesando variantes para: {name}')
            
            # Parsear grupos de variantes
            variant_groups = [g.strip() for g in variant_groups_str.split(';') if g.strip()]
            
            # Parsear variantes por grupo
            variants_by_group = {}
            for group_info in variants_by_group_str.split(';'):
                if ':' in group_info:
                    group_name, variants_str = group_info.split(':', 1)
                    group_name = group_name.strip()
                    variants = [v.strip() for v in variants_str.split('|') if v.strip()]
                    variants_by_group[group_name] = variants
            
            # Crear estructura de variantGroups
            product_data['variantGroups'] = []
            for group_idx, group_name in enumerate(variant_groups):
                if group_name in variants_by_group:
                    group_data = {
                        'name': group_name,
                        'order': group_idx,
                        'variants': []
                    }
                    
                    # Agregar variantes al grupo
                    variants = variants_by_group[group_name]
                    for variant_name in variants:
                        variant_data = {
                            'name': variant_name,
                            'price': None,
                            'image': '',
                            'isActive': True
                        }
                        group_data['variants'].append(variant_data)
                    
                    product_data['variantGroups'].append(group_data)
        
        # Crear el producto con variantes incluidas
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
                if 'variantGroups' in product_data:
                    variant_count = sum(len(group['variants']) for group in product_data['variantGroups'])
                    group_count = len(product_data['variantGroups'])
                    print(f'  Con {group_count} grupos y {variant_count} variantes')
            else:
                print(f'Error creando producto {name}: {response}')
        else:
            print(f'Error en curl para {name}: {result.stderr}')

# Limpiar archivo temporal
import os
os.remove('/tmp/category_ids.json')
"

# Crear 4 mesas
echo "Creando mesas..."

# Obtener un nuevo token para las mesas (por si expiró)
echo "Obteniendo nuevo token para mesas..."
NEW_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paola@test.com",
    "password": "12345678"
  }' | jq -r '.access_token')

if [ -z "$NEW_TOKEN" ] || [ "$NEW_TOKEN" == "null" ]; then
  echo "Error: no se pudo obtener el token para crear mesas"
  exit 1
fi

echo "Nuevo token obtenido para mesas"

for i in {1..4}; do
  TABLE_RESPONSE=$(curl -s -X POST http://localhost:3000/tables \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $NEW_TOKEN" \
    -d '{
      "number": '"$i"',
      "seats": 4,
      "locationId": "'$LOCATION_ID'"
    }')
  
  if echo "$TABLE_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    echo "Mesa $i creada exitosamente: $(echo "$TABLE_RESPONSE" | jq -r '.id')"
  else
    echo "Error creando mesa $i: $TABLE_RESPONSE"
  fi
done

echo "Importación completa desde el archivo $CSV_FILE" 