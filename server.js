/**
 * Simple Node.js server for the QR Code Generator
 * Serves static files and provides a logging endpoint
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'qrcode_logs.txt');

// Rate limiting for API endpoints - prevents abuse
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(express.json());

// Serve only specific directories/files to avoid exposing sensitive files
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
app.use(express.static(__dirname, {
    index: 'index.html',
    dotfiles: 'deny', // Deny access to dotfiles like .env, .git, etc.
}));

/**
 * Logging endpoint - receives QR code generation events
 * Logs to both console (terminal) and file
 * Rate limited to prevent abuse
 */
app.post('/api/log-qr', apiLimiter, (req, res) => {
    const { url } = req.body;
    
    // Validate input
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Invalid URL parameter' });
    }
    
    // Get client IP address (handles proxy headers)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.socket.remoteAddress || 
                     'unknown';
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] URL: ${url} | IP: ${clientIp}\n`;
    
    // Log to console (terminal)
    console.log(`QR Code Generated - ${logEntry.trim()}`);
    
    // Log to file asynchronously (non-blocking)
    fs.appendFile(LOG_FILE, logEntry, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
            return res.status(500).json({ error: 'Failed to log' });
        }
        res.json({ success: true, message: 'Logged successfully' });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`QR Code Generator server running on http://localhost:${PORT}`);
    console.log(`Logs will be written to: ${LOG_FILE}`);
});
