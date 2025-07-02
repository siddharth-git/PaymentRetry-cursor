function processPayment(amount) {
  // Simulate a 30% failure rate
  if (Math.random() < 0.8) {
    throw new Error('Payment failed due to provider error.');
  }
  return { success: true, amount };
}

module.exports = { processPayment };