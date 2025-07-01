#!/bin/bash

# Configuración
API_DOMAIN="localhost:3000" # Cambia a paola.localhost:3000 si tienes subdominio configurado
API_URL="http://$API_DOMAIN"

# 1. Crear el tenant Paola
TENANT_NAME="paola"
echo "Creando tenant..."
TENANT_RESPONSE=$(curl -s -X POST "$API_URL/tenants" \
  -H "Content-Type: application/json" \
  -d '{"name": "'$TENANT_NAME'"}')

TENANT_ID=$(echo "$TENANT_RESPONSE" | jq -r '.id')
if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" == "null" ]; then
  # Intentar obtener el tenant si ya existe
  TENANT_ID=$(curl -s "$API_URL/tenants?name=$TENANT_NAME" | jq -r '.[0].id')
fi
if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" == "null" ]; then
  echo "Error: no se pudo crear ni obtener el tenant Paola"
  exit 1
fi
echo "Tenant creado/obtenido: $TENANT_ID"

# 2. Registrar usuario (SUPER_ADMIN) bajo el tenant Paola
echo "Registrando usuario SUPER_ADMIN..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paola@test.com",
    "password": "12345678",
    "firstName": "Paola",
    "lastName": "User",
    "role": "SUPER_ADMIN"
  }')
echo "Respuesta registro usuario: $REGISTER_RESPONSE"

# 3. Login
echo "Logueando usuario..."
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paola@test.com",
    "password": "12345678"
  }' | jq -r '.access_token')
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "Error: no se pudo obtener el token"
  exit 1
fi
echo "Token obtenido: $TOKEN"

# 4. Crear ubicación
echo "Creando ubicación principal..."
LOCATION_RESPONSE=$(curl -s -X POST "$API_URL/locations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Paola",
    "address": "Calle Falsa 123",
    "phone": "3001234567"
  }')
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

# 6. Crear una categoría de ejemplo
echo "Creando categoría de ejemplo..."
CATEGORY_RESPONSE=$(curl -s -X POST "$API_URL/categories" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Bebidas",
    "locationId": "'$LOCATION_ID'"
  }')
CATEGORY_ID=$(echo "$CATEGORY_RESPONSE" | jq -r '.id')
echo "Categoría creada con ID: $CATEGORY_ID"

# 7. Crear un producto de ejemplo
echo "Creando producto de ejemplo..."
PRODUCT_RESPONSE=$(curl -s -X POST "$API_URL/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Coca Cola",
    "price": 3500,
    "categoryId": "'$CATEGORY_ID'",
    "locationId": "'$LOCATION_ID'"
  }')
PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | jq -r '.id')
echo "Producto creado con ID: $PRODUCT_ID"

# 8. Crear una mesa de ejemplo
echo "Creando mesa de ejemplo..."
TABLE_RESPONSE=$(curl -s -X POST "$API_URL/pos/tables" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Mesa 1",
    "locationId": "'$LOCATION_ID'"
  }')
TABLE_ID=$(echo "$TABLE_RESPONSE" | jq -r '.id')
echo "Mesa creada con ID: $TABLE_ID"

echo "Seed multitenant para Paola completado."