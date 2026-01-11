import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { normalizeAddress } from './address-utils';

@Injectable()
export class GeocodingService {
    private readonly logger = new Logger(GeocodingService.name);
    private readonly apiKey: string;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService
    ) {
        this.apiKey = this.configService.get<string>('HERE_API_KEY');
        if (!this.apiKey) {
            this.logger.warn('HERE_API_KEY is not set in environment variables');
        }
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    /**
     * Geocodes an address using HERE Maps API
       */
    private async geocodeWithHERE(address: string): Promise<any[]> {
        if (!this.apiKey) return [];
        try {
            const response = await axios.get('https://geocode.search.hereapi.com/v1/geocode', {
                params: {
                    q: address,
                    apiKey: this.apiKey,
                },
            });
            return response.data.items || [];
        } catch (error) {
            this.logger.error(`Error with HERE API for "${address}": ${error.message}`);
            return [];
        }
    }

    async validateAndAssignLocation(address: string, tenantId: string) {
        if (!this.apiKey) {
            this.logger.error('HERE_API_KEY is missing');
            throw new BadRequestException('Servicio de geocodificación no disponible');
        }

        this.logger.log(`Validating address: "${address}" for tenant: ${tenantId}`);

        const normalizedAddress = normalizeAddress(address);
        if (normalizedAddress.toLowerCase() !== address.toLowerCase()) {
            this.logger.log(`Address normalized for search: "${address}" -> "${normalizedAddress}"`);
        }

        // Fetch all locations/cities for this tenant once
        const locations = await this.prisma.location.findMany({
            where: { tenantId },
        });

        const operatingCities = [...new Set(locations.map(l => l.city).filter(Boolean))];
        this.logger.log(`Operating cities: ${operatingCities.join(', ')}`);

        // 1. Try geocoding the address as provided
        let results = await this.geocodeWithHERE(normalizedAddress);

        // 2. Address Enrichment: Try geocoding by appending each operating city
        // This helps resolve cases like "Calle 13..." appearing in both Cali and Bogotá
        for (const city of operatingCities) {
            if (normalizedAddress.toLowerCase().includes(city.toLowerCase())) continue; // Skip if city already in address

            const enrichedAddress = `${normalizedAddress}, ${city}, Colombia`;
            this.logger.log(`Trying enriched address: "${enrichedAddress}"`);
            const enrichedResults = await this.geocodeWithHERE(enrichedAddress);
            results = [...results, ...enrichedResults];
        }

        if (results.length === 0) {
            this.logger.warn(`No results found for address: "${address}"`);
            throw new BadRequestException('Dirección no encontrada');
        }

        // Filter results that match our operating area and have decent scores
        const validMatches = results.filter(item => {
            const city = item.address.city || item.address.district || item.address.locality;
            const score = item.scoring?.queryScore || 0;

            // Check if result city matches any of our operating cities
            const matchesCity = operatingCities.some(oc =>
                city?.toLowerCase().includes(oc.toLowerCase()) ||
                oc.toLowerCase().includes(city?.toLowerCase())
            );

            return matchesCity && score > 0.5;
        });

        if (validMatches.length === 0) {
            this.logger.warn(`No results matching operating cities found for "${address}"`);
            throw new BadRequestException(`Dirección fuera de la zona de cobertura (Ciudades permitidas: ${operatingCities.join(', ')})`);
        }

        // Sort by score and find closest branch for the best match
        const bestMatch = validMatches.sort((a, b) => (b.scoring?.queryScore || 0) - (a.scoring?.queryScore || 0))[0];
        const lat = bestMatch.position.lat;
        const lng = bestMatch.position.lng;
        const matchCity = bestMatch.address.city || bestMatch.address.district || bestMatch.address.locality;

        this.logger.log(`Best match found in ${matchCity}: ${lat}, ${lng} (Score: ${bestMatch.scoring?.queryScore})`);

        // Find closest branch
        let closestLoc = null;
        let minDistance = Infinity;

        for (const loc of locations) {
            if (loc.latitude && loc.longitude) {
                const dist = this.calculateDistance(loc.latitude, loc.longitude, lat, lng);
                this.logger.log(`Distance to "${loc.name}": ${dist.toFixed(2)} km`);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestLoc = loc;
                }
            }
        }

        if (!closestLoc) {
            this.logger.log('No branches with coordinates found, matching by city name...');
            closestLoc = locations.find(loc =>
                loc.city?.toLowerCase() === matchCity?.toLowerCase() ||
                matchCity?.toLowerCase().includes(loc.city?.toLowerCase())
            );
        }

        if (!closestLoc) {
            throw new BadRequestException('No hay sedes disponibles para esta ubicación');
        }

        this.logger.log(`Assigned to branch: "${closestLoc.name}" (ID: ${closestLoc.id}) at ${minDistance !== Infinity ? minDistance.toFixed(2) : 'unknown'} km`);

        return {
            isValid: true,
            coords: { lat, lng },
            distance: minDistance !== Infinity ? minDistance : null,
            assignedLocation: {
                id: closestLoc.id,
                name: closestLoc.name,
                city: closestLoc.city,
                formattedAddress: bestMatch.address.label
            },
        };
    }
}
