const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createUser, findUserByEmail } = require('../models/userModel');

function createToken(user) {
  return jwt.sign(
    { id: user.User_ID, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

async function register(req, res, next) {
  try {
    const { name, email, password, role = 'pharmacist' } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error('Name, email and password are required');
    }

    if (typeof name !== 'string' || name.trim().length < 2) {
      res.status(400);
      throw new Error('Name must be at least 2 characters');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).toLowerCase())) {
      res.status(400);
      throw new Error('Please provide a valid email address');
    }

    if (String(password).length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters');
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      res.status(409);
      throw new Error('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = await createUser({ name, email, password: hashedPassword, role });
    const user = { User_ID: id, name, email, role };

    res.status(201).json({
      user,
      token: createToken(user)
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error('Email and password are required');
    }

    const user = await findUserByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    res.json({
      user: {
        User_ID: user.User_ID,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token: createToken(user)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login };

