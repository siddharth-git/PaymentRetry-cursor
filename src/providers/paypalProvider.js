const { processPayment } = require('../../mockPaymentProvider');

module.exports = {
  name: 'paypal',
  process: processPayment,
}; 