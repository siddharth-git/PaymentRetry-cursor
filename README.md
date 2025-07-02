# Payment Retry & Circuit Breaker Demo

This project demonstrates a Node.js payment API with retry logic, circuit breaker, observability, and persistence to disk for local development.

## Features
- Mock payment provider with random failures
- Retry logic with exponential backoff
- Circuit breaker pattern
- Observability endpoints (/metrics, /status, /status/summary)
- State persistence to disk (recovers after restart)

## Local Setup

### Prerequisites
- Node.js (v16+ recommended)
- npm

### Install dependencies
```sh
npm install
```

### Start the server
```sh
npm run dev   # For auto-reload with nodemon
# or
npm start     # For normal start
```

## Endpoints

### 1. POST `/pay`
Attempts to process a payment with retry and circuit breaker logic.

**Request Body:**
```json
{
  "amount": 5000,
  "currency": "USD",
  "source": "tok_test"
}
```

**Responses:**
- `200 OK` (success):
  ```json
  {
    "success": true,
    "result": { "success": true, "amount": 5000 }
  }
  ```
- `500/503` (failure or circuit breaker open):
  ```json
  {
    "success": false,
    "error": "...reason..."
  }
  ```

### 2. GET `/status`
Returns the current circuit breaker state, failure count, and last failure timestamp.

**Response:**
```json
{
  "circuitState": "open|closed|half_open",
  "failureCount": 3,
  "lastFailure": "2025-05-05T22:12:00Z"
}
```

### 3. GET `/status/summary`
Returns a natural-language summary of recent payment failures, retry history, and circuit breaker status.

**Response:**
```json
{
  "summary": "In the last 10 minutes, 70% of payment attempts failed due to provider instability. The circuit breaker was triggered and is currently open, blocking new attempts."
}
```

### 4. GET `/metrics`
Returns observability metrics for retry counts, success/failure rates, and circuit breaker transitions.

**Response:**
```json
{
  "retryCount": 5,
  "totalAttempts": 10,
  "totalSuccesses": 3,
  "totalFailures": 7,
  "successRate": "30.00%",
  "failureRate": "70.00%",
  "circuitTransitions": [
    { "from": "closed", "to": "open", "at": "2025-05-05T22:12:00Z" }
  ]
}
```

## State Persistence
- The app saves its state to `state.json` in the project root after every change.
- On restart, it restores state from this file.

## Notes
- The mock payment provider fails randomly 30% of the time.
- Circuit breaker opens after 5 consecutive failures, blocks requests for 30 seconds, then allows a test request.
- All logic is implemented in `index.js` and `mockPaymentProvider.js`.

---

Feel free to modify and extend for your own experiments! 