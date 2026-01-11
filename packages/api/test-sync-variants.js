const Fuse = require('fuse.js');

function normalizeName(str) {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function syncVariantsWithIds(items, menu) {
    console.log(`[SYNC VARIANTS] Iniciando sincronización de ${items.length} items con un menú de ${menu.length} productos.`);
    return items.map(item => {
        let product = item.productId ? menu.find(p => p.id === item.productId) : undefined;
        if (!product && item.productName) {
            product = menu.find(p => normalizeName(p.name) === normalizeName(item.productName));
            if (product) console.log(`[SYNC VARIANTS] Producto "${item.productName}" encontrado por nombre exacto.`);
        }

        if (!product && item.productName) {
            console.log(`[SYNC VARIANTS] Producto "${item.productName}" no encontrado por ID/nombre exacto. Probando Fuse...`);
            const fuse = new Fuse(menu, { keys: ['name'], threshold: 0.4 });
            const results = fuse.search(item.productName);
            if (results.length > 0) {
                product = results[0].item;
                console.log(`[SYNC VARIANTS] Producto "${item.productName}" encontrado por Fuse -> "${product.name}" (score: ${results[0].score})`);
            }
        }

        if (!product || !product.variantGroups) {
            const itemIdentifier = item.productName || item.productId || 'desconocido';
            console.error(`[SYNC VARIANTS] ERROR: No se encontró el producto "${itemIdentifier}" en el menú actual.`);
            console.log(`[SYNC VARIANTS] Menu disponible para esta sede (${menu.length} productos):`, menu.map(p => `${p.name} (${p.id})`).join(', ').substring(0, 500));

            const options = menu.map(p => p.name).join(', ');
            throw new Error(`No se pudo identificar el producto "${itemIdentifier}". Por favor, asegúrate de que el producto esté disponible en la sede seleccionada. Opciones disponibles: ${options.substring(0, 200)}${options.length > 200 ? '...' : ''}`);
        }

        const syncedVariants = (item.variants || []).map(variant => {
            const group = product.variantGroups.find(g => normalizeName(g.name) === normalizeName(variant.groupName));
            if (!group) return null;
            let variantRecord = group.variants.find(v => normalizeName(v.name) === normalizeName(variant.variantName));
            if (!variantRecord && variant.variantName) {
                const fuse = new Fuse(group.variants, { keys: ['name'], threshold: 0.4 });
                const results = fuse.search(variant.variantName);
                if (results.length > 0) variantRecord = results[0].item;
            }
            return variantRecord ? {
                groupName: variant.groupName,
                variantName: variant.variantName,
                productVariantId: variantRecord.id
            } : null;
        }).filter(v => v !== null);

        return { ...item, productId: product.id, productName: product.name, variants: syncedVariants };
    });
}

// TEST CASES
const mockMenu = [
    { id: '1', name: 'Hamburguesa', variantGroups: [] },
    { id: '2', name: 'Pizza', variantGroups: [] }
];

console.log("--- Test 1: Valid productId, missing productName ---");
try {
    const items = [{ productId: '1', quantity: 1 }];
    const result = syncVariantsWithIds(items, mockMenu);
    console.log("Success:", JSON.stringify(result));
} catch (e) {
    console.error("Failed:", e.message);
}

console.log("\n--- Test 2: Missing productId, valid productName ---");
try {
    const items = [{ productName: 'Hamburguesa', quantity: 1 }];
    const result = syncVariantsWithIds(items, mockMenu);
    console.log("Success:", JSON.stringify(result));
} catch (e) {
    console.error("Failed:", e.message);
}

console.log("\n--- Test 3: Missing both (Should error gracefully, not crash) ---");
try {
    const items = [{ quantity: 1 }];
    const result = syncVariantsWithIds(items, mockMenu);
    console.log("Success:", JSON.stringify(result));
} catch (e) {
    console.error("Caught expected error:", e.message);
}

console.log("\n--- Test 4: Invalid productId and missing productName (Should error gracefully) ---");
try {
    const items = [{ productId: '999', quantity: 1 }];
    const result = syncVariantsWithIds(items, mockMenu);
    console.log("Success:", JSON.stringify(result));
} catch (e) {
    console.error("Caught expected error:", e.message);
}
