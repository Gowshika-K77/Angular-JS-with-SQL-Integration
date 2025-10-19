const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Open SQLite DB and enable foreign keys
const db = new sqlite3.Database('./events.db', (err) => {
  if (err) {
    console.error('Failed to connect to DB:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    db.run('PRAGMA foreign_keys = ON');
  }
});

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `);
});

// --- EVENT ROUTES ---

// Get all events
app.get('/events', (req, res) => {
  db.all('SELECT * FROM events', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Add event
app.post('/events', (req, res) => {
  const { name, date, location } = req.body;
  if (!name || !date || !location) {
    return res.status(400).json({ error: 'Please provide name, date, and location.' });
  }

  const sql = `INSERT INTO events (name, date, location) VALUES (?, ?, ?)`;
  db.run(sql, [name, date, location], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, message: 'Event added successfully.' });
  });
});

// Delete event (and participants cascade)
app.delete('/events/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM events WHERE id = ?', id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Event not found.' });
    res.json({ message: 'Event deleted successfully.' });
  });
});

// --- PARTICIPANT ROUTES ---

// Get participants for an event
app.get('/events/:eventId/participants', (req, res) => {
  const eventId = req.params.eventId;
  db.all('SELECT * FROM participants WHERE event_id = ?', eventId, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add participant to event
app.post('/events/:eventId/participants', (req, res) => {
  const eventId = req.params.eventId;
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Please provide participant name and email.' });

  // Check event exists
  db.get('SELECT id FROM events WHERE id = ?', eventId, (err, event) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const sql = `INSERT INTO participants (event_id, name, email) VALUES (?, ?, ?)`;
    db.run(sql, [eventId, name, email], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Participant added successfully.' });
    });
  });
});

// Delete participant
app.delete('/participants/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM participants WHERE id = ?', id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Participant not found.' });
    res.json({ message: 'Participant deleted successfully.' });
  });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
