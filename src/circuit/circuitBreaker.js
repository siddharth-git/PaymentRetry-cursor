class CircuitBreaker {
  constructor({ failureThreshold = 5, cooldown = 30000 } = {}) {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.openedAt = null;
    this.failureThreshold = failureThreshold;
    this.cooldown = cooldown;
  }

  canAttempt() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt >= this.cooldown) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    if (this.state === 'HALF_OPEN') return true;
    return false;
  }

  onResult(success) {
    if (this.state === 'CLOSED') {
      if (success) {
        this.failureCount = 0;
      } else {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
          this.state = 'OPEN';
          this.openedAt = Date.now();
        }
      }
    } else if (this.state === 'HALF_OPEN') {
      if (success) {
        this.state = 'CLOSED';
        this.failureCount = 0;
      } else {
        this.state = 'OPEN';
        this.openedAt = Date.now();
        this.failureCount = this.failureThreshold;
      }
    }
  }
}

module.exports = CircuitBreaker; 