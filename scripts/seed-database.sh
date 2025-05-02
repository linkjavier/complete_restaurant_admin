#!/bin/bash

# Crear un usuario de prueba
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "12345678",
    "firstName": "Test",
    "lastName": "User",
    "role": "ADMIN"
  }'

# Iniciar sesión con el usuario de prueba y guardar el token en una variable
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "12345678"
  }' | jq -r '.access_token')

# Verificar si obtuvimos el token
if [ -z "$TOKEN" ]; then
    echo "Error: No se pudo obtener el token de autenticación"
    exit 1
fi

echo "Token obtenido exitosamente"

# Crear una ubicación llamada "Principal" y guardar su ID
LOCATION_RESPONSE=$(curl -X POST http://localhost:3000/locations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Principal"
  }')

LOCATION_ID=$(echo $LOCATION_RESPONSE | jq -r '.id')

# Verificar si obtuvimos el ID de la ubicación
if [ -z "$LOCATION_ID" ] || [ "$LOCATION_ID" = "null" ]; then
    echo "Error: No se pudo obtener el ID de la ubicación"
    echo "Respuesta del servidor: $LOCATION_RESPONSE"
    exit 1
fi

echo "Location ID obtenido: $LOCATION_ID"

# Guardar IDs de las categorías
ALMUERZOS_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Almuerzos",
    "description": "Deliciosos platos principales y especialidades del día"
  }' | jq -r '.id')

PANADERIA_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Panaderia",
    "description": "Pan fresco y productos horneados artesanalmente"
  }' | jq -r '.id')

DESAYUNOS_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Desayunos",
    "description": "Opciones nutritivas para comenzar el día"
  }' | jq -r '.id')

BEBIDAS_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Bebidas",
    "description": "Refrescantes bebidas frías y calientes"
  }' | jq -r '.id')

# Crear productos de Almuerzos
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pollo a la Parrilla",
    "description": "Pechuga de pollo marinada a la parrilla con guarnición",
    "price": 15000,
    "categoryId": "'$ALMUERZOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Lomo de Res",
    "description": "Lomo de res con salsa de champiñones",
    "price": 18000,
    "categoryId": "'$ALMUERZOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pescado Frito",
    "description": "Filete de pescado fresco frito con patacones",
    "price": 16000,
    "categoryId": "'$ALMUERZOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pasta Alfredo",
    "description": "Pasta en salsa cremosa con pollo",
    "price": 14000,
    "categoryId": "'$ALMUERZOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Arroz con Camarones",
    "description": "Arroz salteado con camarones y vegetales",
    "price": 17000,
    "categoryId": "'$ALMUERZOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

# Crear productos de Panadería
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Croissant",
    "description": "Croissant de mantequilla recién horneado",
    "price": 3500,
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pan Baguette",
    "description": "Pan baguette tradicional",
    "price": 4000,
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pan de Chocolate",
    "description": "Pan dulce relleno de chocolate",
    "price": 3800,
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Almojábana",
    "description": "Pan de queso tradicional colombiano",
    "price": 2500,
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pan Integral",
    "description": "Pan integral con semillas",
    "price": 4500,
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

# Crear productos de Desayunos
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Huevos Revueltos",
    "description": "Huevos revueltos con tostadas y café",
    "price": 8000,
    "categoryId": "'$DESAYUNOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Calentado",
    "description": "Calentado tradicional con huevo y arepa",
    "price": 12000,
    "categoryId": "'$DESAYUNOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pancakes",
    "description": "Torre de pancakes con sirope de maple",
    "price": 9000,
    "categoryId": "'$DESAYUNOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Cereal con Frutas",
    "description": "Cereal con yogurt y frutas frescas",
    "price": 7500,
    "categoryId": "'$DESAYUNOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Sandwich Desayuno",
    "description": "Sandwich con huevo, queso y jamón",
    "price": 8500,
    "categoryId": "'$DESAYUNOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

# Crear productos de Bebidas
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Café Americano",
    "description": "Café negro recién preparado",
    "price": 3000,
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Jugo Natural",
    "description": "Jugo de frutas naturales",
    "price": 4500,
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Limonada",
    "description": "Limonada natural con hierbabuena",
    "price": 4000,
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Cappuccino",
    "description": "Café espresso con leche espumada",
    "price": 5000,
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Chocolate Caliente",
    "description": "Chocolate caliente con queso y pan",
    "price": 5500,
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

echo "Creando mesas..."

# Crear Mesa 1
MESA_RESPONSE=$(curl -X POST http://localhost:3000/tables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "number": 1,
    "seats": 4,
    "locationId": "'$LOCATION_ID'"
  }')

echo "Respuesta Mesa 1: $MESA_RESPONSE"

# Crear Mesa 2
MESA_RESPONSE=$(curl -X POST http://localhost:3000/tables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "number": 2,
    "seats": 4,
    "locationId": "'$LOCATION_ID'"
  }')

echo "Respuesta Mesa 2: $MESA_RESPONSE"

# Crear Mesa 3
MESA_RESPONSE=$(curl -X POST http://localhost:3000/tables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "number": 3,
    "seats": 4,
    "locationId": "'$LOCATION_ID'"
  }')

echo "Respuesta Mesa 3: $MESA_RESPONSE"

# Crear Mesa 4
MESA_RESPONSE=$(curl -X POST http://localhost:3000/tables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "number": 4,
    "seats": 4,
    "locationId": "'$LOCATION_ID'"
  }')

echo "Respuesta Mesa 4: $MESA_RESPONSE"

echo "Script completado"  