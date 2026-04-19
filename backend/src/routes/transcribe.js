const express = require('express');
const router = express.Router();

// Placeholder route for Phase 2
router.post('/', async (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

router.get('/:jobId', async (req, res) => {
  res.status(501).json({ error: 'Not yet implemented' });
});

module.exports = router;
