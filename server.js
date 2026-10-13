const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { runMigrations } = require('./db/migrate');
const { seed } = require('./db/seed');

const authRoutes    = require('./routes/auth');
const studentRoutes = require('./routes/student');
const facultyRoutes = require('./routes/faculty');
const hodRoutes     = require('./routes/hod');
const projectRoutes     = require('./routes/projects');
const seminarRoutes     = require('./routes/seminar');
const seminarWorkflowRoutes = require('./routes/seminarWorkflow');
const coordinatorRoutes = require('./routes/coordinators');
const clubRoutes        = require('./routes/clubs');
const magazineRoutes    = require('./routes/magazines');
const feedbackRoutes    = require('./routes/feedback');
const notificationRoutes = require('./routes/notifications');
const whatsappService   = require('./services/whatsappService');

const app = express();

// ─── Security & parsing ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Allow inline scripts/styles in production SPA build
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (process.env.CLIENT_URL) {
      const allowedOrigins = process.env.CLIENT_URL.split(',').map(u => u.trim());
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/student',      studentRoutes);
app.use('/api/faculty',      facultyRoutes);
app.use('/api/hod',          hodRoutes);
app.use('/api/projects',     projectRoutes);
app.use('/api/seminar/workflow', seminarWorkflowRoutes);
app.use('/api/seminar',      seminarRoutes);
app.use('/api/coordinators', coordinatorRoutes);
app.use('/api/clubs',        clubRoutes);
app.use('/api/magazines',    magazineRoutes);
app.use('/api/feedback',     feedbackRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: '1.0.0' });
});

// ─── Production Static Client Serving & SPA Fallback ─────────────────────────
const clientDistPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// ─── 404 for Unmatched API Routes ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 5000;

async function start() {
  try {
    await runMigrations();

    // Auto-seed in development if no users exist
    const pool = require('./db/pool');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count, 10) === 0) {
      console.log('[Boot] No users found. Running seed...');
      await seed();
    }

    const server = app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'production'}`);

      if (process.env.WHATSAPP_ENABLED !== 'false') {
        whatsappService.initWhatsApp().catch(err => {
          console.warn('[WhatsApp] Startup warning:', err.message);
        });
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${PORT} is already in use! Is the server already running in another terminal?`);
      } else {
        console.error('[Server] Error:', err.message);
      }
      process.exit(1);
    });

    // Graceful Shutdown Handlers
    const shutdown = async (signal) => {
      console.log(`[Server] ${signal} signal received: closing HTTP server.`);
      server.close(async () => {
        try {
          await pool.end();
          console.log('[Server] Database pool connections closed.');
        } catch (poolErr) {
          console.error('[Server] Error closing database pool:', poolErr);
        }
        process.exit(0);
      });

      // Force shutdown after 10s timeout
      setTimeout(() => {
        console.error('[Server] Could not close connections in time, forcefully shutting down.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    if (err.code === 'ECONNREFUSED' || (err.errors && err.errors.some(e => e.code === 'ECONNREFUSED'))) {
      console.error('[Boot] Startup failed: Could not connect to remote PostgreSQL database. Please ensure your cloud database is online and DATABASE_URL is valid.');
    } else {
      console.error('[Boot] Startup failed:', err.message || err);
    }
    process.exit(1);
  }
}

start();
