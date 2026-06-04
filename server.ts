import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'db.json');

app.use(cors({
  origin: [
    'https://smartapartmentservices.vercel.app',
    'http://localhost:5173'
  ],
  credentials: true
}));

app.use(express.json());

// Helper for cryptography
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_secure_salt_flavor').digest('hex');
}

// Helpers for validation
function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase();
  
  // Basic format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  const domain = trimmed.split('@')[1];
  
  // Block temporary/disposable domains
  const disposableDomains = [
    'mailinator.com', 'yopmail.com', 'tempmail.com', '10minutemail.com', 
    'guerrillamail.com', 'sharklasers.com', 'dispostable.com', 'getairmail.com', 
    'burnermail.io', 'trashmail.com'
  ];
  if (disposableDomains.includes(domain)) {
    return { valid: false, error: 'Temporary or disposable email services are blocked' };
  }
  
  // Only allow gmail.com
  if (domain !== 'gmail.com') {
    return { valid: false, error: 'Registration is restricted to gmail.com email addresses only' };
  }
  
  return { valid: true };
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 uppercase letter (A–Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 lowercase letter (a–z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 number (0–9).' };
  }
  if (!/[@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?!~`]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 special character (e.g. @, #, $, %, &).' };
  }
  return { valid: true };
}

// Initialize Gemini
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Ensure database file exits or seed it
function getInitialData() {
  return {
    users: [],
    workers: [],
    complaints: [],
    qrLogs: [],
    resetTokens: []
  };
}

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const data = getInitialData();
      data.users = data.users.map((u: any) => ({
        ...u,
        password_hash: u.password_hash || hashPassword('Society123!')
      }));
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
      return data;
    }
    const val = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(val);
    
    let modified = false;
    if (!parsed.resetTokens) {
      parsed.resetTokens = [];
      modified = true;
    }
    
    // Migrate pre-seeded users to ensure they have default Society123! passwords
    parsed.users = parsed.users.map((u: any) => {
      if (!u.password_hash) {
        u.password_hash = hashPassword('Society123!');
        modified = true;
      }
      return u;
    });
    
    if (modified) {
      writeDB(parsed);
    }
    return parsed;
  } catch (error) {
    console.error('Error reading database file, resetting', error);
    const data = getInitialData();
    data.users = data.users.map((u: any) => ({
      ...u,
      password_hash: u.password_hash || hashPassword('Society123!')
    }));
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }
}

function writeDB(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing database file', err);
  }
}

// Simple authentication middleware using custom headers for testing roles out of the box
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): any {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Please switch role or login.' });
  }
  const userId = authHeader.split(' ')[1];
  const db = readDB();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'User session not found.' });
  }
  (req as any).user = user;
  next();
}

// Google OAuth Endpoints
app.get('/api/auth/google/url', (req: express.Request, res: express.Response): any => {
  const { role, block, floor, door_no, skill_type, phone, name } = req.query;
  
  // Construct the state payload
  const stateData = {
    role: role || 'resident',
    block: block || 'A',
    floor: floor || '1',
    door_no: door_no || '101',
    skill_type: skill_type || 'Other',
    phone: phone || '',
    name: name || '',
    created_at: new Date().toISOString()
  };
  
  const stateStr = Buffer.from(JSON.stringify(stateData)).toString('base64');
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const appUrl = (process.env.APP_URL || `${protocol}://${host}`).replace(/\/$/, "");
  const redirectUri = `${appUrl}/auth/google/callback`;
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    const simulateUrl = `/auth/google/simulate?state=${encodeURIComponent(stateStr)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    return res.json({ url: simulateUrl });
  }
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: stateStr,
    access_type: 'offline',
    prompt: 'consent'
  }).toString();
  
  res.json({ url: googleAuthUrl });
});

app.get('/auth/google/simulate', (req: express.Request, res: express.Response) => {
  const { state, redirect_uri } = req.query;
  
  let stateData: any = {};
  if (state) {
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
    } catch (e) {}
  }
  const roleName = stateData.role === 'worker' ? 'Technical Worker (' + (stateData.skill_type || 'Other') + ')' : 'Resident User';
  
  res.send(`
    <html>
      <head>
        <title>Sign in with Google - SecureSociety Developer Simulator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #f0f4f9;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: #1f1f1f;
          }
          .container {
            background-color: #ffffff;
            border-radius: 28px;
            padding: 40px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.05);
            box-sizing: border-box;
          }
          .google-logo {
            display: flex;
            justify-content: center;
            margin-bottom: 24px;
          }
          .google-logo svg {
            width: 74px;
            height: 24px;
          }
          h1 {
            font-size: 24px;
            font-weight: 400;
            margin: 0 0 8px 0;
            text-align: center;
            color: #1f1f1f;
          }
          .subtitle {
            font-size: 16px;
            color: #444746;
            margin-bottom: 28px;
            text-align: center;
          }
          .alert-badge {
            background-color: #e8f0fe;
            border: 1px solid #d2e3fc;
            color: #1967d2;
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13px;
            line-height: 1.5;
            margin-bottom: 24px;
          }
          .profile-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 28px;
          }
          .profile-button {
            display: flex;
            align-items: center;
            gap: 12px;
            background: none;
            border: 1px solid #c4c7c5;
            border-radius: 100px;
            padding: 14px 24px;
            font-size: 14px;
            font-weight: 500;
            color: #1f1f1f;
            cursor: pointer;
            transition: background-color 0.2s, border-color 0.2s;
            text-align: left;
            width: 100%;
          }
          .profile-button:hover {
            background-color: #f7f9fc;
            border-color: #a8aaa9;
          }
          .profile-avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background-color: #334155;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 13px;
          }
          .profile-info {
            flex-grow: 1;
          }
          .profile-email {
            font-size: 12px;
            color: #444746;
            display: block;
            margin-top: 2px;
          }
          .divider {
            display: flex;
            align-items: center;
            text-align: center;
            color: #747775;
            font-size: 12px;
            margin: 20px 0;
          }
          .divider::before, .divider::after {
            content: '';
            flex: 1;
            border-bottom: 1px solid #e3e3e3;
          }
          .divider:not(:empty)::before {
            margin-right: .5em;
          }
          .divider:not(:empty)::after {
            margin-left: .5em;
          }
          .custom-form {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .input-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .input-group label {
            font-size: 12px;
            font-weight: 500;
            color: #444746;
          }
          input {
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid #c4c7c5;
            font-size: 14px;
            color: #1f1f1f;
            background-color: transparent;
            outline: none;
            transition: border-color 0.2s;
          }
          input:focus {
            border-color: #0b57d0;
            border-width: 2px;
            padding: 11px 15px;
          }
          .submit-button {
            background-color: #0b57d0;
            color: white;
            border: none;
            border-radius: 100px;
            padding: 14px 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s, box-shadow 0.2s;
            margin-top: 8px;
            text-align: center;
          }
          .submit-button:hover {
            background-color: #0842a0;
            box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1.5px 3px 1px rgba(60,64,67,0.15);
          }
          .footer {
            font-size: 12px;
            color: #747775;
            margin-top: 28px;
            text-align: center;
            line-height: 1.5;
          }
          .tag {
            background-color: #f0f4f9;
            color: #444746;
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            text-transform: uppercase;
            align-self: flex-start;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="google-logo">
            <svg viewBox="0 0 74 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887c-.272 1.634-1.873 4.792-6.887 4.792-4.33 0-7.866-3.585-7.866-8s3.536-8 7.866-8c2.463 0 4.113 1.018 5.05 1.916l2.45-2.36C18.158 2.062 15.424 1 12.24 1 5.48 1 0 6.37 0 13s5.48 12 12.24 12c7.054 0 11.758-4.96 11.758-11.96 0-.806-.086-1.42-.19-1.755H12.24zm18.3 14.28c2.254 0 3.864-1.02 4.71-2.484h.084V24h3.696V9.432H35.34v8.52c0 1.992-.816 3.552-2.856 3.552-2.112 0-2.832-1.572-2.832-3.552V9.432H25.95v9.84c0 3.324 1.716 5.292 4.59 5.292zm14.802 0c2.724 0 4.164-1.764 4.512-2.616h.084V24h3.696V9.432h-3.696V20.28c0 1.944-.816 3.288-2.676 3.288-1.92 0-2.676-1.344-2.676-3.288V9.432h-3.696v11.136c0 3.252 1.548 4.716 4.452 4.716zm18.3 0c2.254 0 3.864-1.02 4.71-2.484h.084V24h3.696V9.432H68.44v8.52c0 1.992-.816 3.552-2.856 3.552-2.112 0-2.832-1.572-2.832-3.552V9.432H61.05v9.84c0 3.324 1.716 5.292 4.59 5.292z"/>
            </svg>
          </div>
          
          <h1>Sign in with Google</h1>
          <p class="subtitle">to continue to SecureSociety</p>
          
          <div class="alert-badge">
            <strong>Developer Mode Sandbox</strong>: This mock interface allows instant local and preview testing without manual client ID settings.
          </div>
          
          <div style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 11px; font-weight: bold; color: #747775; text-transform: uppercase;">Registering as:</span>
            <span class="tag">${roleName}</span>
          </div>

          <form class="custom-form" onsubmit="handleCustomSubmit(event)">
            <div class="input-group">
              <label for="custom-name">Google Account Name</label>
              <input type="text" id="custom-name" required placeholder="Shyam Royal" />
            </div>
            
            <div class="input-group">
              <label for="custom-email">Google Email Address (@gmail.com only)</label>
              <input type="email" id="custom-email" required placeholder="shyamroyal916kdm@gmail.com" />
            </div>
            
            <button type="submit" class="submit-button">Sign In / Sign Up</button>
          </form>
          
          <div class="footer">
            To use actual Google Sign-In, please set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your environment parameters.
          </div>
        </div>
        
        <script>
          const stateStr = "${state}";
          const redirectUri = "${redirect_uri}";
          
          function submitProfile(email, name) {
            window.location.href = "/api/auth/google/callback-mock?state=" + encodeURIComponent(stateStr) + "&email=" + encodeURIComponent(email) + "&name=" + encodeURIComponent(name);
          }
          
          function handleCustomSubmit(e) {
            e.preventDefault();
            const name = document.getElementById("custom-name").value;
            const email = document.getElementById("custom-email").value;
            
            if (!email.toLowerCase().endsWith("@gmail.com")) {
              alert("Error: Only valid @gmail.com accounts are permitted in SecureSociety registration.");
              return;
            }
            
            submitProfile(email, name);
          }
        </script>
      </body>
    </html>
  `);
});

async function handleUserGoogleAuth(email: string, name: string, stateData: any, res: express.Response) {
  const db = readDB();
  const emailLower = email.trim().toLowerCase();
  
  // Find if user already exists
  let user = db.users.find((u: any) => u.email.toLowerCase() === emailLower);
  
  if (!user) {
    const role = stateData.role || 'resident';
    const newId = role === 'admin' ? `admin_${Date.now()}` : role === 'worker' ? `worker_${Date.now()}` : `resident_${Date.now()}`;
    
    user = {
      id: newId,
      name: name || emailLower.split('@')[0],
      email: emailLower,
      role: role,
      phone: stateData.phone || '',
      password_hash: hashPassword(crypto.randomBytes(16).toString('hex'))
    };
    
    if (role === 'resident') {
      user.block = stateData.block || 'A';
      user.floor = stateData.floor || '1';
      user.door_no = stateData.door_no || '101';
    } else if (role === 'worker') {
      user.skill_type = stateData.skill_type || 'Other';
      
      const newWorker = {
        id: newId,
        name: user.name,
        phone: user.phone || '',
        skill_type: user.skill_type,
        availability_status: 'Available' as const,
        rating: 5.0,
        ratings_count: 0,
        reviews: []
      };
      db.workers.push(newWorker);
    }
    
    db.users.push(user);
    writeDB(db);
  }
  
  const { password_hash, ...safeUser } = user;
  
  res.send(`
    <html>
      <head>
        <title>Google Authentication Success</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f8fafc;
            color: #334155;
          }
          .card {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            max-width: 400px;
          }
          .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
            margin: 1rem auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h3>Authentication Successful</h3>
          <div class="spinner"></div>
          <p>Signing in to SecureSociety...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_AUTH_SUCCESS', 
              user: ${JSON.stringify(safeUser)} 
            }, '*');
            window.close();
          } else {
            localStorage.setItem('securesociety_user', JSON.stringify(${JSON.stringify(safeUser)}));
            window.location.href = '/';
          }
        </script>
      </body>
    </html>
  `);
}

app.get('/api/auth/google/callback-mock', async (req: express.Request, res: express.Response): Promise<any> => {
  const { email, name, state } = req.query;
  
  if (!email || !name) {
    return res.status(400).send('Missing email or name.');
  }
  
  let stateData: any = {};
  if (state) {
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
    } catch (e) {
      console.error('Error parsing simulated state:', e);
    }
  }
  
  await handleUserGoogleAuth(email as string, name as string, stateData, res);
});

app.get(['/auth/google/callback', '/auth/google/callback/'], async (req: express.Request, res: express.Response): Promise<any> => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: "${error}" }, '*');
              window.close();
            } else {
              window.location.href = '/?error=${encodeURIComponent(error.toString())}';
            }
          </script>
          <h3>Authentication Failed: ${error}</h3>
        </body>
      </html>
    `);
  }
  
  if (!code) {
    return res.status(400).send('Authorization code is missing.');
  }
  
  let stateData: any = {};
  if (state) {
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
    } catch (e) {
      console.error('Error parsing state:', e);
    }
  }
  
  try {
    const host = req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const appUrl = (process.env.APP_URL || `${protocol}://${host}`).replace(/\/$/, "");
    const redirectUri = `${appUrl}/auth/google/callback`;
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });
    
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange token');
    }
    
    const { access_token } = tokenData;
    
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    const profileData = await profileResponse.json();
    if (!profileResponse.ok) {
      throw new Error('Failed to retrieve Google user profile.');
    }
    
    const { email, name } = profileData;
    if (!email) {
      throw new Error('Google account is missing an email address.');
    }
    
    await handleUserGoogleAuth(email, name, stateData, res);
    
  } catch (err: any) {
    console.error('OAuth token exchange error:', err);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: "${err.message || 'Token exchange failed'}" }, '*');
              window.close();
            } else {
              window.location.href = '/?error=${encodeURIComponent(err.message || "Failed OAuth")}';
            }
          </script>
          <h3>Authentication Error</h3>
          <p>${err.message || 'Failed to exchange authorization token.'}</p>
        </body>
      </html>
    `);
  }
});

// Public API: Auth Login / Register
app.post('/api/auth/login', (req: express.Request, res: express.Response): any => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  const db = readDB();
  const user = db.users.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User not found. You can register as a resident.' });
  }
  
  // Verify matching hashed password
  const currentHash = hashPassword(password);
  if (user.password_hash !== currentHash) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  
  // Remove password_hash before returning to client
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.post('/api/auth/register', (req: express.Request, res: express.Response): any => {
  const { name, email, role, block, floor, door_no, phone, skill_type, password } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Validate email format and domains
  const emailVal = validateEmail(email);
  if (!emailVal.valid) {
    return res.status(400).json({ error: emailVal.error });
  }

  // Validate password security policy
  const passwordVal = validatePassword(password);
  if (!passwordVal.valid) {
    return res.status(400).json({ error: passwordVal.error });
  }

  const db = readDB();
  const existing = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'A user with this email already exists' });
  }

  const newId = role === 'admin' ? `admin_${Date.now()}` : role === 'worker' ? `worker_${Date.now()}` : `resident_${Date.now()}`;
  const newUser: any = {
    id: newId,
    name,
    email: email.trim().toLowerCase(),
    role,
    phone: phone || '',
    password_hash: hashPassword(password)
  };

  if (role === 'resident') {
    newUser.block = block;
    newUser.floor = floor;
    newUser.door_no = door_no;
  } else if (role === 'worker') {
    newUser.skill_type = skill_type || 'Other';
    // Add to workers list too!
    const newWorker = {
      id: newId,
      name,
      phone: phone || '',
      skill_type: skill_type || 'Other',
      availability_status: 'Available' as const,
      rating: 5.0,
      ratings_count: 0,
      reviews: []
    };
    db.workers.push(newWorker);
  }

  db.users.push(newUser);
  writeDB(db);

  // Return a safe user object
  const { password_hash, ...safeUser } = newUser;
  res.status(201).json({ user: safeUser });
});

// Forgot Password Flow API Route
app.post('/api/auth/forgot-password', (req: express.Request, res: express.Response): any => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  const db = readDB();
  const user = db.users.find((u: any) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'No account registered with this email address.' });
  }

  // Generate secure reset token
  const token = crypto.randomBytes(24).toString('hex');
  const durationMins = 15;
  const expiresAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString();

  if (!db.resetTokens) {
    db.resetTokens = [];
  }

  db.resetTokens.push({
    token,
    email: user.email.toLowerCase(),
    expiresAt,
    used: false
  });
  writeDB(db);

  // Send password reset link via simulated email
  // Format: http://localhost:3000/?resetToken=uuid
  const host = req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const resetLink = `${protocol}://${host}?resetToken=${token}`;

  console.log('----------------------------------------------------');
  console.log(`[SECURE SOCIETY EMAIL SENT]`);
  console.log(`To: ${user.email}`);
  console.log(`Subject: Password Reset Request Token`);
  console.log(`Reset Token: ${token}`);
  console.log(`Reset Link: ${resetLink}`);
  console.log(`Expires in: ${durationMins} minutes`);
  console.log('----------------------------------------------------');

  res.json({
    message: 'A secure reset link has been dispatched to your email.',
    resetToken: token,
    resetLink,
    email: user.email
  });
});

// Reset Password Core Action
app.post('/api/auth/reset-password', (req: express.Request, res: express.Response): any => {
  const { token, password } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Reset token is required' });
  }
  if (!password) {
    return res.status(400).json({ error: 'New password is required' });
  }

  const db = readDB();
  if (!db.resetTokens) {
    return res.status(400).json({ error: 'No active reset tokens' });
  }

  const tokenRecord = db.resetTokens.find((t: any) => t.token === token);
  if (!tokenRecord) {
    return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
  }

  if (tokenRecord.used) {
    return res.status(400).json({ error: 'This reset token has already been consumed.' });
  }

  const isExpired = new Date(tokenRecord.expiresAt).getTime() < Date.now();
  if (isExpired) {
    return res.status(400).json({ error: 'This reset token has expired. Tokens are only valid for 10-15 minutes.' });
  }

  // Validate the strength of the new password
  const passwordVal = validatePassword(password);
  if (!passwordVal.valid) {
    return res.status(400).json({ error: passwordVal.error });
  }

  // Find user and securely replace password
  const userIndex = db.users.findIndex((u: any) => u.email.toLowerCase() === tokenRecord.email.toLowerCase());
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User associated with this token not found.' });
  }

  db.users[userIndex].password_hash = hashPassword(password);
  tokenRecord.used = true;

  writeDB(db);

  res.json({ message: 'Success! Your password has been securely reset. Try signing in now.' });
});

// COMPLAINTS: Create (Resident Only)
app.post('/api/complaints', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'resident') {
    return res.status(403).json({ error: 'Only residents can file complaints' });
  }

  const { service_type, description, block, floor, door_no } = req.body;
  if (!service_type || !description || !block || !floor || !door_no) {
    return res.status(400).json({ error: 'All fields (service type, description, block, floor, door number) are required' });
  }

  const db = readDB();
  const newComplaint = {
    id: `req_${Math.floor(100 + Math.random() * 900)}`,
    user_id: user.id,
    resident_name: user.name,
    service_type,
    description,
    block,
    floor,
    door_no,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  db.complaints.push(newComplaint);
  writeDB(db);

  res.status(201).json(newComplaint);
});

// COMPLAINTS: Get Resident complaints
app.get('/api/complaints/resident', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  const db = readDB();
  const complaints = db.complaints.filter((c: any) => c.user_id === user.id);
  res.json(complaints);
});

// COMPLAINTS: Get Worker complaints (displays both pending matching skill categories & already accepted jobs)
app.get('/api/complaints/worker', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  const db = readDB();
  
  if (user.role !== 'worker') {
    return res.status(403).json({ error: 'Worker access only' });
  }

  // Filter complaints based on the category of technician if pending, 
  // OR if the technician is already assigned to the complaint.
  const complaints = db.complaints.filter((c: any) => 
    c.assigned_worker_id === user.id || 
    (c.status === 'pending' && c.service_type?.toLowerCase() === user.skill_type?.toLowerCase())
  );
  res.json(complaints);
});

// COMPLAINTS: Get Admin (all) complaints
app.get('/api/complaints/admin', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  const db = readDB();
  res.json(db.complaints);
});

// WORKERS: Get admin workers list + ratings
app.get('/api/workers/admin', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  const db = readDB();
  res.json(db.workers);
});

// WORKER: Get worker's own metrics profile, ratings, and reviews comments
app.get('/api/worker/profile', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'worker') {
    return res.status(403).json({ error: 'Worker access only' });
  }
  const db = readDB();
  const worker = db.workers.find((w: any) => w.id === user.id);
  res.json(worker || { id: user.id, name: user.name, rating: 5.0, ratings_count: 0, reviews: [] });
});

// ADMIN: Get all users (Resident and tech user profiles)
app.get('/api/admin/users', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  const db = readDB();
  const safeUsers = db.users.map(({ password_hash, ...u }: any) => u);
  res.json(safeUsers);
});

// ADMIN: Delete a user or technician from database (User details/technicians)
app.delete('/api/admin/users/:id', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  const { id } = req.params;
  const db = readDB();
  
  db.users = db.users.filter((u: any) => u.id !== id);
  db.workers = db.workers.filter((w: any) => w.id !== id);
  
  writeDB(db);
  res.json({ message: 'User deleted successfully from records.' });
});

// ADMIN: Get QR logs
app.get('/api/qr-logs', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }
  const db = readDB();
  res.json(db.qrLogs || []);
});

// WORKER: Direct accept or reject of available complaints (Technician Category Auto-Assignment)
app.post('/api/complaints/:id/respond', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'worker') {
    return res.status(403).json({ error: 'Worker access only' });
  }

  const { id } = req.params;
  const { response } = req.body; // 'accept' or 'reject' (meaning release)
  if (!response || (response !== 'accept' && response !== 'reject')) {
    return res.status(400).json({ error: 'Response must be accept or reject' });
  }

  const db = readDB();
  const complaint = db.complaints.find((c: any) => c.id === id);
  if (!complaint) {
    return res.status(404).json({ error: 'Complaint not found.' });
  }

  if (response === 'accept') {
    // Safety check - make sure it wasn't already accepted by someone else
    if (complaint.status !== 'pending') {
      return res.status(400).json({ error: 'This complaint has already been accepted by another department technician.' });
    }
    
    // Safety check - make sure worker service department matches complaint service department
    if (complaint.service_type?.toLowerCase() !== user.skill_type?.toLowerCase()) {
      return res.status(400).json({ error: 'You belong to a different department. Unable to accept.' });
    }

    complaint.status = 'accepted';
    complaint.assigned_worker_id = user.id;
    complaint.assigned_worker_name = user.name;
    complaint.assigned_worker_phone = user.phone || '+1 (555) 012-3456';
    complaint.accepted_at = new Date().toISOString();
    complaint.verification_status = 'pending';

    // Generate secure QR payload inside log
    const validityWindowMinutes = 60; // QR is valid for 1 hour
    const validityTime = new Date(Date.now() + validityWindowMinutes * 60 * 1000).toISOString();

    const qrPayload = {
      requestId: complaint.id,
      workerId: user.id,
      workerName: user.name,
      phoneNumber: user.phone || '+1 (555) 012-3456',
      serviceType: complaint.service_type,
      apartmentDetails: `Block ${complaint.block}, Floor ${complaint.floor}, Door ${complaint.door_no}`,
      timestamp: new Date().toISOString(),
      expiresAt: validityTime,
      verifiedSignature: `SECURE_SOC_${complaint.id}_${user.id}`
    };

    const qrLog = {
      id: `qr_${Math.floor(10000 + Math.random() * 90000)}`,
      request_id: complaint.id,
      worker_id: user.id,
      qr_data: JSON.stringify(qrPayload),
      generated_at: new Date().toISOString(),
      is_verified: false,
      status: 'pending' as const
    };

    if (!db.qrLogs) {
      db.qrLogs = [];
    }
    db.qrLogs.push(qrLog);

    // Update worker status in records to Busy
    const worker = db.workers.find((w: any) => w.id === user.id);
    if (worker) {
      worker.availability_status = 'Busy';
    }

  } else {
    // Reject/Release complaint (Return to pending list so other techs in category can grab it)
    if (complaint.assigned_worker_id !== user.id) {
      return res.status(403).json({ error: 'You are not the assigned worker for this complaint.' });
    }

    complaint.status = 'pending';
    complaint.assigned_worker_id = undefined;
    complaint.assigned_worker_name = undefined;
    complaint.assigned_worker_phone = undefined;
    complaint.verification_status = undefined;
    
    // Clear QR logs for this specific complaint
    if (db.qrLogs) {
      db.qrLogs = db.qrLogs.filter((l: any) => l.request_id !== id);
    }

    // Reset worker availability
    const worker = db.workers.find((w: any) => w.id === user.id);
    if (worker) {
      worker.availability_status = 'Available';
    }
  }

  writeDB(db);
  res.json(complaint);
});

// WORKER: Generate a QR Code URL as PNG Data URI for a complaint
app.get('/api/complaints/:id/qr-code', authMiddleware, async (req: any, res: any) => {
  const { id } = req.params;
  const db = readDB();
  const log = db.qrLogs.find((l: any) => l.request_id === id);
  if (!log) {
    return res.status(404).json({ error: 'QR log not found for this complaint. Ensure worker accepted first.' });
  }

  try {
    const dataUrl = await QRCode.toDataURL(log.qr_data);
    res.json({ qrCodeDataUrl: dataUrl, rawPayload: JSON.parse(log.qr_data), logId: log.id });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate QR Code' });
  }
});

// RESIDENT OR SCANNER: Verify Worker QR Code Details
app.post('/api/complaints/:id/verify-worker', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  const { id } = req.params;
  const { status } = req.body; // 'verified' or 'rejected'

  if (user.role !== 'resident') {
    return res.status(403).json({ error: 'Only the resident can verify worker entry' });
  }

  if (!status || (status !== 'verified' && status !== 'rejected')) {
    return res.status(400).json({ error: 'Verification status must be verified or rejected' });
  }

  const db = readDB();
  const complaint = db.complaints.find((c: any) => c.id === id);
  if (!complaint) {
    return res.status(404).json({ error: 'Complaint request not found' });
  }

  if (complaint.user_id !== user.id) {
    return res.status(403).json({ error: 'You are not authorized to verify for this apartment' });
  }

  complaint.verification_status = status;
  if (status === 'verified') {
    complaint.status = 'in_progress';
    complaint.verified_at = new Date().toISOString();
  } else {
    // If rejected, keep status as accepted but entry is rejected
    // Resident can reject if they look askancely or suspect worker identity.
  }

  // Update QRLog table
  const log = db.qrLogs.find((l: any) => l.request_id === id);
  if (log) {
    log.is_verified = (status === 'verified');
    log.status = status;
    log.verified_at = new Date().toISOString();
  }

  writeDB(db);
  res.json({ complaint, log });
});

// WORKER: Update job status (In Progress -> Completed)
app.post('/api/complaints/:id/status', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'worker') {
    return res.status(403).json({ error: 'Worker access only' });
  }

  const { id } = req.params;
  const { status } = req.body; // 'in_progress' or 'completed'
  if (!status || (status !== 'in_progress' && status !== 'completed')) {
    return res.status(400).json({ error: 'Status must be in_progress or completed' });
  }

  const db = readDB();
  const complaint = db.complaints.find((c: any) => c.id === id && c.assigned_worker_id === user.id);
  if (!complaint) {
    return res.status(404).json({ error: 'Complaint not found or not assigned to you' });
  }

  if (status === 'in_progress') {
    if (complaint.verification_status !== 'verified') {
      return res.status(400).json({ error: 'Resident must verify entry QR first before starting' });
    }
    complaint.status = 'in_progress';
  } else if (status === 'completed') {
    if (complaint.status !== 'in_progress') {
      return res.status(400).json({ error: 'Repair must be marked in_progress before completing' });
    }
    complaint.status = 'completed';
    complaint.completed_at = new Date().toISOString();

    // Set worker back to Available
    const worker = db.workers.find((w: any) => w.id === user.id);
    if (worker) {
      worker.availability_status = 'Available';
    }
  }

  writeDB(db);
  res.json(complaint);
});

// RESIDENT: Submit Feedback & Rating
app.post('/api/complaints/:id/feedback', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'resident') {
    return res.status(403).json({ error: 'Only residents can provide feedback' });
  }

  const { id } = req.params;
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Valid rating (1–5 stars) is required' });
  }

  const db = readDB();
  const complaint = db.complaints.find((c: any) => c.id === id && c.user_id === user.id);
  if (!complaint) {
    return res.status(404).json({ error: 'Complaint not found.' });
  }

  if (complaint.status !== 'completed') {
    return res.status(400).json({ error: 'Feedback can only be given on completed tasks.' });
  }

  complaint.rating = Number(rating);
  complaint.review = comment || '';

  // Store in worker profile
  const worker = db.workers.find((w: any) => w.id === complaint.assigned_worker_id);
  if (worker) {
    if (!worker.reviews) worker.reviews = [];
    worker.reviews.push({
      residentName: user.name,
      rating: Number(rating),
      comment: comment || '',
      date: new Date().toISOString().split('T')[0]
    });

    // Recalculate average rating
    const count = worker.reviews.length;
    const sum = worker.reviews.reduce((acc: number, r: any) => acc + r.rating, 0);
    worker.rating = Number((sum / count).toFixed(1));
    worker.ratings_count = count;
  }

  writeDB(db);
  res.json({ complaint, worker });
});

// ADMIN: Get Society Analytics
app.get('/api/analytics', authMiddleware, (req: any, res: any) => {
  const user = req.user;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only' });
  }

  const db = readDB();
  const complaints = db.complaints;
  const workers = db.workers;

  // Most common issues categories
  const categories: { [key: string]: number } = {};
  complaints.forEach((c: any) => {
    categories[c.service_type] = (categories[c.service_type] || 0) + 1;
  });

  // Complaint Lifecycles count
  const statusCounts = {
    pending: complaints.filter((c: any) => c.status === 'pending').length,
    assigned: complaints.filter((c: any) => c.status === 'assigned').length,
    accepted: complaints.filter((c: any) => c.status === 'accepted').length,
    in_progress: complaints.filter((c: any) => c.status === 'in_progress').length,
    completed: complaints.filter((c: any) => c.status === 'completed').length,
    total: complaints.length
  };

  // Compute average dispatch/completion durations in hours
  let totalMinutesToResolve = 0;
  let resolvedCount = 0;

  complaints.forEach((c: any) => {
    if (c.status === 'completed' && c.created_at && c.completed_at) {
      const start = new Date(c.created_at).getTime();
      const end = new Date(c.completed_at).getTime();
      const mins = (end - start) / (1000 * 60);
      if (mins > 0) {
        totalMinutesToResolve += mins;
        resolvedCount++;
      }
    }
  });

  const avgResolveTimeHours = resolvedCount > 0 
    ? Number((totalMinutesToResolve / resolvedCount / 60).toFixed(1)) 
    : 0;

  res.json({
    categories,
    statusCounts,
    workerPerformance: workers.map((w: any) => ({
      id: w.id,
      name: w.name,
      skill_type: w.skill_type,
      rating: w.rating,
      jobs_completed: complaints.filter((c: any) => c.assigned_worker_id === w.id && c.status === 'completed').length,
      current_status: w.availability_status
    })),
    avgResolveTimeHours
  });
});

// SERVER-SIDE GEMINI: Diagnose complaint with safe guidelines
app.post('/api/ai/diagnose', async (req: express.Request, res: express.Response): Promise<any> => {
  const { description, service_type } = req.body;
  
  if (!description || !service_type) {
    return res.status(400).json({ error: 'Complaint description and service type are required' });
  }

  // Fallback diagnostic if no API key is specified (keeps app resilient)
  if (!ai) {
    return res.json({
      diagnostic: `**Offline Troubleshooting Guidelines for: ${service_type}**\n\n` +
        `1. **Safety First**: If dealing with electric power sparks, navigate to your main circuit panel and turn off the breaker for that zone.\n` +
        `2. **Water Leakage**: If water is pooling or pipes are leaking, isolate the room by locating the stop cock valve underneath the basin or shut off the main water valve immediately.\n` +
        `3. **Limit Damage**: Place bucket, absorbent towels, or protective covers to shield wooden cabinets or appliances.\n` +
        `4. **Wait for Worker**: Avoid attempting professional structural repairs, re-wiring, or main water valve dismantling yourself. A certified SecureSociety professional will handle the task safely.`,
      tip: "To unlock AI-powered diagnostics tailored specifically to your complaint detail, please configure your GEMINI_API_KEY in the Secrets panel."
    });
  }

  try {
    const prompt = `Analyze the typical symptoms of this household complaint and provide a short, structured safety checklist and triage guide for the resident to follow while waiting for the assigned worker. Stay highly professional and extremely clear about safety measures. Only give practical advice. Keep it to max 5 bullet points.

Complaint Category: ${service_type}
Complaint Description: "${description}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the SecureSociety Smart Assistant. You provide practical, direct, and extremely safe emergency response guidelines for residential society complaints. Warn residents if actions are high risk (e.g. wet hands near sparks). Always formatted in markdown.",
      }
    });

    res.json({
      diagnostic: response.text || "No diagnostics available. Please contact community desk for support.",
      tip: "AI advice is based on typical scenarios. Please prioritize personal safety above all else."
    });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Could not fetch AI diagnostics: " + error.message });
  }
});

// Setup Vite Dev server or static asset serving in Production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SecureSociety] Server running on http://localhost:${PORT}`);
  });
}

startServer();
