import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, favorite_genre } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    db.run(
      `INSERT INTO users (username, email, password, favorite_genre)
       VALUES (?, ?, ?, ?)`,
      [username, email, hashedPassword, favorite_genre || 'Action'],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res
              .status(400)
              .json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }

        // Create JWT token
        const token = jwt.sign(
          { userId: this.lastID, username },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.status(201).json({
          message: 'User registered successfully',
          token,
          user: {
            id: this.lastID,
            username,
            email,
            favorite_genre: favorite_genre || 'Action'
          }
        });
      }
    );
  } catch (error) {
console.error('❌ Database error:', err);
  res.status(500).json({ error: err.message });  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password required' });
    }

    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.json({
          message: 'Login successful',
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            favorite_genre: user.favorite_genre
          }
        });
      }
    );
  } catch (error) {
console.error('❌ Database error:', err);
  res.status(500).json({ error: err.message });  }
});

export default router;
