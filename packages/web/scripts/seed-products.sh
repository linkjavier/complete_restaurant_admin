#!/bin/bash

# URL base de la API
API_URL="http://localhost:3000"

# Token de autenticación
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYTNlODIzYy1lMTU5LTQ4MWEtODRkMi1mYTI3YjU3MGY0Y2YiLCJlbWFpbCI6ImphdmllckB0ZXN0LmNvbSIsInJvbGUiOiJBRE1JTiIsImxvY2F0aW9uSWQiOm51bGwsImlhdCI6MTc0NTU5ODEwMywiZXhwIjoxNzQ1Njg0NTAzfQ.hR3p_YaGsvXRyzviGHFwrIA5kgXY35rO7gQrKZF_egQ"

# ID de la ubicación
LOCATION_ID="77b74cf4-d0f6-4ae0-831d-4ec72a34a4c6"

# Función para crear una categoría
create_category() {
    curl -X POST "$API_URL/categories" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$1"
}

# Función para crear un producto
create_product() {
    curl -X POST "$API_URL/products" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$1"
}

# Crear categorías
ENTRADAS_ID=$(create_category '{"name":"Entradas","description":"Aperitivos y entradas"}' | jq -r '.id')
PLATOS_FUERTES_ID=$(create_category '{"name":"Platos Fuertes","description":"Platos principales"}' | jq -r '.id')
DESAYUNOS_ID=$(create_category '{"name":"Desayunos","description":"Desayunos y brunch"}' | jq -r '.id')
BEBIDAS_ID=$(create_category '{"name":"Bebidas","description":"Bebidas y cócteles"}' | jq -r '.id')
PANADERIA_ID=$(create_category '{"name":"Panadería","description":"Pan y repostería"}' | jq -r '.id')
POSTRES_ID=$(create_category '{"name":"Postres","description":"Postres y dulces"}' | jq -r '.id')
ENSALADAS_ID=$(create_category '{"name":"Ensaladas","description":"Ensaladas y bowls"}' | jq -r '.id')
SOPAS_ID=$(create_category '{"name":"Sopas","description":"Sopas y cremas"}' | jq -r '.id')
PIZZAS_ID=$(create_category '{"name":"Pizzas","description":"Pizzas y calzones"}' | jq -r '.id')
HAMBURGUESAS_ID=$(create_category '{"name":"Hamburguesas","description":"Hamburguesas y sandwiches"}' | jq -r '.id')

# Entradas
create_product '{"name":"Nachos con Queso","description":"Tortillas chips bañadas en queso fundido, jalapeños y guacamole","price":8.99,"image":"/images/nachos.jpg","categoryId":"'$ENTRADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Alitas BBQ","description":"Alitas de pollo bañadas en salsa BBQ, acompañadas de apio y aderezo ranch","price":12.99,"image":"/images/alitas.jpg","categoryId":"'$ENTRADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Ceviche Mixto","description":"Pescado, camarones y calamares marinados en limón, cebolla y ají","price":14.99,"image":"/images/ceviche.jpg","categoryId":"'$ENTRADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Empanadas de Carne","description":"Empanadas caseras rellenas de carne molida, huevo y aceitunas","price":6.99,"image":"/images/empanadas.jpg","categoryId":"'$ENTRADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Ensalada César","description":"Lechuga romana, crutones, queso parmesano y aderezo césar","price":9.99,"image":"/images/cesar.jpg","categoryId":"'$ENTRADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

# Platos Fuertes
create_product '{"name":"Lomo Saltado","description":"Lomo de res salteado con cebolla, tomate y papas fritas","price":18.99,"image":"/images/lomo.jpg","categoryId":"'$PLATOS_FUERTES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pasta Alfredo","description":"Fettuccine con salsa cremosa de queso parmesano y pollo","price":16.99,"image":"/images/pasta.jpg","categoryId":"'$PLATOS_FUERTES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Parrillada Mixta","description":"Selección de carnes a la parrilla con guarniciones","price":24.99,"image":"/images/parrillada.jpg","categoryId":"'$PLATOS_FUERTES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pollo a la Brasa","description":"Pollo asado al carbón con papas fritas y ensalada","price":15.99,"image":"/images/pollo.jpg","categoryId":"'$PLATOS_FUERTES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pescado a la Plancha","description":"Filete de pescado fresco con vegetales salteados","price":19.99,"image":"/images/pescado.jpg","categoryId":"'$PLATOS_FUERTES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

# Desayunos
create_product '{"name":"Desayuno Americano","description":"Huevos, tocino, pan tostado, papas y café","price":12.99,"image":"/images/desayuno-americano.jpg","categoryId":"'$DESAYUNOS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Omelette del Chef","description":"Omelette con jamón, queso, champiñones y espinacas","price":10.99,"image":"/images/omelette.jpg","categoryId":"'$DESAYUNOS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pancakes con Frutas","description":"Pancakes esponjosos con frutas frescas y sirope de maple","price":9.99,"image":"/images/pancakes.jpg","categoryId":"'$DESAYUNOS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Huevos Benedictinos","description":"Huevos pochados sobre pan inglés con jamón y salsa holandesa","price":13.99,"image":"/images/benedict.jpg","categoryId":"'$DESAYUNOS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Tostada Francesa","description":"Pan remojado en huevo y leche, servido con frutas y miel","price":8.99,"image":"/images/tostada.jpg","categoryId":"'$DESAYUNOS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

# Bebidas
create_product '{"name":"Limonada Casera","description":"Limonada fresca con menta y jengibre","price":4.99,"image":"/images/limonada.jpg","categoryId":"'$BEBIDAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Mojito","description":"Ron, menta, limón, azúcar y soda","price":8.99,"image":"/images/mojito.jpg","categoryId":"'$BEBIDAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Café Latte","description":"Café espresso con leche vaporizada","price":4.99,"image":"/images/latte.jpg","categoryId":"'$BEBIDAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Jugo Natural","description":"Jugo fresco de naranja, piña o maracuyá","price":3.99,"image":"/images/jugo.jpg","categoryId":"'$BEBIDAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Té Helado","description":"Té negro con limón y menta","price":3.99,"image":"/images/te.jpg","categoryId":"'$BEBIDAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

# Panadería
create_product '{"name":"Croissant de Chocolate","description":"Croissant relleno de chocolate belga","price":3.99,"image":"/images/croissant.jpg","categoryId":"'$PANADERIA_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pan de Ajo","description":"Pan artesanal con mantequilla de ajo y perejil","price":5.99,"image":"/images/pan-ajo.jpg","categoryId":"'$PANADERIA_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Muffin de Arándanos","description":"Muffin casero con arándanos frescos","price":3.99,"image":"/images/muffin.jpg","categoryId":"'$PANADERIA_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pan de Centeno","description":"Pan integral de centeno con semillas","price":4.99,"image":"/images/centeno.jpg","categoryId":"'$PANADERIA_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Baguette","description":"Pan francés crujiente","price":3.99,"image":"/images/baguette.jpg","categoryId":"'$PANADERIA_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

# Postres
create_product '{"name":"Tiramisú","description":"Postre italiano con café, mascarpone y cacao","price":7.99,"image":"/images/tiramisu.jpg","categoryId":"'$POSTRES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Cheesecake de Frutos Rojos","description":"Cheesecake cremoso con salsa de frutos rojos","price":8.99,"image":"/images/cheesecake.jpg","categoryId":"'$POSTRES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Brownie con Helado","description":"Brownie caliente con helado de vainilla y salsa de chocolate","price":7.99,"image":"/images/brownie.jpg","categoryId":"'$POSTRES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Mousse de Chocolate","description":"Mousse suave de chocolate negro","price":6.99,"image":"/images/mousse.jpg","categoryId":"'$POSTRES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Tarta de Manzana","description":"Tarta casera de manzana con canela","price":7.99,"image":"/images/tarta.jpg","categoryId":"'$POSTRES_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

# Ensaladas
create_product '{"name":"Ensalada Griega","description":"Lechuga, tomate, pepino, aceitunas y queso feta","price":10.99,"image":"/images/griega.jpg","categoryId":"'$ENSALADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Ensalada Caprese","description":"Tomate, mozzarella y albahaca con aceite de oliva","price":11.99,"image":"/images/caprese.jpg","categoryId":"'$ENSALADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Ensalada de Quinoa","description":"Quinoa con vegetales frescos y aderezo de limón","price":12.99,"image":"/images/quinoa.jpg","categoryId":"'$ENSALADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Ensalada de Atún","description":"Atún fresco con vegetales y aderezo de mostaza","price":13.99,"image":"/images/atun.jpg","categoryId":"'$ENSALADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Ensalada de Frutas","description":"Mezcla de frutas frescas con yogurt","price":8.99,"image":"/images/frutas.jpg","categoryId":"'$ENSALADAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

# Sopas
create_product '{"name":"Sopa de Pollo","description":"Sopa casera de pollo con fideos y verduras","price":8.99,"image":"/images/sopa-pollo.jpg","categoryId":"'$SOPAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Crema de Espárragos","description":"Crema suave de espárragos con crutones","price":7.99,"image":"/images/esparragos.jpg","categoryId":"'$SOPAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Sopa de Mariscos","description":"Sopa con variedad de mariscos frescos","price":12.99,"image":"/images/mariscos.jpg","categoryId":"'$SOPAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Minestrone","description":"Sopa italiana de verduras con pasta","price":9.99,"image":"/images/minestrone.jpg","categoryId":"'$SOPAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Sopa de Tomate","description":"Sopa cremosa de tomate con albahaca","price":7.99,"image":"/images/tomate.jpg","categoryId":"'$SOPAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

# Pizzas
create_product '{"name":"Pizza Margarita","description":"Pizza con salsa de tomate, mozzarella y albahaca","price":12.99,"image":"/images/margarita.jpg","categoryId":"'$PIZZAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pizza Pepperoni","description":"Pizza con salsa de tomate, mozzarella y pepperoni","price":14.99,"image":"/images/pepperoni.jpg","categoryId":"'$PIZZAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pizza Hawaiana","description":"Pizza con jamón, piña y queso mozzarella","price":13.99,"image":"/images/hawaiana.jpg","categoryId":"'$PIZZAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pizza Vegetariana","description":"Pizza con variedad de vegetales frescos","price":13.99,"image":"/images/vegetariana.jpg","categoryId":"'$PIZZAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Pizza Cuatro Quesos","description":"Pizza con mezcla de cuatro quesos diferentes","price":15.99,"image":"/images/cuatro-quesos.jpg","categoryId":"'$PIZZAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

# Hamburguesas
create_product '{"name":"Hamburguesa Clásica","description":"Hamburguesa con carne, lechuga, tomate y cebolla","price":10.99,"image":"/images/clasica.jpg","categoryId":"'$HAMBURGUESAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Hamburguesa BBQ","description":"Hamburguesa con salsa BBQ y cebolla caramelizada","price":12.99,"image":"/images/bbq.jpg","categoryId":"'$HAMBURGUESAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Hamburguesa Vegetariana","description":"Hamburguesa de lentejas con vegetales","price":11.99,"image":"/images/vegetariana.jpg","categoryId":"'$HAMBURGUESAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Hamburguesa Doble","description":"Doble carne con queso y vegetales","price":14.99,"image":"/images/doble.jpg","categoryId":"'$HAMBURGUESAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'
create_product '{"name":"Hamburguesa de Pollo","description":"Hamburguesa de pollo a la parrilla","price":11.99,"image":"/images/pollo.jpg","categoryId":"'$HAMBURGUESAS_ID'","locationId":"'$LOCATION_ID'","isActive":true}'

echo "Productos creados exitosamente!" 