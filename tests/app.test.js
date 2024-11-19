const chai = require('chai');
const expect = chai.expect;

describe('Sample Application Tests', () => {
    it('should always pass', () => {
        expect(true).to.be.true;
    });

    it('should return a JSON response', () => {
        const response = {
            message: 'Hello, DevOps!',
            hostname: require('os').hostname(),
            timestamp: new Date().toISOString()
        };

        expect(response).to.be.an('object');
        expect(response.message).to.equal('Hello, DevOps!');
    });
});