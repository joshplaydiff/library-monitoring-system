const express = require('express');
const router = express.Router();
const authRouter = require('./auth');

router.use('/login', authRouter);
router.use('/me', authRouter);

module.exports = router;