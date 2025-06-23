#!/bin/bash

# Script para exportar TODOS los productos con información completa a CSV
# Export Complete Products to CSV Script with Authentication

# Configuración
API_URL="http://localhost:3000"
EMAIL="paola@test.com"
PASSWORD="12345678"
OUTPUT_FILE="productos_completos_$(date +%Y%m%d_%H%M%S).csv"
TEMP_FILE="temp_products.json"
TOKEN_FILE="temp_token.json"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Script de Exportación Completa de Productos a CSV ===${NC}"
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
    echo "  -o, --output FILE       Archivo de salida (default: productos_completos_YYYYMMDD_HHMMSS.csv)"
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
echo -e "${PURPLE}🔐 Paso 1: Autenticación...${NC}"
echo -e "${YELLOW}Iniciando sesión con: ${EMAIL}${NC}"

curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
    -o "$TOKEN_FILE"

# Verificar si la autenticación fue exitosa
if [[ $? -ne 0 ]] || [[ ! -f "$TOKEN_FILE" ]] || [[ ! -s "$TOKEN_FILE" ]]; then
    echo -e "${RED}❌ Error: No se pudo conectar al API para autenticación${NC}"
    exit 1
fi

# Verificar si la respuesta es un JSON válido
if ! jq empty "$TOKEN_FILE" 2>/dev/null; then
    echo -e "${RED}❌ Error: Respuesta de autenticación no válida${NC}"
    echo "Respuesta recibida:"
    cat "$TOKEN_FILE"
    exit 1
fi

# Extraer el token JWT
JWT_TOKEN=$(jq -r '.access_token' "$TOKEN_FILE")

if [[ "$JWT_TOKEN" == "null" ]] || [[ -z "$JWT_TOKEN" ]]; then
    echo -e "${RED}❌ Error: No se pudo obtener el token de autenticación${NC}"
    echo "Respuesta completa:"
    cat "$TOKEN_FILE"
    exit 1
fi

echo -e "${GREEN}✅ Autenticación exitosa${NC}"

# PASO 2: Obtener lista básica de productos
echo -e "${PURPLE}📋 Paso 2: Obteniendo lista de productos...${NC}"

# Construir URL con parámetros
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

# Verificar si la petición fue exitosa
if [[ $? -ne 0 ]] || [[ ! -f "$TEMP_FILE" ]] || [[ ! -s "$TEMP_FILE" ]]; then
    echo -e "${RED}❌ Error: No se pudo obtener la lista de productos${NC}"
    exit 1
fi

# Verificar si la respuesta es un JSON válido
if ! jq empty "$TEMP_FILE" 2>/dev/null; then
    echo -e "${RED}❌ Error: La respuesta del API no es un JSON válido${NC}"
    echo "Respuesta recibida:"
    cat "$TEMP_FILE"
    exit 1
fi

# Contar productos básicos
BASIC_PRODUCT_COUNT=$(jq length "$TEMP_FILE")
echo -e "${GREEN}✅ Se encontraron ${BASIC_PRODUCT_COUNT} productos básicos${NC}"

# PASO 3: Obtener información completa de cada producto
echo -e "${PURPLE}🔍 Paso 3: Obteniendo información completa de cada producto...${NC}"

# Crear archivo temporal para productos completos
COMPLETE_PRODUCTS_FILE="temp_complete_products.json"
echo "[]" > "$COMPLETE_PRODUCTS_FILE"

# Contador para mostrar progreso
COUNTER=0
TOTAL=$BASIC_PRODUCT_COUNT

# Obtener IDs de productos
PRODUCT_IDS=$(jq -r '.[].id' "$TEMP_FILE")

for PRODUCT_ID in $PRODUCT_IDS; do
    COUNTER=$((COUNTER + 1))
    echo -e "${YELLOW}Procesando producto ${COUNTER}/${TOTAL}: ${PRODUCT_ID}${NC}"
    
    # Obtener información completa del producto
    COMPLETE_PRODUCT=$(curl -s -X GET "${API_URL}/products/${PRODUCT_ID}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${JWT_TOKEN}")
    
    if [[ $? -eq 0 ]] && [[ -n "$COMPLETE_PRODUCT" ]]; then
        # Verificar si es JSON válido
        if echo "$COMPLETE_PRODUCT" | jq empty 2>/dev/null; then
            # Agregar al archivo de productos completos
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

# Verificar cuántos productos completos se obtuvieron
COMPLETE_COUNT=$(jq length "$COMPLETE_PRODUCTS_FILE")
echo -e "${GREEN}✅ Se obtuvieron ${COMPLETE_COUNT} productos con información completa${NC}"

# PASO 4: Crear el archivo CSV
echo -e "${PURPLE}📝 Paso 4: Creando archivo CSV...${NC}"

# Headers del CSV
CSV_HEADERS="ID,Nombre,Descripción,Precio,Imagen,Categoría ID,Categoría Nombre,Activo,Es Final,Cantidad,Ubicación ID,Ingredientes,Variantes,Fecha Creación,Fecha Actualización"

echo "$CSV_HEADERS" > "$OUTPUT_FILE"

# Procesar cada producto completo
jq -r '.[] | [
    .id,
    (.name | @csv),
    (.description // "" | @csv),
    .price,
    (.image // "" | @csv),
    .categoryId,
    (.category.name | @csv),
    .isActive,
    .isFinal,
    .quantity,
    .locationId,
    (if .ingredients and (.ingredients | length) > 0 then (.ingredients | map("\(.ingredient.name): \(.quantity)") | join("; ")) else "" end | @csv),
    (if .variants and (.variants | length) > 0 then (.variants | map("\(.name): $\(.price // .product.price)") | join("; ")) else "" end | @csv),
    .createdAt,
    .updatedAt
] | @csv' "$COMPLETE_PRODUCTS_FILE" >> "$OUTPUT_FILE" 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Error en procesamiento CSV con jq, usando método alternativo...${NC}"
    # Método alternativo: procesar manualmente
    jq -r '.[] | "\(.id),\"\(.name)\",\"\(.description // "")\",\(.price),\"\(.image // "")\",\(.categoryId),\"\(.category.name)\",\(.isActive),\(.isFinal),\(.quantity),\(.locationId),\"\(if .ingredients and (.ingredients | length) > 0 then (.ingredients | map("\(.ingredient.name): \(.quantity)") | join("; ")) else "" end)\",\"\(if .variants and (.variants | length) > 0 then (.variants | map("\(.name): $\(.price // .product.price)") | join("; ")) else "" end)\",\(.createdAt),\(.updatedAt)"' "$COMPLETE_PRODUCTS_FILE" >> "$OUTPUT_FILE" 2>/dev/null || {
        echo -e "${RED}❌ Error crítico en procesamiento CSV${NC}"
        exit 1
    }
}

# Limpiar archivo temporal de productos completos
rm -f "$COMPLETE_PRODUCTS_FILE"

echo -e "${GREEN}✅ Exportación completada exitosamente!${NC}"
echo -e "${GREEN}📁 Archivo generado: ${OUTPUT_FILE}${NC}"
echo -e "${GREEN}📊 Total de productos exportados: ${COMPLETE_COUNT}${NC}"
echo ""

# Mostrar estadísticas adicionales
echo -e "${BLUE}=== Estadísticas de la Exportación ===${NC}"

# Contar productos activos/inactivos
ACTIVE_COUNT=$(jq '[.[] | select(.isActive == true)] | length' "$COMPLETE_PRODUCTS_FILE" 2>/dev/null || echo "0")
INACTIVE_COUNT=$(jq '[.[] | select(.isActive == false)] | length' "$COMPLETE_PRODUCTS_FILE" 2>/dev/null || echo "0")

echo -e "Productos activos: ${GREEN}${ACTIVE_COUNT}${NC}"
echo -e "Productos inactivos: ${YELLOW}${INACTIVE_COUNT}${NC}"

# Contar productos con ingredientes
WITH_INGREDIENTS=$(jq '[.[] | select(.ingredients and (.ingredients | length) > 0)] | length' "$COMPLETE_PRODUCTS_FILE" 2>/dev/null || echo "0")
echo -e "Productos con ingredientes: ${BLUE}${WITH_INGREDIENTS}${NC}"

# Contar productos con variantes
WITH_VARIANTS=$(jq '[.[] | select(.variants and (.variants | length) > 0)] | length' "$COMPLETE_PRODUCTS_FILE" 2>/dev/null || echo "0")
echo -e "Productos con variantes: ${BLUE}${WITH_VARIANTS}${NC}"

echo ""
echo -e "${YELLOW}💡 Para abrir el archivo CSV:${NC}"
echo -e "  - Excel: open ${OUTPUT_FILE}"
echo -e "  - Numbers (Mac): open -a Numbers ${OUTPUT_FILE}"
echo -e "  - LibreOffice: libreoffice --calc ${OUTPUT_FILE}"
echo -e "  - Google Sheets: Subir el archivo a Google Drive" 