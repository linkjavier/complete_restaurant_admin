#!/bin/bash

# Crear un usuario de prueba
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paola@test.com",
    "password": "12345678",
    "firstName": "Paola",
    "lastName": "User",
    "role": "SUPER_ADMIN"
  }'

# Iniciar sesión con el usuario de prueba y guardar el token en una variable
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "paola@test.com",
    "password": "12345678"
  }' | jq -r '.access_token')

# Verificar si obtuvimos el token
if [ -z "$TOKEN" ]; then
    echo "Error: No se pudo obtener el token de autenticación"
    exit 1
fi

echo "Token obtenido exitosamente"

# Crear una ubicación llamada "Paola" y guardar su ID
LOCATION_RESPONSE=$(curl -X POST http://localhost:3000/locations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Paola"
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
DESAYUNOS_ESPECIALES_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Desayunos Especiales",
    "description": "Desayunos especiales con ingredientes premium"
  }' | jq -r '.id')

CALENTADOS_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Calentados",
    "description": "Calentados tradicionales colombianos"
  }' | jq -r '.id')

OMELETTES_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Omelettes",
    "description": "Omelettes variados y deliciosos"
  }' | jq -r '.id')

DESAYUNOS_BASICOS_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Desayunos",
    "description": "Desayunos tradicionales"
  }' | jq -r '.id')

PANADERIA_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Panaderia",
    "description": "Productos de panadería frescos"
  }' | jq -r '.id')

BEBIDAS_ID=$(curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Bebidas",
    "description": "Bebidas calientes y frías"
  }' | jq -r '.id')

# Crear productos de Desayunos Especiales
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Cacerola con todo",
    "description": "Huevos con jamón, maíz tierno, pollo, tocineta, maduro, salchicha, champiñones y queso mozzarella.",
    "price": 19700,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750307441/restaurant/usp6baqltapovxlgszyv.jpg",
    "categoryId": "'$DESAYUNOS_ESPECIALES_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Napoliqueso",
    "description": "Huevos con jamón, rodajas de tomate, cebolla, pimentón, y salsa de queso.",
    "price": 15200,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750307677/restaurant/v9nr332wpighzkfxr76t.png",
    "categoryId": "'$DESAYUNOS_ESPECIALES_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Huevos Nidando",
    "description": "Huevos con papas a la francesa, salchicha y queso parmesano.",
    "price": 16200,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750307711/restaurant/ikjd14tb87eowhjow3o2.jpg",
    "categoryId": "'$DESAYUNOS_ESPECIALES_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

# Crear productos de Calentados
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Calentado Berraco",
    "description": "Arroz, maduro, frijoles, carne, chicharrón, arepa frita, huevo y bebida caliente (Café negro o en leche) o bebida fría (Jugo del día).",
    "price": 19200,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750308310/restaurant/sxdsayg2add3ttpmin4x.webp",
    "categoryId": "'$CALENTADOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Calentado Calidoso",
    "description": "Arroz, carne, arepa frita, papa, huevo y bebida caliente (Café negro o en leche) o bebida fría (Jugo del día).",
    "price": 19200,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750308331/restaurant/nv0dzovxnztjb7k6q7qv.png",
    "categoryId": "'$CALENTADOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Calentado Paisa",
    "description": "Arroz, frijoles, arepa frita, chicharrón, aguacate, huevo y bebida caliente (Café negro o en leche) o bebida fría (Jugo del día).",
    "price": 19200,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750308346/restaurant/g74qmbigzgrx4ygzbaeq.png",
    "categoryId": "'$CALENTADOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Calentado de Carne",
    "description": "Carne asada o en bistec, arroz, frijoles, arepa frita, guiso.",
    "price": 16200,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750308368/restaurant/xe9jbml1byeichkkrod6.jpg",
    "categoryId": "'$CALENTADOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Calentado Huevos",
    "description": "Arroz, frijoles, huevos (en cacerola, pericos o revueltos), arepa frita, guiso.",
    "price": 13700,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750308420/restaurant/vpbaltvlaikdn7ynac4g.png",
    "categoryId": "'$CALENTADOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

# Crear productos de Omelettes
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Omelette Promo 2x1",
    "description": "Huevos con jamón y queso o pollo con maicitos. (No incluye bebida) (Promoción aplica de lunes a viernes)",
    "price": 18900,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750308463/restaurant/okg37f1zuzx39mexlnxi.jpg",
    "categoryId": "'$OMELETTES_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Omelette Samba",
    "description": "Huevos con maíz, maduro y tocineta.",
    "price": 16400,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750312428/restaurant/uxa6yg9kpnhwq7saxbgn.png",
    "categoryId": "'$OMELETTES_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Omelette Vegetariano",
    "description": "Huevos con espinaca, brócoli, habichuela, pimentón, zanahoria, champiñones, arveja y queso.",
    "price": 13900,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750312533/restaurant/io4eobsoc52ztdivx9en.png",
    "categoryId": "'$OMELETTES_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Omelette Ibérico",
    "description": "Huevos con papas al vapor, cebollín, pimentón, cebolla, aderezo y chorizo riojano.",
    "price": 13900,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750312636/restaurant/lftp32x6rhqmpxmvlkqf.png",
    "categoryId": "'$OMELETTES_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Omelette Paola",
    "description": "Huevos con carne desmechada, jamón, champiñones, espinaca, maíz tierno, cebolla y tocineta.",
    "price": 16400,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750312676/restaurant/ybvoj0im3z1ln6rjkopb.jpg",
    "categoryId": "'$OMELETTES_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Omelette Hawaiano",
    "description": "Huevos con jamón, queso y piña.",
    "price": 13900,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750312926/restaurant/rqmuxyd0fcuby1hhopkz.jpg",
    "categoryId": "'$OMELETTES_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

# Crear productos de Desayunos
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Desayuno Jamón",
    "description": "Huevos revueltos con jamón, arroz, pan y bebida caliente (Café negro o en leche) o bebida fría (Jugo del día).",
    "price": 12200,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750316648/restaurant/uz35gt1xnpiqstm7dube.png",
    "categoryId": "'$DESAYUNOS_BASICOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Desayuno Ranchero",
    "description": "Huevos revueltos con salchicha ranchera, arroz, pan y bebida caliente (Café negro o en leche) o bebida fría (Jugo del día).",
    "price": 13200,
    "image": null,
    "categoryId": "'$DESAYUNOS_BASICOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Desayuno Revuelto",
    "description": "Huevos revueltos, arroz, pan y bebida caliente (Café negro o en leche) o bebida fría (Jugo del día).",
    "price": 11800,
    "image": null,
    "categoryId": "'$DESAYUNOS_BASICOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Desayuno Pericos",
    "description": "Huevos pericos, arroz, pan y bebida caliente (Café negro o en leche) o bebida fría (Jugo del día).",
    "price": 12700,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750313390/restaurant/fv97af3dlo64ittrqb7l.png",
    "categoryId": "'$DESAYUNOS_BASICOS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

# Crear productos de Panadería
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pandebono",
    "description": "Pandebono tradicional colombiano",
    "price": 2500,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750313121/restaurant/oy8parz8qpcnnlir9ayi.png",
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Buñuelo",
    "description": "Buñuelo de yuca tradicional",
    "price": 2500,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750313142/restaurant/dc63lq1b3jsenfudjlq1.png",
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Almojábana",
    "description": "Almojábana de queso tradicional",
    "price": 3400,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750316988/restaurant/g4f3fubzqsjp6prsrorb.webp",
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Arepa de Horno",
    "description": "Arepa de horno tradicional",
    "price": 2500,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750313424/restaurant/deqj0qw5elxspy05fh4j.jpg",
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Esponjado",
    "description": "Esponjado de queso",
    "price": 4100,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750315354/restaurant/anlpwqpfhyzujyssalgx.png",
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pan Queso",
    "description": "Pan de queso tradicional",
    "price": 2300,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750316263/restaurant/u9yiutlezcjhm4agmhae.jpg",
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pastel Hawaiano",
    "description": "Pastel con piña y jamón",
    "price": 4600,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750313483/restaurant/pkrq559jitzq19gwbfcp.jpg",
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Pastel de Pollo",
    "description": "Pastel relleno de pollo",
    "price": 5600,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750316002/restaurant/pgogpz3yytfuswkucmg1.jpg",
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Chicharrón Dulce",
    "description": "Chicharrón dulce tradicional",
    "price": 2900,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750315162/restaurant/kjyhzrtmk2fv5nzcr7vc.jpg",
    "categoryId": "'$PANADERIA_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

# Crear productos de Bebidas
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Avena casera",
    "description": "Avena casera tradicional",
    "price": 6700,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750314945/restaurant/qerm2p3vmocuzzsnce7j.png",
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Café con leche",
    "description": "Café con leche tradicional",
    "price": 5000,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750315799/restaurant/qqpbxbfnotxdr4dr3bcp.jpg",
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Chocolate",
    "description": "Chocolate caliente tradicional",
    "price": 6600,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750315826/restaurant/yl2vmwxddzthgnhpboje.jpg",
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Milo (Frio o Caliente)",
    "description": "Milo servido frío o caliente",
    "price": 6500,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750316170/restaurant/gbe4ygvufk9cvpdqn00r.jpg",
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Jugo de naranja",
    "description": "Jugo de naranja natural",
    "price": 5900,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750316863/restaurant/aduggqnkq26wume593zv.jpg",
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Jugo del día",
    "description": "Jugo natural del día",
    "price": 4500,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750315142/restaurant/f6d1dxofcdtjlqdspyi9.png",
    "categoryId": "'$BEBIDAS_ID'",
    "locationId": "'$LOCATION_ID'",
    "isActive": true
  }'

curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Capuchino",
    "description": "Capuchino tradicional",
    "price": 6800,
    "image": "https://res.cloudinary.com/djegujdt1/image/upload/v1750314916/restaurant/iipja7jftimiupe727gu.jpg",
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

echo "Script completado para Paola" 