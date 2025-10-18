const API_URL = "http://localhost:3000/api";
let currentUser = null;
/// ===============================
// 🔁 Global Refresh Helper
// ===============================
async function refreshAllDashboards() {
  if (!currentUser) return;

  try {
    if (currentUser.role === "doctor") {
      await loadDoctorData();
      await loadAdminData();
      await loadPatientData();
    } else if (currentUser.role === "patient") {
      await loadPatientData();
      await loadDoctorData();
      await loadAdminData();
    } else if (currentUser.role === "admin") {
      await loadAdminData();
      await loadDoctorData();
      await loadPatientData();
    }
  } catch (error) {
    console.error("Error refreshing dashboards:", error);
  }
}

// ✅ Doctor ID helper
let currentDoctorId = null;

async function fetchDoctorId() {
  try {
    const res = await fetch(`${API_URL}/doctors`);
    const doctors = await res.json();
    const doctor = doctors.find(d => d.user_id === currentUser.id);
    if (doctor) {
      currentDoctorId = doctor.id;
    } else {
      console.warn('⚠️ No doctor record found for this user. This is fine if not a doctor.');
    }
  } catch (err) {
    console.error('Error fetching doctor ID:', err);
  }
}
// ===============================
// 🔐 AUTHENTICATION
// ===============================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('Login form submitted');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      const user = await res.json();
      currentUser = user;

      if (user.role === 'doctor') {
        await fetchDoctorId();
      }

      showDashboard(user.role);
      updateUserInfo();
      showAlert('Login successful!', 'success');
    } else {
      const error = await res.json();
      showAlert(error.error || 'Invalid email or password', 'danger');
    }
  } catch (error) {
    showAlert('Network error. Please try again.', 'danger');
  }
});


document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = document.getElementById('regRole').value;
  const first_name = document.getElementById('regFirstName').value.trim();
  const last_name = document.getElementById('regLastName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirmPassword').value;

  if (password !== confirm) {
    showAlert('Passwords do not match', 'danger');
    return;
  }

  if (password.length < 6) {
    showAlert('Password must be at least 6 characters long', 'danger');
    return;
  }

  try {
    const userData = { first_name, last_name, email, phone, password, role };
    const res = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });

    if (res.ok) {
      const result = await res.json();
      
      if (role === 'doctor') {
        const specialization = document.getElementById('regSpecialization').value;
        await fetch(`${API_URL}/doctors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: result.id, specialization })
        });
      }
      
      showLogin();
      showAlert('Registration successful! Please login.', 'success');
    } else {
      showAlert('Registration failed. Email may already exist.', 'danger');
    }
  } catch (error) {
    showAlert('Network error. Please try again.', 'danger');
  }
});

// ===============================
// 👤 ADMIN USER MANAGEMENT
// ===============================
document.getElementById('adminCreateUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = document.getElementById('adminUserRole').value;
  const first_name = document.getElementById('adminUserFirstName').value.trim();
  const last_name = document.getElementById('adminUserLastName').value.trim();
  const email = document.getElementById('adminUserEmail').value.trim();
  const phone = document.getElementById('adminUserPhone').value.trim();
  const password = document.getElementById('adminUserPassword').value;

  if (password.length < 6) {
    showAlert('Password must be at least 6 characters long', 'danger');
    return;
  }

  try {
    const userData = { first_name, last_name, email, phone, password, role };
    const res = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });

    if (res.ok) {
      const result = await res.json();
      
      if (role === 'doctor') {
        const specialization = document.getElementById('adminUserSpecialization').value;
        await fetch(`${API_URL}/doctors`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: result.id, specialization })
        });
      }
      
      document.getElementById('adminCreateUserForm').reset();
      showAlert('User created successfully!', 'success');
      loadAdminUsers();
    } else {
      showAlert('Failed to create user. Email may already exist.', 'danger');
    }
  } catch (error) {
    showAlert('Network error. Please try again.', 'danger');
  }
});

// ==============================================
// 📅 PATIENT — BOOK APPOINTMENT
// ==============================================
document.getElementById("appointmentBookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const doctor_id = document.getElementById("appointmentDoctor").value;
  const date = document.getElementById("appointmentDate").value;
  const time = document.getElementById("appointmentTime").value;
  const reason = document.getElementById("appointmentReason").value;
  const appointment_date = `${date} ${time}:00`;

  try {
    const res = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUser.id, doctor_id, appointment_date, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to book appointment");

    showAlert("Appointment booked successfully!", "success");

    const table = document.getElementById("patientAppointmentsTable").querySelector("tbody");
    if (table) await loadPatientAppointments();

  } catch (err) {
    console.error(err);
    showAlert(err.message, "danger");
  }
});

// ==============================================
// 💰 DOCTOR — GENERATE BILL
// ==============================================
document.getElementById("doctorBillForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const user_id = document.getElementById("doctorBillPatient").value;
  const doctor_id = currentDoctorId;
  const consultationFee = parseFloat(document.getElementById("consultationFee").value);
  const additionalAmount = parseFloat(document.getElementById("additionalAmount").value);
  const amount = consultationFee + additionalAmount;

  try {
    const res = await fetch(`${API_URL}/bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, doctor_id, amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create bill");

    showAlert("Bill generated successfully!", "success");

    const table = document.getElementById("doctorBillsTable").querySelector("tbody");
    if (table) await loadDoctorBills();

  } catch (err) {
    console.error(err);
    showAlert(err.message, "danger");
  }
});

// ==============================================
// 🩺 DOCTOR — CREATE MEDICAL RECORD
// ==============================================
document.getElementById("medicalRecordForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const user_id = document.getElementById("recordPatient").value;
  const doctor_id = currentDoctorId;
  const diagnosis = document.getElementById("diagnosis").value;
  const treatment = document.getElementById("treatment").value;
  const record_date = new Date().toISOString().split("T")[0];

  try {
    const res = await fetch(`${API_URL}/medical-records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, doctor_id, diagnosis, treatment, record_date }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create medical record");

    showAlert("Medical record created successfully!", "success");

    const table = document.getElementById("doctorRecordsTable").querySelector("tbody");
    if (table) await loadDoctorRecords();

  } catch (err) {
    console.error(err);
    showAlert(err.message, "danger");
  }
});



// ==============================================
// 🔬 DOCTOR — UPLOAD LAB REPORT
// ==============================================
document.getElementById("labReportForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const user_id = document.getElementById("labPatient").value;
  const doctor_id = currentDoctorId;
  const test_type = document.getElementById("testType").value;
  const result = document.getElementById("labNotes").value;
  const report_date = new Date().toISOString().split("T")[0];

  try {
    const res = await fetch(`${API_URL}/lab-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, doctor_id, test_type, result, report_date }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to upload lab report");

    showAlert("Lab report uploaded successfully!", "success");

    const table = document.getElementById("doctorLabTable").querySelector("tbody");
    if (table) await loadDoctorLabReports();

  } catch (err) {
    console.error(err);
    showAlert(err.message, "danger");
  }
});
// ===============================
// 📊 DATA LOADING FUNCTIONS
// ===============================
async function loadAvailableDoctors() {
  const specialization = document.getElementById('appointmentSpecialization').value;
  const res = await fetch(`${API_URL}/doctors`);
  const doctors = await res.json();
  const select = document.getElementById('appointmentDoctor');
  select.innerHTML = '<option value="">Select Doctor</option>';
  
  doctors.forEach(d => {
    if (d.specialization === specialization) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `Dr. ${d.first_name} ${d.last_name} - ${d.specialization}`;
      select.appendChild(opt);
    }
  });
}

async function loadPatients(selectElementId) {
  const res = await fetch(`${API_URL}/users`);
  const users = await res.json();
  const patients = users.filter(u => u.role === 'patient');
  const select = document.getElementById(selectElementId);
  select.innerHTML = '<option value="">Select Patient</option>';
  
  patients.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.first_name} ${p.last_name} (${p.email})`;
    select.appendChild(opt);
  });
}

// ===============================
// 👤 USER DASHBOARD DATA
// ===============================
async function loadAdminData() {
  // Load stats
  const statsRes = await fetch(`${API_URL}/stats`);
  const stats = await statsRes.json();
  document.getElementById('totalPatients').textContent = stats.totalPatients;
  document.getElementById('totalDoctors').textContent = stats.totalDoctors;
  document.getElementById('totalAppointments').textContent = stats.totalAppointments;
  document.getElementById('totalRevenue').textContent = `$${stats.totalRevenue}`;

  // Load users
  loadAdminUsers();
  
  // Load appointments
  const appointmentsRes = await fetch(`${API_URL}/appointments`);
  const appointments = await appointmentsRes.json();
  const appointmentsTable = document.getElementById('adminAppointmentsTable').querySelector('tbody');
  appointmentsTable.innerHTML = appointments.map(apt => `
    <tr>
      <td>${apt.id}</td>
      <td>${apt.patient_first_name} ${apt.patient_last_name}</td>
      <td>Dr. ${apt.doctor_first_name} ${apt.doctor_last_name}</td>
      <td>${new Date(apt.appointment_date).toLocaleString()}</td>
      <td>${apt.reason}</td>
      <td><span class="status-${apt.status}">${apt.status}</span></td>
      <td>
        ${apt.status === 'pending' ? `
          <button class="btn btn-success btn-sm" onclick="updateAppointmentStatus(${apt.id}, 'approved')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="updateAppointmentStatus(${apt.id}, 'rejected')">Reject</button>
        ` : '-'}
      </td>
    </tr>
  `).join('');

  // Load bills
  const billsRes = await fetch(`${API_URL}/bills`);
  const bills = await billsRes.json();
  const billsTable = document.getElementById('adminBillsTable').querySelector('tbody');
  billsTable.innerHTML = bills.map(bill => `
    <tr>
      <td>${bill.id}</td>
      <td>${bill.patient_first_name} ${bill.patient_last_name}</td>
      <td>Dr. ${bill.doctor_first_name} ${bill.doctor_last_name}</td>
      <td>$${bill.amount}</td>
      <td><span class="status-${bill.status}">${bill.status}</span></td>
      <td>${new Date(bill.created_at).toLocaleDateString()}</td>
<td>
  <button class="btn btn-info btn-sm" onclick="viewBill(${bill.id})">View</button>
</td>

      <td>
        ${bill.status === 'pending' ? `
          <button class="btn btn-success btn-sm" onclick="markBillPaid(${bill.id})">Mark Paid</button>
        ` : '-'}
      </td>
    </tr>
  `).join('');

  // Load medical records
  const recordsRes = await fetch(`${API_URL}/medical-records`);
  const records = await recordsRes.json();
  const recordsTable = document.getElementById('adminRecordsTable').querySelector('tbody');
  recordsTable.innerHTML = records.map(record => `
  <tr>
    <td>${record.id}</td>
    <td>${record.patient_first_name} ${record.patient_last_name}</td>
    <td>${record.doctor_first_name} ${record.doctor_last_name}</td>
    <td>${record.diagnosis}</td>
    <td>${record.treatment}</td>
    <td>${new Date(record.record_date).toLocaleDateString()}</td>
    <td>
      <button class="btn btn-info btn-sm" onclick="viewRecord(${record.id})">View</button>
    </td>
  </tr>
`).join('');

  // Load lab reports
  const labRes = await fetch(`${API_URL}/lab-reports`);
  const labReports = await labRes.json();
  const labTable = document.getElementById('adminLabTable').querySelector('tbody');
  labReportsTable.innerHTML = reports.map(report => `
  <tr>
    <td>${report.id}</td>
    <td>${report.patient_first_name} ${report.patient_last_name}</td>
    <td>${report.doctor_first_name} ${report.doctor_last_name}</td>
    <td>${report.test_type}</td>
    <td>${report.result}</td>
    <td>${new Date(report.report_date).toLocaleDateString()}</td>
    <td>
      <button class="btn btn-info btn-sm" onclick="viewLab(${report.id})">View</button>
    </td>
  </tr>
`).join('');

}

async function loadAdminUsers() {
  const usersRes = await fetch(`${API_URL}/users`);
  const users = await usersRes.json();
  const usersTable = document.getElementById('adminUsersTable').querySelector('tbody');
  usersTable.innerHTML = users.map(user => `
    <tr>
      <td>${user.id}</td>
      <td>${user.first_name} ${user.last_name}</td>
      <td>${user.email}</td>
      <td>${user.phone}</td>
      <td><span class="status-${user.role}">${user.role}</span></td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})" ${user.id === currentUser.id ? 'disabled' : ''}>
          <i class="fas fa-trash"></i> Delete
        </button>
      </td>
    </tr>
  `).join('');
}

// ==============================================
// 👩‍⚕️ LOAD DOCTOR DASHBOARD
// ==============================================
async function loadDoctorData() {
  try {
    // ensure correct doctor_id
    if (!currentDoctorId && currentUser?.role === "doctor") {
      const doctorRes = await fetch(`${API_URL}/doctors`);
      const doctors = await doctorRes.json();
      const doc = doctors.find(d => d.email === currentUser.email);
      if (doc) currentDoctorId = doc.id;
    }

    // patients for dropdowns
    await loadPatients("doctorBillPatient");
    await loadPatients("recordPatient");
    await loadPatients("labPatient");

    // doctor’s appointments
    const appointmentsRes = await fetch(`${API_URL}/appointments/doctor/${currentDoctorId}`);
    const appointments = await appointmentsRes.json();

    const tableBody = document.getElementById("doctorAppointmentsTable").querySelector("tbody");
    tableBody.innerHTML = appointments.map(apt => `
      <tr>
        <td>${apt.id}</td>
        <td>${apt.patient_first_name} ${apt.patient_last_name}</td>
        <td>${apt.phone || "N/A"}</td>
        <td>${new Date(apt.appointment_date).toLocaleString()}</td>
        <td>${apt.reason || "-"}</td>
        <td><span class="status-${apt.status}">${apt.status}</span></td>
        <td>
          ${apt.status === "pending"
            ? `
            <button class="btn btn-success btn-sm" onclick="updateAppointmentStatus(${apt.id}, 'approved')">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="updateAppointmentStatus(${apt.id}, 'rejected')">Reject</button>`
            : `<button class="btn btn-info btn-sm" onclick="viewAppointment(${apt.id})">View</button>`}
        </td>
      </tr>
    `).join("");

    await loadDoctorBills();
    await loadDoctorRecords();
    await loadDoctorLabReports();

  } catch (error) {
    console.error("Error loading doctor dashboard:", error);
  }
}
async function loadDoctorBills() {
  const billsRes = await fetch(`${API_URL}/bills`);
  const bills = await billsRes.json();
  const doctorBills = bills.filter(bill => bill.doctor_id === currentDoctorId);
  const billsTable = document.getElementById('doctorBillsTable').querySelector('tbody');
  billsTable.innerHTML = doctorBills.map(bill => `
    <tr>
      <td>${bill.id}</td>
      <td>${bill.patient_first_name} ${bill.patient_last_name}</td>
      <td>$${bill.amount}</td>
      <td><span class="status-${bill.status}">${bill.status}</span></td>
      <td>${new Date(bill.created_at).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

async function loadDoctorRecords() {
  const recordsRes = await fetch(`${API_URL}/medical-records`);
  const records = await recordsRes.json();
  const doctorRecords = records.filter(record => record.doctor_id === currentDoctorId);
  const recordsTable = document.getElementById('doctorRecordsTable').querySelector('tbody');
  recordsTable.innerHTML = doctorRecords.map(record => `
    <tr>
      <td>${record.id}</td>
      <td>${record.patient_first_name} ${record.patient_last_name}</td>
      <td>${record.diagnosis}</td>
      <td>${record.treatment}</td>
      <td>${new Date(record.record_date).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

async function loadDoctorLabReports() {
  const labRes = await fetch(`${API_URL}/lab-reports`);
  const labReports = await labRes.json();
  const doctorLabReports = labReports.filter(report => report.doctor_id === currentDoctorId);
  const labTable = document.getElementById('doctorLabTable').querySelector('tbody');
  labTable.innerHTML = doctorLabReports.map(report => `
    <tr>
      <td>${report.id}</td>
      <td>${report.patient_first_name} ${report.patient_last_name}</td>
      <td>${report.test_type}</td>
      <td>${report.result}</td>
      <td>${new Date(report.report_date).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

// ==============================================
// 👤 PATIENT DASHBOARD
// ==============================================
async function loadPatientData() {
  try {
    await loadPatientAppointments();
    await loadPatientBills();
    await loadPatientRecords();
    await loadPatientLabReports();
  } catch (error) {
    console.error("Error loading patient dashboard:", error);
  }
}

// ==============================================
// 📅 PATIENT APPOINTMENTS
// ==============================================
async function loadPatientAppointments() {
  try {
    const res = await fetch(`${API_URL}/appointments/patient/${currentUser.id}`);
    const appointments = await res.json();

    const table = document
      .getElementById("patientAppointmentsTable")
      .querySelector("tbody");

    table.innerHTML = appointments.map(a => `
      <tr>
        <td>${a.id}</td>
        <td>${a.doctor_first_name} ${a.doctor_last_name}</td>
        <td>${a.specialization || "-"}</td>
        <td>${new Date(a.appointment_date).toLocaleString()}</td>
        <td>${a.reason || "-"}</td>
        <td><span class="status-${a.status}">${a.status}</span></td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("Error loading patient appointments:", error);
  }
}

// ==============================================
// 💰 PATIENT BILLS
// ==============================================
async function loadPatientBills() {
  try {
    const res = await fetch(`${API_URL}/bills/patient/${currentUser.id}`);
    const bills = await res.json();

    const table = document
      .getElementById("patientBillsTable")
      .querySelector("tbody");

    table.innerHTML = bills.map(b => `
      <tr>
        <td>${b.id}</td>
        <td>${b.doctor_first_name} ${b.doctor_last_name}</td>
        <td>${b.specialization || "-"}</td>
        <td>$${b.amount}</td>
        <td><span class="status-${b.status}">${b.status}</span></td>
        <td><button class="btn btn-info btn-sm" onclick="viewBill(${b.id})">View</button></td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("Error loading patient bills:", error);
  }
}

// ==============================================
// 🩺 PATIENT MEDICAL RECORDS
// ==============================================
async function loadPatientRecords() {
  try {
    const res = await fetch(`${API_URL}/medical-records/patient/${currentUser.id}`);
    const records = await res.json();

    const table = document
      .getElementById("patientRecordsTable")
      .querySelector("tbody");

    table.innerHTML = records.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.doctor_first_name} ${r.doctor_last_name}</td>
        <td>${r.specialization || "-"}</td>
        <td>${r.diagnosis}</td>
        <td>${r.treatment}</td>
        <td>${new Date(r.record_date).toLocaleDateString()}</td>
        <td><button class="btn btn-info btn-sm" onclick="viewRecord(${r.id})">View</button></td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("Error loading patient medical records:", error);
  }
}

// ==============================================
// 🔬 PATIENT LAB REPORTS
// ==============================================
async function loadPatientLabReports() {
  try {
    const res = await fetch(`${API_URL}/lab-reports/patient/${currentUser.id}`);
    const reports = await res.json();

    const table = document
      .getElementById("patientLabReportsTable")
      .querySelector("tbody");

    table.innerHTML = reports.map(l => `
      <tr>
        <td>${l.id}</td>
        <td>${l.doctor_first_name} ${l.doctor_last_name}</td>
        <td>${l.specialization || "-"}</td>
        <td>${l.test_type}</td>
        <td>${l.result}</td>
        <td>${new Date(l.report_date).toLocaleDateString()}</td>
        <td><button class="btn btn-info btn-sm" onclick="viewLab(${l.id})">View</button></td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("Error loading patient lab reports:", error);
  }
}

// ===============================
// 🔄 UPDATE FUNCTIONS
// ===============================
async function updateAppointmentStatus(appointmentId, status) {
  try {
    const res = await fetch(`${API_URL}/appointments/${appointmentId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (res.ok) {
      showAlert(`Appointment ${status} successfully!`, 'success');
      if (currentUser.role === 'admin') loadAdminData();
      else if (currentUser.role === 'doctor') loadDoctorData();
    } else {
      showAlert('Failed to update appointment', 'danger');
    }
  } catch (error) {
    showAlert('Network error. Please try again.', 'danger');
  }
}

async function markBillPaid(billId) {
  try {
    const res = await fetch(`${API_URL}/bills/${billId}/pay`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" }
    });

    if (res.ok) {
      showAlert('Bill marked as paid!', 'success');
      loadAdminData();
    } else {
      showAlert('Failed to update bill', 'danger');
    }
  } catch (error) {
    showAlert('Network error. Please try again.', 'danger');
  }
}

async function payBill(billId) {
  try {
    const res = await fetch(`${API_URL}/bills/${billId}/pay`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" }
    });

    if (res.ok) {
      showAlert('Payment successful!', 'success');
      loadPatientBills();
    } else {
      showAlert('Payment failed', 'danger');
    }
  } catch (error) {
    showAlert('Network error. Please try again.', 'danger');
  }
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) {
    return;
  }

  try {
    const res = await fetch(`${API_URL}/users/${userId}`, {
      method: "DELETE"
    });

    if (res.ok) {
      showAlert('User deleted successfully!', 'success');
      loadAdminUsers();
    } else {
      showAlert('Failed to delete user', 'danger');
    }
  } catch (error) {
    showAlert('Network error. Please try again.', 'danger');
  }
}

// ===============================
// 🌟 UI FUNCTIONS
// ===============================
function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('registerScreen').classList.add('hidden');
  document.querySelectorAll('.dashboard').forEach(d => d.classList.add('hidden'));
}

function showRegister() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('registerScreen').classList.remove('hidden');
}

function toggleSpecialization() {
  const role = document.getElementById('regRole').value;
  document.getElementById('specializationGroup').classList.toggle('hidden', role !== 'doctor');
}

function toggleAdminSpecialization() {
  const role = document.getElementById('adminUserRole').value;
  document.getElementById('adminSpecializationGroup').classList.toggle('hidden', role !== 'doctor');
}

function showDashboard(role) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('registerScreen').classList.add('hidden');
  
  document.querySelectorAll('.dashboard').forEach(d => d.classList.add('hidden'));
  document.getElementById(`${role}Dashboard`).classList.remove('hidden');
  
  // Load appropriate data
  if (role === 'admin') loadAdminData();
  else if (role === 'doctor') loadDoctorData();
  else if (role === 'patient') loadPatientData();
}

function updateUserInfo() {
  if (!currentUser) return;
  
  const avatar = document.getElementById(`${currentUser.role}Avatar`);
  const name = document.getElementById(`${currentUser.role}Name`);
  
  if (avatar) avatar.textContent = currentUser.first_name[0].toUpperCase();
  if (name) name.textContent = `${currentUser.first_name} ${currentUser.last_name}`;
}

function showSection(sectionId) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(section => {
    section.classList.add('hidden');
  });
  
  // Remove active class from all nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Show selected section
  document.getElementById(sectionId).classList.remove('hidden');
  
  // Add active class to clicked nav link
  event.target.classList.add('active');
}

function logout() {
  currentUser = null;
  document.querySelectorAll('.dashboard').forEach(d => d.classList.add('hidden'));
  showLogin();
  showAlert('Logged out successfully', 'info');
}

function showAlert(message, type) {
  const alertBox = document.getElementById('alertBox');
  alertBox.textContent = message;
  alertBox.className = `notification ${type}`;
  alertBox.classList.add('show');
  
  setTimeout(() => {
    alertBox.classList.remove('show');
  }, 4000);
}

function updateTotalAmount() {
  const consultationFee = parseFloat(document.getElementById('consultationFee').value) || 0;
  const additionalAmount = parseFloat(document.getElementById('additionalAmount').value) || 0;
  document.getElementById('totalAmount').textContent = (consultationFee + additionalAmount).toFixed(2);
}
// ===============================
// 👁️ VIEW DETAILS POPUPS
// ===============================
function viewBill(id) {
  const bill = allBills.find(b => b.id === id);
  if (!bill) return alert("Bill not found.");
  alert(`Bill ID: ${bill.id}\nPatient: ${bill.patient_first_name} ${bill.patient_last_name}\nDoctor: ${bill.doctor_first_name} ${bill.doctor_last_name}\nAmount: ₹${bill.amount}\nStatus: ${bill.status}`);
}

function viewRecord(id) {
  const record = allRecords.find(r => r.id === id);
  if (!record) return alert("Record not found.");
  alert(`Record ID: ${record.id}\nDiagnosis: ${record.diagnosis}\nTreatment: ${record.treatment}\nDoctor: ${record.doctor_first_name} ${record.doctor_last_name}`);
}

function viewLab(id) {
  const report = allLabReports.find(r => r.id === id);
  if (!report) return alert("Lab report not found.");
  alert(`Report ID: ${report.id}\nTest: ${report.test_type}\nResult: ${report.result}\nDoctor: ${report.doctor_first_name} ${report.doctor_last_name}`);
}

function viewAppointment(id) {
  alert(`Viewing Appointment ID: ${id}`);
}
setInterval(() => {
  if (!currentUser) return;
  if (currentUser.role === 'admin') loadAdminData();
  if (currentUser.role === 'doctor') loadDoctorData();
  if (currentUser.role === 'patient') loadPatientData();
}, 60000); // every 60 seconds

// ==============================================
// 🔍 VIEW BUTTON HANDLERS
// ==============================================
function viewBill(id) {
  alert(`Viewing Bill #${id}`);
}

function viewRecord(id) {
  alert(`Viewing Medical Record #${id}`);
}

function viewLab(id) {
  alert(`Viewing Lab Report #${id}`);
}

// ===============================
// 🧠 AUTO INIT
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  showLogin();
  
  // Set minimum date to today for appointment booking
  const today = new Date().toISOString().split('T')[0];
  const appointmentDate = document.getElementById('appointmentDate');
  if (appointmentDate) {
    appointmentDate.min = today;
  }
  
  // Add event listeners for bill amount calculation
  const consultationFee = document.getElementById('consultationFee');
  const additionalAmount = document.getElementById('additionalAmount');
  
  if (consultationFee) consultationFee.addEventListener('input', updateTotalAmount);
  if (additionalAmount) additionalAmount.addEventListener('input', updateTotalAmount);
  setInterval(refreshAllDashboards, 60000); // refresh every 60 seconds

});