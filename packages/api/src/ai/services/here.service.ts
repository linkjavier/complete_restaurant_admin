import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class HereService {
    private readonly logger = new Logger(HereService.name);
    private readonly apiKey: string;

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('HERE_API_KEY');
        if (!this.apiKey) {
            this.logger.warn('HERE_API_KEY is not set in environment variables');
        }
    }

    async validateAddress(address: string): Promise<{ isValid: boolean; formattedAddress?: string; lat?: number; lng?: number; details?: any }> {
        if (!this.apiKey) {
            this.logger.error('HERE_API_KEY is missing, cannot validate address');
            return { isValid: false };
        }

        try {
            this.logger.log(`Validating address: ${address}`);
            const response = await axios.get('https://geocode.search.hereapi.com/v1/geocode', {
                params: {
                    q: address,
                    apiKey: this.apiKey,
                },
            });

            const items = response.data.items;
            if (items && items.length > 0) {
                const bestMatch = items[0];
                const score = bestMatch.scoring?.queryScore || 0;
                const houseNumberScore = bestMatch.scoring?.fieldScore?.houseNumber || 0;
                const houseNumberFallback = bestMatch.houseNumberFallback === true;

                // Thresholds:
                // 1. queryScore > 0.65 (indicates overall good match)
                // 2. If it's a houseNumber type, houseNumberScore should be reasonable (> 0.5)
                // 3. Avoid houseNumberFallback if we want precision for delivery
                let isValid = (bestMatch.resultType === 'houseNumber' || bestMatch.resultType === 'street' || bestMatch.resultType === 'locality') && score > 0.65;

                // Extra strictness for delivery addresses:
                if (bestMatch.resultType === 'houseNumber' && (houseNumberFallback || houseNumberScore < 0.5)) {
                    console.log(`[HERE] Rehusando houseNumber con score bajo o fallback: score=${score}, hnScore=${houseNumberScore}, fallback=${houseNumberFallback}`);
                    isValid = false;
                }

                const result = {
                    isValid,
                    formattedAddress: bestMatch.address.label,
                    lat: bestMatch.position.lat,
                    lng: bestMatch.position.lng,
                    details: bestMatch,
                };

                console.log(`[HERE VALIDATION] Result (Score: ${score}):`, JSON.stringify(result, null, 2));
                return result;
            }

            console.log('[HERE VALIDATION] No results found for:', address);
            return { isValid: false };
        } catch (error) {
            this.logger.error(`Error validating address with HERE API: ${error.message}`);
            return { isValid: false };
        }
    }
}
