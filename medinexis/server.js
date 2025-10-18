import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static files from current directory
app.use(express.static(__dirname));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Password hashing functions using crypto
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

const comparePassword = (password, hashedPassword) => {
  return hashPassword(password) === hashedPassword;
};

// Test database connection
app.use(async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// ✅ USERS
app.get("/api/users", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, first_name, last_name, email, phone, role, created_at FROM users");
    res.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password, role } = req.body;
    
    // Check if user already exists
    const [existingUsers] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "User with this email already exists" });
    }
    
    const hashedPassword = hashPassword(password);
    
    const [result] = await pool.query(
      "INSERT INTO users (first_name, last_name, email, phone, password, role) VALUES (?,?,?,?,?,?)",
      [first_name, last_name, email, phone, hashedPassword, role]
    );
    
    // Return the created user ID
    res.json({ id: result.insertId, message: "User created successfully" });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ✅ DELETE USER
app.delete("/api/users/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    
    console.log(`Attempting to delete user with ID: ${userId}`);
    
    // First, check if the user exists
    const [users] = await pool.query("SELECT * FROM users WHERE id = ?", [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = users[0];
    
    // If user is a doctor, delete from doctors table first (due to foreign key constraints)
    if (user.role === 'doctor') {
      await pool.query("DELETE FROM doctors WHERE user_id = ?", [userId]);
    }
    
    // Delete user appointments
    await pool.query("DELETE FROM appointments WHERE user_id = ? OR doctor_id IN (SELECT id FROM doctors WHERE user_id = ?)", [userId, userId]);
    
    // Delete user medical records
    await pool.query("DELETE FROM medical_records WHERE user_id = ? OR doctor_id IN (SELECT id FROM doctors WHERE user_id = ?)", [userId, userId]);
    
    // Delete user bills
    await pool.query("DELETE FROM bills WHERE user_id = ? OR doctor_id IN (SELECT id FROM doctors WHERE user_id = ?)", [userId, userId]);
    
    // Delete user lab reports
    await pool.query("DELETE FROM lab_reports WHERE user_id = ? OR doctor_id IN (SELECT id FROM doctors WHERE user_id = ?)", [userId, userId]);
    
    // Finally delete the user
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user. User might have related records.' });
  }
});

// ✅ LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = rows[0];
    const validPassword = comparePassword(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ✅ DOCTORS
app.get("/api/doctors", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT d.id, u.first_name, u.last_name, u.email, u.phone, d.specialization FROM doctors d JOIN users u ON u.id = d.user_id"
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

app.post("/api/doctors", async (req, res) => {
  try {
    const { user_id, specialization } = req.body;
    const [result] = await pool.query(
      "INSERT INTO doctors (user_id, specialization) VALUES (?,?)",
      [user_id, specialization]
    );
    res.json({ id: result.insertId, message: "Doctor created successfully" });
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ error: 'Failed to create doctor' });
  }
});

// ✅ APPOINTMENTS
app.get("/api/appointments", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, u.first_name as patient_first_name, u.last_name as patient_last_name,
             d.user_id as doctor_user_id, du.first_name as doctor_first_name, du.last_name as doctor_last_name
      FROM appointments a 
      JOIN users u ON a.user_id = u.id 
      JOIN doctors d ON a.doctor_id = d.id 
      JOIN users du ON d.user_id = du.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.get("/api/appointments/patient/:user_id", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, du.first_name as doctor_first_name, du.last_name as doctor_last_name, d.specialization
      FROM appointments a 
      JOIN doctors d ON a.doctor_id = d.id 
      JOIN users du ON d.user_id = du.id
      WHERE a.user_id = ?
    `, [req.params.user_id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.get("/api/appointments/doctor/:doctor_id", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, u.first_name as patient_first_name, u.last_name as patient_last_name, u.phone
      FROM appointments a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.doctor_id = ?
    `, [req.params.doctor_id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.post("/api/appointments", async (req, res) => {
  try {
    const { user_id, doctor_id, appointment_date, reason } = req.body;
    const [result] = await pool.query(
      "INSERT INTO appointments (user_id, doctor_id, appointment_date, reason) VALUES (?,?,?,?)",
      [user_id, doctor_id, appointment_date, reason]
    );
    res.json({ id: result.insertId, message: "Appointment booked successfully" });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

app.put("/api/appointments/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const [result] = await pool.query(
      "UPDATE appointments SET status = ? WHERE id = ?",
      [status, req.params.id]
    );
    res.json({ message: "Appointment status updated successfully" });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// ✅ MEDICAL RECORDS
app.get("/api/medical-records", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT mr.*, u.first_name as patient_first_name, u.last_name as patient_last_name,
             du.first_name as doctor_first_name, du.last_name as doctor_last_name
      FROM medical_records mr 
      JOIN users u ON mr.user_id = u.id 
      JOIN doctors d ON mr.doctor_id = d.id 
      JOIN users du ON d.user_id = du.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching medical records:', error);
    res.status(500).json({ error: 'Failed to fetch medical records' });
  }
});

app.get("/api/medical-records/patient/:user_id", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT mr.*, du.first_name as doctor_first_name, du.last_name as doctor_last_name, d.specialization
      FROM medical_records mr 
      JOIN doctors d ON mr.doctor_id = d.id 
      JOIN users du ON d.user_id = du.id
      WHERE mr.user_id = ?
    `, [req.params.user_id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching patient medical records:', error);
    res.status(500).json({ error: 'Failed to fetch medical records' });
  }
});

app.post("/api/medical-records", async (req, res) => {
  try {
    const { user_id, doctor_id, diagnosis, treatment, record_date } = req.body;
    const [result] = await pool.query(
      "INSERT INTO medical_records (user_id, doctor_id, diagnosis, treatment, record_date) VALUES (?,?,?,?,?)",
      [user_id, doctor_id, diagnosis, treatment, record_date || new Date().toISOString().split('T')[0]]
    );
    res.json({ id: result.insertId, message: "Medical record created successfully" });
  } catch (error) {
    console.error('Error creating medical record:', error);
    res.status(500).json({ error: 'Failed to create medical record' });
  }
});

// ✅ BILLS
app.get("/api/bills", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, u.first_name as patient_first_name, u.last_name as patient_last_name,
             du.first_name as doctor_first_name, du.last_name as doctor_last_name
      FROM bills b 
      JOIN users u ON b.user_id = u.id 
      JOIN doctors d ON b.doctor_id = d.id 
      JOIN users du ON d.user_id = du.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

app.get("/api/bills/patient/:user_id", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, du.first_name as doctor_first_name, du.last_name as doctor_last_name, d.specialization
      FROM bills b 
      JOIN doctors d ON b.doctor_id = d.id 
      JOIN users du ON d.user_id = du.id
      WHERE b.user_id = ?
    `, [req.params.user_id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching patient bills:', error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

app.post("/api/bills", async (req, res) => {
  try {
    const { user_id, doctor_id, amount } = req.body;
    const [result] = await pool.query(
      "INSERT INTO bills (user_id, doctor_id, amount) VALUES (?,?,?)",
      [user_id, doctor_id, amount]
    );
    res.json({ id: result.insertId, message: "Bill created successfully" });
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ error: 'Failed to create bill' });
  }
});

app.put("/api/bills/:id/pay", async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE bills SET status = 'paid' WHERE id = ?",
      [req.params.id]
    );
    res.json({ message: "Bill paid successfully" });
  } catch (error) {
    console.error('Error paying bill:', error);
    res.status(500).json({ error: 'Failed to pay bill' });
  }
});

// ✅ LAB REPORTS
app.get("/api/lab-reports", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lr.*, u.first_name as patient_first_name, u.last_name as patient_last_name,
             du.first_name as doctor_first_name, du.last_name as doctor_last_name
      FROM lab_reports lr 
      JOIN users u ON lr.user_id = u.id 
      JOIN doctors d ON lr.doctor_id = d.id 
      JOIN users du ON d.user_id = du.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching lab reports:', error);
    res.status(500).json({ error: 'Failed to fetch lab reports' });
  }
});

app.get("/api/lab-reports/patient/:user_id", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT lr.*, du.first_name as doctor_first_name, du.last_name as doctor_last_name, d.specialization
      FROM lab_reports lr 
      JOIN doctors d ON lr.doctor_id = d.id 
      JOIN users du ON d.user_id = du.id
      WHERE lr.user_id = ?
    `, [req.params.user_id]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching patient lab reports:', error);
    res.status(500).json({ error: 'Failed to fetch lab reports' });
  }
});

app.post("/api/lab-reports", async (req, res) => {
  try {
    const { user_id, doctor_id, test_type, result, report_date } = req.body;
    const [resultInsert] = await pool.query(
      "INSERT INTO lab_reports (user_id, doctor_id, test_type, result, report_date) VALUES (?,?,?,?,?)",
      [user_id, doctor_id, test_type, result, report_date || new Date().toISOString().split('T')[0]]
    );
    res.json({ id: resultInsert.insertId, message: "Lab report created successfully" });
  } catch (error) {
    console.error('Error creating lab report:', error);
    res.status(500).json({ error: 'Failed to create lab report' });
  }
});

// ✅ STATISTICS
app.get("/api/stats", async (req, res) => {
  try {
    const [[{totalPatients}]] = await pool.query("SELECT COUNT(*) as totalPatients FROM users WHERE role = 'patient'");
    const [[{totalDoctors}]] = await pool.query("SELECT COUNT(*) as totalDoctors FROM doctors");
    const [[{totalAppointments}]] = await pool.query("SELECT COUNT(*) as totalAppointments FROM appointments");
    const [[{totalRevenue}]] = await pool.query("SELECT COALESCE(SUM(amount), 0) as totalRevenue FROM bills WHERE status = 'paid'");
    
    res.json({ totalPatients, totalDoctors, totalAppointments, totalRevenue });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ message: "Server is running!" });
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Open http://localhost:${PORT} in your browser`);
});