const express = require('express');
const { processPayment } = require('./mockPaymentProvider');

const app = express();
app.use(express.json());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Circuit Breaker State
const CIRCUIT_BREAKER = {
  failureCount: 0,
  state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
  openedAt: null,
  cooldown: 30000, // 30 seconds
  failureThreshold: 5,
};

// Track payment attempt history for summary
const ATTEMPT_HISTORY = [];
const HISTORY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function recordAttempt(success, error, timestamp = Date.now()) {
  ATTEMPT_HISTORY.push({ success, error, timestamp });
  // Remove old entries
  while (ATTEMPT_HISTORY.length && ATTEMPT_HISTORY[0].timestamp < Date.now() - HISTORY_WINDOW_MS) {
    ATTEMPT_HISTORY.shift();
  }
}

function mockLLMSummary(history, circuitBreakerState) {
  const now = Date.now();
  const recent = history.filter(h => h.timestamp >= now - HISTORY_WINDOW_MS);
  const total = recent.length;
  const failures = recent.filter(h => !h.success).length;
  const failureRate = total ? Math.round((failures / total) * 100) : 0;
  let breakerMsg = '';
  if (circuitBreakerState.state === 'OPEN') {
    breakerMsg = 'The circuit breaker was triggered and is currently open, blocking new attempts.';
  } else if (circuitBreakerState.state === 'HALF_OPEN') {
    breakerMsg = 'The circuit breaker is half-open and testing recovery.';
  } else {
    breakerMsg = 'The circuit breaker is closed and operating normally.';
  }
  return `In the last 10 minutes, ${failureRate}% of payment attempts failed due to provider instability. ${breakerMsg}`;
}

async function attemptPaymentWithRetry(paymentData, maxRetries = 3, backoffs = [500, 1000, 2000]) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = processPayment(paymentData.amount);
      return { success: true, result };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await sleep(backoffs[attempt]);
      }
    }
  }
  return { success: false, error: lastError.message };
}

function logFailedTransaction(paymentData, reason) {
  // For now, just log to the console. In real-world, log to a file or DB.
  console.error('Failed transaction:', { ...paymentData, reason });
}

function canAttemptPayment() {
  if (CIRCUIT_BREAKER.state === 'CLOSED') return true;
  if (CIRCUIT_BREAKER.state === 'OPEN') {
    // Check if cooldown has passed
    if (Date.now() - CIRCUIT_BREAKER.openedAt >= CIRCUIT_BREAKER.cooldown) {
      CIRCUIT_BREAKER.state = 'HALF_OPEN';
      return true; // Allow one test request
    }
    return false;
  }
  if (CIRCUIT_BREAKER.state === 'HALF_OPEN') {
    // Only allow one test request, then block until result
    return true;
  }
  return false;
}

function onPaymentResult(success) {
  if (CIRCUIT_BREAKER.state === 'CLOSED') {
    if (success) {
      CIRCUIT_BREAKER.failureCount = 0;
    } else {
      CIRCUIT_BREAKER.failureCount++;
      if (CIRCUIT_BREAKER.failureCount >= CIRCUIT_BREAKER.failureThreshold) {
        CIRCUIT_BREAKER.state = 'OPEN';
        CIRCUIT_BREAKER.openedAt = Date.now();
        console.warn('Circuit breaker OPENED');
      }
    }
  } else if (CIRCUIT_BREAKER.state === 'HALF_OPEN') {
    if (success) {
      CIRCUIT_BREAKER.state = 'CLOSED';
      CIRCUIT_BREAKER.failureCount = 0;
      console.info('Circuit breaker CLOSED after successful test request');
    } else {
      CIRCUIT_BREAKER.state = 'OPEN';
      CIRCUIT_BREAKER.openedAt = Date.now();
      CIRCUIT_BREAKER.failureCount = CIRCUIT_BREAKER.failureThreshold; // keep at threshold
      console.warn('Circuit breaker REOPENED after failed test request');
    }
  }
}

app.post('/pay', async (req, res) => {
  const { amount, currency, source } = req.body;
  const paymentData = { amount, currency, source };

  if (!canAttemptPayment()) {
    recordAttempt(false, 'Circuit breaker open');
    res.status(503).json({ success: false, error: 'Payment service temporarily unavailable (circuit breaker open).' });
    return;
  }

  const result = await attemptPaymentWithRetry(paymentData);
  onPaymentResult(result.success);
  recordAttempt(result.success, result.success ? null : result.error);

  if (result.success) {
    res.json({ success: true, result: result.result });
  } else {
    logFailedTransaction(paymentData, result.error);
    res.status(500).json({ success: false, error: result.error });
  }
});

app.get('/status/summary', (req, res) => {
  const summary = mockLLMSummary(ATTEMPT_HISTORY, CIRCUIT_BREAKER);
  res.json({ summary });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 