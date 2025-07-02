const { processPayment } = require('../../mockPaymentProvider');

module.exports = {
  name: 'stripe',
  process: processPayment,
}; 