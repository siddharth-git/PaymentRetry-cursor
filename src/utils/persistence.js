const fs = require('fs');
const STATE_FILE = 'state.json';

function saveState(state) {
  fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), err => {
    if (err) console.error('Failed to save state:', err);
  });
}

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }
  return null;
}

module.exports = { saveState, loadState }; 