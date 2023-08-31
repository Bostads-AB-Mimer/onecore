import { getApartmentInfo } from '../src/services/property-info-service/adapters/contech-os-adapter';

async function testApartmentInfo() {
    try {
        const response = await getApartmentInfo();
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error);
    }
}

testApartmentInfo();