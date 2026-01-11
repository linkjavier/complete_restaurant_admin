/**
 * Utility for normalizing Colombian addresses by expanding common abbreviations
 * and ensuring consistent spacing around symbols like # and -.
 */
export function normalizeAddress(address: string): string {
    if (!address) return '';

    let normalized = address;

    // 1. Map of common Colombian abbreviations
    const replacements = [
        { regex: /\bcll?\b\.?/gi, replacement: 'Calle' },
        { regex: /\bcra\b\.?/gi, replacement: 'Carrera' },
        { regex: /\bcrra\b\.?/gi, replacement: 'Carrera' },
        { regex: /\bkrr?\b\.?/gi, replacement: 'Carrera' },
        { regex: /\bav\b\.?/gi, replacement: 'Avenida' },
        { regex: /\bavda\b\.?/gi, replacement: 'Avenida' },
        { regex: /\bnte\b\.?/gi, replacement: 'Norte' },
        { regex: /\bdg\b\.?/gi, replacement: 'Diagonal' },
        { regex: /\bdiag\b\.?/gi, replacement: 'Diagonal' },
        { regex: /\btv\b\.?/gi, replacement: 'Transversal' },
        { regex: /\btrv\b\.?/gi, replacement: 'Transversal' },
        { regex: /\btrans\b\.?/gi, replacement: 'Transversal' },
        { regex: /\bap\b\.?/gi, replacement: 'Apartamento' },
        { regex: /\bapto\b\.?/gi, replacement: 'Apartamento' },
    ];

    replacements.forEach(({ regex, replacement }) => {
        normalized = normalized.replace(regex, replacement);
    });

    // 2. Normalize symbols (# and -)
    // Rule: Ensure a space before # and NO space after # (e.g. " #11b")
    normalized = normalized.replace(/\s*#\s*/g, ' #');

    // Rule: Remove spaces around - (e.g. "11b-288")
    normalized = normalized.replace(/\s*-\s*/g, '-');

    // 3. Clean extra spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}
