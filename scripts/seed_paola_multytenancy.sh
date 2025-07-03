#!/bin/bash

# Configuración inicial para crear el tenant y usuario
API_DOMAIN_ROOT="localhost:3000" # Backend directo para registro (sin subdominio)
API_DOMAIN_SUB="paola.localhost:3000" # Subdominio para el resto
API_URL_ROOT="http://$API_DOMAIN_ROOT"
API_URL_SUB="http://$API_DOMAIN_SUB"
PRODUCTS_CSV="$(dirname "$0")/productos_completos3_20250703_060323.csv"

# 1. Registrar usuario (SUPER_ADMIN) y crear tenant automáticamente
TENANT_NAME="paola"
USER_EMAIL="paola@test.com"
USER_PASSWORD="12345678"
USER_FIRSTNAME="Paola"
USER_LASTNAME="User"
USER_ROLE="SUPER_ADMIN"

echo "Registrando usuario y creando tenant..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL_ROOT/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "'$TENANT_NAME'",
    "email": "'$USER_EMAIL'",
    "password": "'$USER_PASSWORD'",
    "firstName": "'$USER_FIRSTNAME'",
    "lastName": "'$USER_LASTNAME'",
    "role": "'$USER_ROLE'"
  }')
echo "Respuesta registro: $REGISTER_RESPONSE"

# 2. Login en el subdominio para obtener token
API_URL="$API_URL_SUB"
echo "Logueando usuario en subdominio..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$USER_EMAIL'",
    "password": "'$USER_PASSWORD'"
  }')
echo "Respuesta login: $LOGIN_RESPONSE"
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
# Extraer tenantId del payload del JWT (base64url seguro)
# 1. Obtener el payload (segunda parte del token)
PAYLOAD=$(echo "$TOKEN" | cut -d'.' -f2)
# 2. Convertir base64url a base64 estándar y rellenar con =
PAYLOAD_B64=$(echo "$PAYLOAD" | tr '_-' '/+'; printf '%0.s=' $(seq 1 $(( (4 - ${#PAYLOAD} % 4) % 4 )) ))
# 3. Decodificar y extraer tenantId
TENANT_ID=$(echo "$PAYLOAD_B64" | base64 -d 2>/dev/null | jq -r '.tenantId')
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "Error: no se pudo obtener el token del login"
  exit 1
fi
if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" == "null" ]; then
  echo "Error: no se pudo obtener el tenantId del token"
  exit 1
fi
echo "Token obtenido: $TOKEN"
echo "Tenant obtenido: $TENANT_ID"

# 3. Crear ubicación
echo "Creando ubicación principal..."
LOCATION_RESPONSE=$(curl -s -X POST "$API_URL/locations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Paola",
    "address": "Calle Falsa 123",
    "phone": "3001234567"
  }')
echo "Respuesta creación ubicación: $LOCATION_RESPONSE"
LOCATION_ID=$(echo "$LOCATION_RESPONSE" | jq -r '.id')
if [ -z "$LOCATION_ID" ] || [ "$LOCATION_ID" == "null" ]; then
  echo "Error: no se pudo crear la ubicación"
  exit 1
fi
echo "Location creada con ID: $LOCATION_ID"

# 5. Actualizar usuario con la ubicación creada
USER_ID=$(echo "$TOKEN" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sub' 2>/dev/null)
if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
  USER_UPDATE_RESPONSE=$(curl -s -X PATCH "$API_URL/users/$USER_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"locationId": "'$LOCATION_ID'"}')
  echo "Respuesta de actualización de usuario: $USER_UPDATE_RESPONSE"
fi

# 7. Crear todas las categorías únicas del CSV
CATEGORIES_JSON="/tmp/paola_categories.json"
PRODUCTS_JSON="/tmp/paola_products.json"

# Extraer categorías únicas (ignorando vacíos y basura)
/Library/Frameworks/Python.framework/Versions/3.11/bin/csvcut -c "Categoría Nombre" "$PRODUCTS_CSV" | tail -n +2 | grep -v '^""$' | grep -v '^$' | sort | uniq > /tmp/paola_categories.txt

# Crear categorías y guardar el mapa nombre->ID
> "$CATEGORIES_JSON"
echo "{}" > "$CATEGORIES_JSON"
CATEGORY_COUNT=0
while read -r category_name; do
  # Limpiar comillas
  clean_name=$(echo "$category_name" | sed 's/^"//;s/"$//')
  if [ -z "$clean_name" ]; then continue; fi
  # Buscar si la categoría ya existe
  EXISTING_ID=$(curl -s -G "$API_URL/categories" \
    --data-urlencode "name=$clean_name" \
    --data-urlencode "locationId=$LOCATION_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id // empty')
  if [ -n "$EXISTING_ID" ]; then
    jq --arg name "$clean_name" --arg id "$EXISTING_ID" '. + {($name): $id}' "$CATEGORIES_JSON" > "$CATEGORIES_JSON.tmp" && mv "$CATEGORIES_JSON.tmp" "$CATEGORIES_JSON"
    echo "Categoría ya existente: $clean_name (ID: $EXISTING_ID)"
    continue
  fi
  # Crear categoría usando jq para escapar correctamente
  CATEGORY_PAYLOAD=$(jq -n --arg name "$clean_name" --arg loc "$LOCATION_ID" '{name: $name, locationId: $loc}')
  RESPONSE=$(curl -s -X POST "$API_URL/categories" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$CATEGORY_PAYLOAD")
  CATEGORY_ID=$(echo "$RESPONSE" | jq -r '.id')
  if [ -n "$CATEGORY_ID" ] && [ "$CATEGORY_ID" != "null" ]; then
    CATEGORY_COUNT=$((CATEGORY_COUNT+1))
    jq --arg name "$clean_name" --arg id "$CATEGORY_ID" '. + {($name): $id}' "$CATEGORIES_JSON" > "$CATEGORIES_JSON.tmp" && mv "$CATEGORIES_JSON.tmp" "$CATEGORIES_JSON"
    echo "Categoría creada: $clean_name (ID: $CATEGORY_ID)"
  else
    echo "Error creando categoría: $clean_name. Respuesta: $RESPONSE" >&2
  fi
done < /tmp/paola_categories.txt
echo "Total de categorías creadas: $CATEGORY_COUNT"

# 8. Importar productos usando csvjson para parseo robusto
csvjson "$PRODUCTS_CSV" > "$PRODUCTS_JSON"
PRODUCTS_CREATED_FILE="/tmp/paola_products_created.txt"
PRODUCTS_FAILED_FILE="/tmp/paola_products_failed.txt"
> "$PRODUCTS_CREATED_FILE"
> "$PRODUCTS_FAILED_FILE"
jq -c '.[]' "$PRODUCTS_JSON" | while read -r product; do
  name=$(echo "$product" | jq -r '.Nombre')
  price=$(echo "$product" | jq -r '.Precio')
  description=$(echo "$product" | jq -r '."Descripción"')
  imageUrl=$(echo "$product" | jq -r '.Imagen')
  categoryName=$(echo "$product" | jq -r '."Categoría Nombre"')
  # Buscar categoryId en el mapa
  categoryId=$(jq -r --arg name "$categoryName" '.[$name]' "$CATEGORIES_JSON")
  if [ -z "$categoryId" ] || [ "$categoryId" == "null" ]; then
    echo "Producto $name sin categoría válida ($categoryName), se omite." >&2
    echo "$name" >> "$PRODUCTS_FAILED_FILE"
    continue
  fi
  # Validar que el precio sea numérico
  if ! [[ "$price" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    price=0
  fi
  # Construir el payload dinámicamente
  if [ -n "$imageUrl" ] && [ "$imageUrl" != "null" ]; then
    PRODUCT_PAYLOAD=$(jq -n --arg name "$name" --arg price "$price" --arg desc "$description" --arg cat "$categoryId" --arg loc "$LOCATION_ID" --arg img "$imageUrl" '{name: $name, price: ($price|tonumber), description: $desc, categoryId: $cat, locationId: $loc, image: $img}')
  else
    PRODUCT_PAYLOAD=$(jq -n --arg name "$name" --arg price "$price" --arg desc "$description" --arg cat "$categoryId" --arg loc "$LOCATION_ID" '{name: $name, price: ($price|tonumber), description: $desc, categoryId: $cat, locationId: $loc}')
  fi
  RESPONSE=$(curl -s -X POST "$API_URL/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$PRODUCT_PAYLOAD")
  PRODUCT_ID=$(echo "$RESPONSE" | jq -r '.id')
  if [ -n "$PRODUCT_ID" ] && [ "$PRODUCT_ID" != "null" ]; then
    echo "Producto creado: $name (ID: $PRODUCT_ID)"
    echo "$name" >> "$PRODUCTS_CREATED_FILE"
  else
    echo "Error creando producto: $name. Respuesta: $RESPONSE" >&2
    echo "$name" >> "$PRODUCTS_FAILED_FILE"
  fi
done
PRODUCTS_CREATED=$(wc -l < "$PRODUCTS_CREATED_FILE")
PRODUCTS_FAILED=$(wc -l < "$PRODUCTS_FAILED_FILE")
echo "Importación de productos finalizada. Exitosos: $PRODUCTS_CREATED, Fallidos: $PRODUCTS_FAILED"

# 9. Crear una mesa de ejemplo
echo "Creando mesa de ejemplo..."
TABLE_RESPONSE=$(curl -s -X POST "$API_URL/tables" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "number": 1,
    "seats": 4,
    "locationId": "'$LOCATION_ID'"
  }')
TABLE_ID=$(echo "$TABLE_RESPONSE" | jq -r '.id')
echo "Mesa creada con ID: $TABLE_ID"

echo "Seed multitenant para Paola completado."