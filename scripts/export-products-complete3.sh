#!/bin/bash

# Script para exportar TODOS los productos con información completa a CSV, incluyendo grupos de variantes y variantes por grupo
# Export Complete Products to CSV Script with Authentication (con variantes detalladas)

# Configuración
API_URL="http://localhost:3000"
EMAIL="paola@test.com"
PASSWORD="12345678"
OUTPUT_FILE="productos_completos3_$(date +%Y%m%d_%H%M%S).csv"
TEMP_FILE="temp_products.json"
TOKEN_FILE="temp_token.json"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Script de Exportación Completa de Productos a CSV (con variantes) ===${NC}"
echo -e "${YELLOW}API URL: ${API_URL}${NC}"
echo -e "${YELLOW}Usuario: ${EMAIL}${NC}"
echo -e "${YELLOW}Archivo de salida: ${OUTPUT_FILE}${NC}"
echo ""

# Función para mostrar ayuda
show_help() {
    echo "Uso: $0 [OPCIONES]"
    echo ""
    echo "Opciones:"
    echo "  -l, --location-id ID    ID de la ubicación para filtrar (opcional)"
    echo "  -c, --category-id ID    ID de la categoría (opcional)"
    echo "  -s, --search TERM       Término de búsqueda (opcional)"
    echo "  -o, --output FILE       Archivo de salida (default: productos_completos3_YYYYMMDD_HHMMSS.csv)"
    echo "  -h, --help              Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0                          # Exporta todos los productos de todas las ubicaciones"
    echo "  $0 -l abc123                # Exporta productos solo de la ubicación abc123"
    echo "  $0 -l abc123 -c def456      # Filtra por ubicación y categoría"
    echo "  $0 -s 'pizza' -o mis_productos.csv # Busca 'pizza' en todas las ubicaciones"
}

# Parsear argumentos
LOCATION_ID=""
CATEGORY_ID=""
SEARCH_TERM=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--location-id)
            LOCATION_ID="$2"
            shift 2
            ;;
        -c|--category-id)
            CATEGORY_ID="$2"
            shift 2
            ;;
        -s|--search)
            SEARCH_TERM="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Opción desconocida $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Función para limpiar archivos temporales
cleanup() {
    rm -f "$TEMP_FILE" "$TOKEN_FILE"
}

# Limpiar al salir
trap cleanup EXIT

# PASO 1: Autenticación
# ... igual que el script original ...

curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
    -o "$TOKEN_FILE"

if [[ $? -ne 0 ]] || [[ ! -f "$TOKEN_FILE" ]] || [[ ! -s "$TOKEN_FILE" ]]; then
    echo -e "${RED}❌ Error: No se pudo conectar al API para autenticación${NC}"
    exit 1
fi

if ! jq empty "$TOKEN_FILE" 2>/dev/null; then
    echo -e "${RED}❌ Error: Respuesta de autenticación no válida${NC}"
    echo "Respuesta recibida:"
    cat "$TOKEN_FILE"
    exit 1
fi

JWT_TOKEN=$(jq -r '.access_token' "$TOKEN_FILE")

if [[ "$JWT_TOKEN" == "null" ]] || [[ -z "$JWT_TOKEN" ]]; then
    echo -e "${RED}❌ Error: No se pudo obtener el token de autenticación${NC}"
    echo "Respuesta completa:"
    cat "$TOKEN_FILE"
    exit 1
fi

echo -e "${GREEN}✅ Autenticación exitosa${NC}"

# PASO 2: Obtener lista básica de productos
# ... igual que el script original ...

URL="${API_URL}/products"
QUERY_PARAMS=""

if [[ -n "$LOCATION_ID" ]]; then
    QUERY_PARAMS="locationId=${LOCATION_ID}"
fi
if [[ -n "$CATEGORY_ID" ]]; then
    if [[ -n "$QUERY_PARAMS" ]]; then QUERY_PARAMS="${QUERY_PARAMS}&"; fi
    QUERY_PARAMS="${QUERY_PARAMS}categoryId=${CATEGORY_ID}"
fi
if [[ -n "$SEARCH_TERM" ]]; then
    if [[ -n "$QUERY_PARAMS" ]]; then QUERY_PARAMS="${QUERY_PARAMS}&"; fi
    QUERY_PARAMS="${QUERY_PARAMS}search=${SEARCH_TERM}"
fi

if [[ -n "$QUERY_PARAMS" ]]; then
    URL="${URL}?${QUERY_PARAMS}"
fi

echo -e "${YELLOW}Obteniendo productos de: ${URL}${NC}"

curl -s -X GET "$URL" \
    -H "Content-Type: application/json" \
    -o "$TEMP_FILE"

if [[ $? -ne 0 ]] || [[ ! -f "$TEMP_FILE" ]] || [[ ! -s "$TEMP_FILE" ]]; then
    echo -e "${RED}❌ Error: No se pudo obtener la lista de productos${NC}"
    exit 1
fi

if ! jq empty "$TEMP_FILE" 2>/dev/null; then
    echo -e "${RED}❌ Error: La respuesta del API no es un JSON válido${NC}"
    echo "Respuesta recibida:"
    cat "$TEMP_FILE"
    exit 1
fi

BASIC_PRODUCT_COUNT=$(jq length "$TEMP_FILE")
echo -e "${GREEN}✅ Se encontraron ${BASIC_PRODUCT_COUNT} productos básicos${NC}"

# PASO 3: Obtener información completa de cada producto
COMPLETE_PRODUCTS_FILE="temp_complete_products.json"
echo "[]" > "$COMPLETE_PRODUCTS_FILE"

COUNTER=0
TOTAL=$BASIC_PRODUCT_COUNT
PRODUCT_IDS=$(jq -r '.[].id' "$TEMP_FILE")

for PRODUCT_ID in $PRODUCT_IDS; do
    COUNTER=$((COUNTER + 1))
    echo -e "${YELLOW}Procesando producto ${COUNTER}/${TOTAL}: ${PRODUCT_ID}${NC}"
    
    COMPLETE_PRODUCT=$(curl -s -X GET "${API_URL}/products/${PRODUCT_ID}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${JWT_TOKEN}")
    
    if [[ $? -eq 0 ]] && [[ -n "$COMPLETE_PRODUCT" ]]; then
        if echo "$COMPLETE_PRODUCT" | jq empty 2>/dev/null; then
            jq --argjson product "$COMPLETE_PRODUCT" '. += [$product]' "$COMPLETE_PRODUCTS_FILE" > "${COMPLETE_PRODUCTS_FILE}.tmp"
            mv "${COMPLETE_PRODUCTS_FILE}.tmp" "$COMPLETE_PRODUCTS_FILE"
            echo -e "${GREEN}  ✅ Producto ${PRODUCT_ID} obtenido${NC}"
        else
            echo -e "${RED}  ❌ Producto ${PRODUCT_ID}: Respuesta JSON inválida${NC}"
        fi
    else
        echo -e "${RED}  ❌ Producto ${PRODUCT_ID}: Error al obtener datos${NC}"
    fi
done

COMPLETE_COUNT=$(jq length "$COMPLETE_PRODUCTS_FILE")
echo -e "${GREEN}✅ Se obtuvieron ${COMPLETE_COUNT} productos con información completa${NC}"

# Filtrar productos válidos (category debe ser objeto y variantGroups debe ser array, null o no existir)
jq 'map(select(
  (has("category") and (.category | type == "object"))
))' "$COMPLETE_PRODUCTS_FILE" > "$COMPLETE_PRODUCTS_FILE.valid"

# Mostrar cuántos productos se omiten
INVALID_COUNT=$(($(jq length "$COMPLETE_PRODUCTS_FILE") - $(jq length "$COMPLETE_PRODUCTS_FILE.valid")))
if [ "$INVALID_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Se omitieron $INVALID_COUNT productos con estructura inválida.${NC}"
fi

# PASO 4: Crear el archivo CSV
# Headers del CSV (agregamos columnas para grupos y variantes)
CSV_HEADERS="ID,Nombre,Descripción,Precio,Imagen,Categoría ID,Categoría Nombre,Activo,Es Final,Cantidad,Ubicación ID,Ingredientes,Grupos de Variantes,Variantes por Grupo,Fecha Creación,Fecha Actualización"
echo "$CSV_HEADERS" > "$OUTPUT_FILE"

# Procesar cada producto completo
echo "Procesando productos para CSV..."

# Procesar cada producto individualmente para evitar errores de formato
jq -c '.[]' "$COMPLETE_PRODUCTS_FILE.valid" | while read -r product; do
  # Extraer campos individuales
  id=$(echo "$product" | jq -r '.id')
  name=$(echo "$product" | jq -r '.name' | sed 's/"/""/g' | sed 's/\n/ /g' | sed 's/\r/ /g' | sed 's/\t/ /g')
  description=$(echo "$product" | jq -r '.description // ""' | sed 's/"/""/g' | sed 's/\n/ /g' | sed 's/\r/ /g' | sed 's/\t/ /g')
  price=$(echo "$product" | jq -r '.price')
  image=$(echo "$product" | jq -r '.image // ""' | sed 's/"/""/g')
  categoryId=$(echo "$product" | jq -r '.categoryId')
  categoryName=$(echo "$product" | jq -r '.category.name' | sed 's/"/""/g' | sed 's/\n/ /g' | sed 's/\r/ /g' | sed 's/\t/ /g')
  isActive=$(echo "$product" | jq -r '.isActive')
  isFinal=$(echo "$product" | jq -r '.isFinal')
  quantity=$(echo "$product" | jq -r '.quantity')
  locationId=$(echo "$product" | jq -r '.locationId')
  
  # Procesar ingredientes
  ingredients=$(echo "$product" | jq -r 'if .ingredients and (.ingredients | length) > 0 then (.ingredients | map("\(.ingredient.name): \(.quantity)") | join("; ")) else "" end' | sed 's/"/""/g' | sed 's/\n/ /g' | sed 's/\r/ /g' | sed 's/\t/ /g')
  
  # Procesar grupos de variantes
  variantGroups=$(echo "$product" | jq -r 'if .variantGroups and (.variantGroups | type == "array") and (.variantGroups | length) > 0 then (.variantGroups | map(.name) | join("; ")) else "" end' | sed 's/"/""/g' | sed 's/\n/ /g' | sed 's/\r/ /g' | sed 's/\t/ /g')
  
  # Procesar variantes por grupo
  variantsByGroup=$(echo "$product" | jq -r 'if .variantGroups and (.variantGroups | type == "array") and (.variantGroups | length) > 0 then (.variantGroups | map("\(.name): " + (.variants | map(.name) | join(" | "))) | join("; ")) else "" end' | sed 's/"/""/g' | sed 's/\n/ /g' | sed 's/\r/ /g' | sed 's/\t/ /g')
  
  createdAt=$(echo "$product" | jq -r '.createdAt')
  updatedAt=$(echo "$product" | jq -r '.updatedAt')
  
  # Escribir línea CSV
  echo "\"$id\",\"$name\",\"$description\",$price,\"$image\",\"$categoryId\",\"$categoryName\",$isActive,$isFinal,$quantity,\"$locationId\",\"$ingredients\",\"$variantGroups\",\"$variantsByGroup\",\"$createdAt\",\"$updatedAt\"" >> "$OUTPUT_FILE"
done

# rm -f "$COMPLETE_PRODUCTS_FILE" "$COMPLETE_PRODUCTS_FILE.valid"

echo -e "${GREEN}✅ Exportación completada exitosamente!${NC}"
echo -e "${GREEN}📁 Archivo generado: ${OUTPUT_FILE}${NC}"
echo -e "${GREEN}📊 Total de productos exportados: ${COMPLETE_COUNT}${NC}"
echo "" 