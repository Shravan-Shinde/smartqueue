const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');
const { optionalAuth } = require('../middleware/authMiddleware');

// Optional auth so token lookup can identify if current customer owns the searched ticket
router.get('/global', optionalAuth, globalSearch);

module.exports = router;
