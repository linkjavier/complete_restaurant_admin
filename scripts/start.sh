#!/bin/bash

#Script para automatizar el inicio en instancias Linux
# El Frontend est desplegado en otra instancia. No se despliega. Solo bases de datos y Backend
set -e

cd ~/complete_restaurant_admin
docker-compose up -d postgres
docker-compose up -d redis
cd packages/api
npm start