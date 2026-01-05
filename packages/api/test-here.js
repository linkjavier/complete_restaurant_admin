const axios = require('axios');
require('dotenv').config();

async function testHereValidation(address) {
    const apiKey = process.env.HERE_API_KEY;
    if (!apiKey) {
        console.error('HERE_API_KEY not found in .env');
        return;
    }

    console.log(`Testing address: "${address}"`);
    try {
        const response = await axios.get('https://geocode.search.hereapi.com/v1/geocode', {
            params: {
                q: address,
                apiKey: apiKey,
            },
        });

        const items = response.data.items;
        if (items && items.length > 0) {
            const bestMatch = items[0];
            const isValid = bestMatch.resultType === 'houseNumber' || bestMatch.resultType === 'street';
            console.log('Result:', {
                isValid,
                formattedAddress: bestMatch.address.label,
                resultType: bestMatch.resultType,
            });
        } else {
            console.log('No results found.');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function runTests() {
    await testHereValidation('Calle 10 # 5-10, Bogota, Colombia');
    console.log('---');
    await testHereValidation('asdfasdfasdfasdfasdf');
}

runTests();
