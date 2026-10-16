const express = require('express');
const router = express.Router();
const { getLiveCrowdSnapshot } = require('../controllers/adminLiveCrowdController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorizeRoles('ADMIN'));

router.get('/', getLiveCrowdSnapshot);

module.exports = router;
