#!/usr/bin/env python3
"""
Script para exportar TODOS los productos con información completa a CSV
Export Complete Products to CSV Script with Authentication using Python
"""

import json
import csv
import subprocess
import sys
import argparse
import time
from datetime import datetime
from urllib.parse import urlencode

# Configuración
API_URL = "http://localhost:3000"
EMAIL = "paola@test.com"
PASSWORD = "12345678"

def show_help():
    """Mostrar ayuda del script"""
    print("Uso: python3 export-products-complete.py [OPCIONES]")
    print("")
    print("Opciones:")
    print("  -l, --location-id ID    ID de la ubicación (requerido)")
    print("  -c, --category-id ID    ID de la categoría (opcional)")
    print("  -s, --search TERM       Término de búsqueda (opcional)")
    print("  -o, --output FILE       Archivo de salida (default: productos_completos_YYYYMMDD_HHMMSS.csv)")
    print("  -h, --help              Mostrar esta ayuda")
    print("")
    print("Ejemplos:")
    print("  python3 export-products-complete.py -l abc123")
    print("  python3 export-products-complete.py -l abc123 -c def456")
    print("  python3 export-products-complete.py -l abc123 -s 'pizza' -o mis_productos.csv")

def make_curl_request(url, headers=None, data=None, method="GET"):
    """Realizar petición CURL y retornar la respuesta JSON"""
    try:
        cmd = ['curl', '-s', '-X', method, url]
        
        if headers:
            for key, value in headers.items():
                cmd.extend(['-H', f'{key}: {value}'])
        
        if data:
            cmd.extend(['-d', data])
        
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        # Parsear JSON
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error al conectar con el API: {e}")
        print(f"Comando ejecutado: {' '.join(cmd)}")
        return None
    except json.JSONDecodeError as e:
        print(f"❌ Error al parsear JSON: {e}")
        print(f"Respuesta recibida: {result.stdout}")
        return None

def authenticate():
    """Autenticar y obtener token JWT"""
    print("🔐 Paso 1: Autenticación...")
    print(f"Iniciando sesión con: {EMAIL}")
    
    login_data = json.dumps({
        "email": EMAIL,
        "password": PASSWORD
    })
    
    response = make_curl_request(
        f"{API_URL}/auth/login",
        headers={"Content-Type": "application/json"},
        data=login_data,
        method="POST"
    )
    
    if not response:
        print("❌ Error: No se pudo autenticar")
        return None
    
    if 'access_token' not in response:
        print("❌ Error: No se recibió token de acceso")
        print(f"Respuesta: {response}")
        return None
    
    print("✅ Autenticación exitosa")
    return response['access_token']

def get_basic_products(location_id, category_id=None, search_term=None):
    """Obtener lista básica de productos"""
    print("📋 Paso 2: Obteniendo lista de productos...")
    
    params = {'locationId': location_id}
    if category_id:
        params['categoryId'] = category_id
    if search_term:
        params['search'] = search_term
    
    url = f"{API_URL}/products?{urlencode(params)}"
    print(f"Obteniendo productos de: {url}")
    
    products = make_curl_request(url)
    
    if not products:
        print("❌ Error: No se pudieron obtener los productos")
        return None
    
    if not isinstance(products, list):
        print("❌ Error: La respuesta no es una lista de productos")
        return None
    
    print(f"✅ Se encontraron {len(products)} productos básicos")
    return products

def get_complete_product(product_id, token):
    """Obtener información completa de un producto individual"""
    url = f"{API_URL}/products/{product_id}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    return make_curl_request(url, headers=headers)

def get_complete_products(basic_products, token):
    """Obtener información completa de todos los productos"""
    print("🔍 Paso 3: Obteniendo información completa de cada producto...")
    
    complete_products = []
    total = len(basic_products)
    
    for i, product in enumerate(basic_products, 1):
        product_id = product.get('id')
        print(f"Procesando producto {i}/{total}: {product_id}")
        
        complete_product = get_complete_product(product_id, token)
        
        if complete_product:
            complete_products.append(complete_product)
            print(f"  ✅ Producto {product_id} obtenido")
        else:
            print(f"  ❌ Producto {product_id}: Error al obtener datos")
        
        # Pequeña pausa para no sobrecargar el servidor
        time.sleep(0.1)
    
    print(f"✅ Se obtuvieron {len(complete_products)} productos con información completa")
    return complete_products

def format_ingredients(ingredients):
    """Formatear lista de ingredientes para CSV"""
    if not ingredients:
        return ""
    
    formatted = []
    for ing in ingredients:
        ingredient_name = ing.get('ingredient', {}).get('name', 'Desconocido')
        quantity = ing.get('quantity', 0)
        formatted.append(f"{ingredient_name}: {quantity}")
    
    return "; ".join(formatted)

def format_variants(variants, base_price):
    """Formatear lista de variantes para CSV"""
    if not variants:
        return ""
    
    formatted = []
    for variant in variants:
        name = variant.get('name', 'Desconocido')
        price = variant.get('price', base_price)
        formatted.append(f"{name}: ${price}")
    
    return "; ".join(formatted)

def export_to_csv(products, output_file):
    """Exportar productos a CSV"""
    print("📝 Paso 4: Creando archivo CSV...")
    
    # Headers del CSV
    headers = [
        'ID', 'Nombre', 'Descripción', 'Precio', 'Imagen', 
        'Categoría ID', 'Categoría Nombre', 'Activo', 'Es Final', 
        'Cantidad', 'Ubicación ID', 'Ingredientes', 'Variantes', 
        'Fecha Creación', 'Fecha Actualización'
    ]
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(headers)
        
        for product in products:
            row = [
                product.get('id', ''),
                product.get('name', ''),
                product.get('description', ''),
                product.get('price', 0),
                product.get('image', ''),
                product.get('categoryId', ''),
                product.get('category', {}).get('name', ''),
                product.get('isActive', False),
                product.get('isFinal', False),
                product.get('quantity', 0),
                product.get('locationId', ''),
                format_ingredients(product.get('ingredients', [])),
                format_variants(product.get('variants', []), product.get('price', 0)),
                product.get('createdAt', ''),
                product.get('updatedAt', '')
            ]
            writer.writerow(row)

def get_statistics(products):
    """Obtener estadísticas de los productos"""
    total = len(products)
    active = sum(1 for p in products if p.get('isActive', False))
    inactive = total - active
    with_ingredients = sum(1 for p in products if p.get('ingredients'))
    with_variants = sum(1 for p in products if p.get('variants'))
    
    return {
        'total': total,
        'active': active,
        'inactive': inactive,
        'with_ingredients': with_ingredients,
        'with_variants': with_variants
    }

def main():
    """Función principal"""
    parser = argparse.ArgumentParser(description='Exportar productos completos a CSV')
    parser.add_argument('-l', '--location-id', required=True, help='ID de la ubicación')
    parser.add_argument('-c', '--category-id', help='ID de la categoría')
    parser.add_argument('-s', '--search', help='Término de búsqueda')
    parser.add_argument('-o', '--output', help='Archivo de salida')
    
    args = parser.parse_args()
    
    # Generar nombre de archivo por defecto
    if not args.output:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        args.output = f"productos_completos_{timestamp}.csv"
    
    print("=== Script de Exportación Completa de Productos a CSV ===")
    print(f"API URL: {API_URL}")
    print(f"Usuario: {EMAIL}")
    print(f"Archivo de salida: {args.output}")
    print("")
    
    # PASO 1: Autenticación
    token = authenticate()
    if not token:
        print("❌ No se pudo autenticar. Saliendo...")
        sys.exit(1)
    
    # PASO 2: Obtener productos básicos
    basic_products = get_basic_products(args.location_id, args.category_id, args.search)
    if not basic_products:
        print("❌ No se pudieron obtener los productos básicos. Saliendo...")
        sys.exit(1)
    
    # PASO 3: Obtener productos completos
    complete_products = get_complete_products(basic_products, token)
    if not complete_products:
        print("❌ No se pudieron obtener los productos completos. Saliendo...")
        sys.exit(1)
    
    # PASO 4: Exportar a CSV
    export_to_csv(complete_products, args.output)
    
    # Mostrar estadísticas
    stats = get_statistics(complete_products)
    print("")
    print("=== Estadísticas de la Exportación ===")
    print(f"Total de productos: {stats['total']}")
    print(f"Productos activos: {stats['active']}")
    print(f"Productos inactivos: {stats['inactive']}")
    print(f"Productos con ingredientes: {stats['with_ingredients']}")
    print(f"Productos con variantes: {stats['with_variants']}")
    
    print("")
    print("✅ Exportación completada exitosamente!")
    print(f"📁 Archivo generado: {args.output}")
    print("")
    print("💡 Para abrir el archivo CSV:")
    print(f"  - Excel: open {args.output}")
    print(f"  - Numbers (Mac): open -a Numbers {args.output}")
    print(f"  - LibreOffice: libreoffice --calc {args.output}")
    print("  - Google Sheets: Subir el archivo a Google Drive")

if __name__ == "__main__":
    main() 