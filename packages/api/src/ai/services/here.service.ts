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

    async validateAddress(address: string): Promise<{ isValid: boolean; formattedAddress?: string; details?: any }> {
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
                // Consider it valid if it has at least a house number or is a specific enough address
                // You can adjust this logic based on how strict you want to be
                const isValid = bestMatch.resultType === 'houseNumber' || bestMatch.resultType === 'street';

                const result = {
                    isValid,
                    formattedAddress: bestMatch.address.label,
                    details: bestMatch,
                };

                console.log('[HERE VALIDATION]', JSON.stringify(result, null, 2));
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
