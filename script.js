// ---- ESTADO GLOBAL (Carga desde LocalStorage) ----
let students = JSON.parse(localStorage.getItem('qr_students')) || [];
let teachers = JSON.parse(localStorage.getItem('qr_teachers')) || [];
let attendanceLog = JSON.parse(localStorage.getItem('qr_attendance')) || [];
let html5QrScanner = null;
const SYSTEM_PASSWORD = "123";
const LOGIN_CREDENTIALS = "123";
let pendingAuthAction = null;
let liveStream = null;

// ---- CONFIGURACIÓN GOOGLE SHEETS ----
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxs1judP1o6QoBE7P2scuBmeBQpWt-71tapmtQk4rV-Zb4fRjB0r7I9WwmyJS8BsmZc/exec";

// Función para guardar localmente
function saveToLocalStorage() {
    localStorage.setItem('qr_students', JSON.stringify(students));
    localStorage.setItem('qr_teachers', JSON.stringify(teachers));
    localStorage.setItem('qr_attendance', JSON.stringify(attendanceLog));
}

// ---- INICIALIZACIÓN ----
document.addEventListener('DOMContentLoaded', () => {
    // Escuchar tecla Enter en campos de login
    const loginUser = document.getElementById('login-user');
    const loginPass = document.getElementById('login-pass');
    
    [loginUser, loginPass].forEach(input => {
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.validateLogin();
        });
    });

    document.getElementById('auth-password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.verifyAuth();
    });

    // Verificar sesión activa
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.add('hidden');
        initSystem();
    }
});

window.validateLogin = () => {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const errMsg = document.getElementById('login-error-msg');

    if (u === LOGIN_CREDENTIALS && p === LOGIN_CREDENTIALS) {
        if (errMsg) errMsg.classList.add('hidden');
        sessionStorage.setItem('isLoggedIn', 'true');
        const screen = document.getElementById('login-screen');
        screen.style.opacity = '0';
        screen.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            screen.classList.add('hidden');
            initSystem();
            window.showToast("BIENVENIDO AL SISTEMA", "success");
        }, 500);
    } else {
        if (errMsg) errMsg.classList.remove('hidden');
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
        document.getElementById('login-user').focus();
    }
};

function initSystem() {
    lucide.createIcons();
    updateClock();
    setInterval(updateClock, 1000);
    renderStudentsTable();
    renderTeachersTable();
    setupRestrictions();
    setupFileUploads();
    window.switchTab('scanner');
    
    // Cargar datos desde la nube al iniciar
    fetchDataFromSheets();
    
    // Verificación inicial de base de datos
    checkDatabaseConnection();
    setInterval(checkDatabaseConnection, 30000);
}

async function fetchDataFromSheets() {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();
        
        if (data.students && data.students.length > 0) students = data.students;
        if (data.teachers && data.teachers.length > 0) teachers = data.teachers;
        if (data.attendance && data.attendance.length > 0) attendanceLog = data.attendance;
        
        saveToLocalStorage();
        renderStudentsTable();
        renderTeachersTable();
        
        if (dot && text) {
            dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]";
            text.textContent = "OnLINE";
            text.className = "text-[8px] font-black uppercase tracking-tighter hidden sm:inline text-emerald-600";
        }
        window.showToast("BASE DE DATOS SINCRONIZADA", "success");
    } catch (e) {
        console.error("Error al cargar datos de Sheets:", e);
        if (dot && text) {
            dot.className = "w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
            text.textContent = "Offline";
            text.className = "text-[8px] font-black uppercase tracking-tighter hidden sm:inline text-red-600";
        }
    }
}

async function checkDatabaseConnection() {
    // Si ya cargamos datos con éxito, no es necesario re-verificar con no-cors
    // pero mantenemos la función por compatibilidad con el intervalo
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;

    try {
        const response = await fetch(GOOGLE_SHEET_URL, { 
            method: 'GET', 
            mode: 'no-cors',
            cache: 'no-store'
        });
        dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]";
        text.textContent = "OnLINE";
        text.className = "text-[8px] font-black uppercase tracking-tighter hidden sm:inline text-emerald-600";
    } catch (e) {
        dot.className = "w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
        text.textContent = "Offline";
        text.className = "text-[8px] font-black uppercase tracking-tighter hidden sm:inline text-red-600";
    }
}

function setupRestrictions() {
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('numeric-only')) {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 8);
        }
        if (e.target.classList.contains('alpha-only')) {
            e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        }
    });
}

function setupFileUploads() {
    const handleFile = (input, base64Id, previewId) => {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById(base64Id).value = e.target.result;
                document.getElementById(previewId).innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
            };
            reader.readAsDataURL(file);
        }
    };
    document.getElementById('stu-photo-file')?.addEventListener('change', function() { handleFile(this, 'stu-photo-base64', 'stu-photo-preview'); });
    document.getElementById('tea-photo-file')?.addEventListener('change', function() { handleFile(this, 'tea-photo-base64', 'tea-photo-preview'); });
    document.getElementById('edit-photo-file')?.addEventListener('change', function() { handleFile(this, 'edit-photo-base64', 'edit-photo-preview'); });
}

// ---- NAVEGACIÓN ----
window.switchTab = (tabId) => {
    // DESACTIVAR CÁMARA AUTOMÁTICAMENTE SI SE CAMBIA DE PESTAÑA
    if (tabId !== 'scanner') {
        window.stopScanner();
    }

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`)?.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-guindo', 'text-white', 'shadow-lg');
        btn.classList.add('text-plomo', 'bg-transparent');
    });
    const active = document.getElementById(`nav-${tabId}`);
    if (active) {
        active.classList.remove('text-plomo', 'bg-transparent');
        active.classList.add('bg-guindo', 'text-white', 'shadow-lg');
    }
    if (tabId === 'report') window.renderReport();
    lucide.createIcons();
};

// ---- ESCÁNER ----
window.startScanner = () => {
    html5QrScanner = new Html5Qrcode("reader");
    html5QrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (decodedText) => {
        processAttendance(decodedText);
    }).then(() => {
        document.getElementById('btn-start-scan').classList.add('hidden');
        document.getElementById('btn-stop-scan').classList.remove('hidden');
    }).catch(() => window.showToast("CÁMARA NO DISPONIBLE", "error"));
};

window.stopScanner = () => {
    if (html5QrScanner) {
        html5QrScanner.stop().then(() => {
            document.getElementById('btn-start-scan').classList.remove('hidden');
            document.getElementById('btn-stop-scan').classList.add('hidden');
            html5QrScanner = null;
        });
    }
};

async function syncToSheets(data) {
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        console.log("Sincronizado con Google Sheets");
    } catch (e) {
        console.error("Error de sincronización:", e);
    }
}

async function syncDeleteToSheets(id) {
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: id })
        });
        console.log("Eliminación sincronizada");
    } catch (e) {
        console.error("Error al sincronizar eliminación:", e);
    }
}

async function syncUpdateToSheets(data) {
    try {
        await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', ...data })
        });
        console.log("Actualización sincronizada");
    } catch (e) {
        console.error("Error al sincronizar actualización:", e);
    }
}

function processAttendance(id) {
    const p = students.find(s => s.id === id) || teachers.find(t => t.id === id);
    if (!p) return window.showToast("DNI NO REGISTRADO", "error");
    const now = getSimTime();
    const dateStr = now.toISOString().split('T')[0];
    if (attendanceLog.find(l => l.studentId === id && l.dateStr === dateStr)) return window.showToast("YA REGISTRADO", "warning");

    const minutes = now.getHours() * 60 + now.getMinutes();
    let status = 'ASISTIÓ';
    
    // NUEVA LÓGICA DE HORARIOS REQUERIDA
    if (minutes > 10 * 60) {
        status = 'FALTA';
    } else if (minutes > 8 * 60 + 20) {
        status = 'TARDE';
    }
    
    const record = { 
        studentId: id, 
        status, 
        dateStr, 
        timeStr: now.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'}) 
    };

    attendanceLog.push(record);
    saveToLocalStorage();

    syncToSheets({
        id: p.id,
        nombres: p.nombres,
        apellidos: p.apellidos,
        grado: p.grado,
        seccion: p.seccion,
        status: status,
        date: dateStr,
        time: record.timeStr
    });
    
    document.getElementById('scan-placeholder').classList.add('hidden');
    document.getElementById('scan-result').classList.remove('hidden');
    document.getElementById('res-name').textContent = p.nombres + " " + p.apellidos;
    if(p.photo) { document.getElementById('res-photo').src = p.photo; document.getElementById('res-photo').classList.remove('hidden'); document.getElementById('res-no-photo').classList.add('hidden'); }
    else { document.getElementById('res-photo').classList.add('hidden'); document.getElementById('res-no-photo').classList.remove('hidden'); }
    document.getElementById('res-status-badge').textContent = status;
    document.getElementById('res-status-badge').className = `mt-4 inline-block px-8 py-2 rounded-full text-xs font-black ${status === 'ASISTIÓ' ? 'bg-emerald-100 text-emerald-700' : status === 'TARDE' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`;
    window.showToast(status, status === 'FALTA' ? 'error' : 'success');
    window.renderReport();
}

function getSimTime() {
    const val = document.getElementById('simulated-time').value;
    const now = new Date();
    if (val) { const [h, m] = val.split(':'); now.setHours(h, m); }
    return now;
}

// ---- FORMULARIOS ----
window.addStudent = (e) => {
    e.preventDefault();
    const id = document.getElementById('stu-id').value;
    if (id.length !== 8) return window.showToast("DNI DEBE SER DE 8 DÍGITOS", "error");
    
    const data = {
        id, 
        nombres: document.getElementById('stu-names').value.toUpperCase(),
        apellidos: document.getElementById('stu-surnames').value.toUpperCase(),
        grado: document.getElementById('stu-grade').value,
        seccion: document.getElementById('stu-section').value,
        institucion: document.getElementById('stu-institution').value.toUpperCase(),
        photo: document.getElementById('stu-photo-base64').value
    };

    students.push(data);
    saveToLocalStorage();
    
    syncToSheets({ ...data, status: "REGISTRO ALUMNO", date: new Date().toLocaleDateString() });

    e.target.reset(); 
    document.getElementById('stu-photo-preview').innerHTML = '<i data-lucide="image" class="text-zinc-300"></i>';
    renderStudentsTable(); 
    window.showToast("ALUMNO GUARDADO", "success");
};

window.addTeacher = (e) => {
    e.preventDefault();
    const id = document.getElementById('tea-id').value;
    if (id.length !== 8) return window.showToast("DNI DEBE SER DE 8 DÍGITOS", "error");
    
    const data = {
        id, 
        nombres: document.getElementById('tea-names').value.toUpperCase(),
        apellidos: document.getElementById('tea-surnames').value.toUpperCase(),
        grado: document.getElementById('tea-grade').value,
        seccion: document.getElementById('tea-section').value,
        photo: document.getElementById('tea-photo-base64').value || ''
    };

    teachers.push(data);
    saveToLocalStorage();

    syncToSheets({ ...data, status: "REGISTRO DOCENTE", date: new Date().toLocaleDateString() });

    e.target.reset(); 
    document.getElementById('tea-photo-preview').innerHTML = '<i data-lucide="image" class="text-zinc-300"></i>';
    renderTeachersTable(); 
    window.showToast("DOCENTE GUARDADO", "success");
};

function renderStudentsTable() {
    const tb = document.getElementById('students-table-body');
    if(!tb) return;
    document.getElementById('student-count').textContent = students.length;
    tb.innerHTML = students.map(s => `
        <tr class="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-zinc-100 overflow-hidden border">
                        ${s.photo ? `<img src="${s.photo}" class="w-full h-full object-cover">` : `<i data-lucide="user" class="w-full h-full p-2 text-zinc-300"></i>`}
                    </div>
                    <div>
                        <p class="font-bold uppercase text-xs">${s.apellidos}, ${s.nombres}</p>
                        <p class="text-[10px] text-plomo uppercase">${s.grado} "${s.seccion}"</p>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3 text-right flex justify-end gap-1">
                <button onclick="window.promptAuth('edit', 'student', '${s.id}')" class="text-amber-600 p-2"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button onclick="window.promptAuth('delete', 'student', '${s.id}')" class="text-red-600 p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                <button onclick="window.showQRCode('${s.id}', false)" class="bg-guindo text-white text-[10px] px-4 py-2 rounded-xl font-bold uppercase">Carnet</button>
            </td>
        </tr>`).join('');
    lucide.createIcons();
}

function renderTeachersTable() {
    const tb = document.getElementById('teachers-table-body');
    if(!tb) return;
    document.getElementById('teacher-count').textContent = teachers.length;
    tb.innerHTML = teachers.map(t => `
        <tr class="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-zinc-100 overflow-hidden border">
                        ${t.photo ? `<img src="${t.photo}" class="w-full h-full object-cover">` : `<i data-lucide="user" class="w-full h-full p-2 text-zinc-300"></i>`}
                    </div>
                    <div>
                        <p class="font-bold uppercase text-xs">PROF. ${t.apellidos}</p>
                        <p class="text-[10px] text-plomo uppercase">${t.grado} "${t.seccion}"</p>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3 text-right flex justify-end gap-1">
                <button onclick="window.promptAuth('edit', 'teacher', '${t.id}')" class="text-amber-600 p-2"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button onclick="window.promptAuth('delete', 'teacher', '${t.id}')" class="text-red-600 p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                <button onclick="window.showQRCode('${t.id}', true)" class="bg-zinc-900 text-white text-[10px] px-4 py-2 rounded-xl font-bold uppercase">Carnet</button>
            </td>
        </tr>`).join('');
    lucide.createIcons();
}

function getFilteredData() {
    const fN = document.getElementById('f-name').value.toUpperCase();
    const fG = document.getElementById('f-grade').value;
    const fS = document.getElementById('f-section').value;
    const fD = document.getElementById('f-date').value;
    const fSt = document.getElementById('f-status').value;
    const now = getSimTime();
    const todayStr = now.toISOString().split('T')[0];

    return students.filter(s => {
        const matchName = (s.apellidos + " " + s.nombres).includes(fN);
        const matchGrade = (fG === "" || s.grado === fG);
        const matchSection = (fS === "" || s.seccion === fS);
        
        const targetDate = fD || todayStr;
        const log = attendanceLog.find(l => l.studentId === s.id && l.dateStr === targetDate);
        
        // SI ES DESPUÉS DE LAS 10:00 AM Y NO HAY LOG, ES FALTA AUTOMÁTICA
        let st = log ? log.status : (now.getHours() >= 10 ? 'FALTA' : 'PENDIENTE');
        
        const matchStatus = (fSt === "" || st === fSt);
        const matchDate = (fD === "" || log || st === 'FALTA');
        return matchName && matchGrade && matchSection && matchStatus && matchDate;
    }).map(s => {
        const targetDate = fD || todayStr;
        const log = attendanceLog.find(l => l.studentId === s.id && l.dateStr === targetDate);
        let st = log ? log.status : (now.getHours() >= 10 ? 'FALTA' : 'PENDIENTE');
        return { ...s, st, date: targetDate, time: log ? log.timeStr : '--:--' };
    });
}

window.renderReport = () => {
    const tb = document.getElementById('report-table-body');
    if (!tb) return;
    const fG = document.getElementById('f-grade').value;
    const fS = document.getElementById('f-section').value;
    let tName = "Salón no seleccionado";
    if (fG && fS) {
        const found = teachers.find(t => t.grado === fG && t.seccion === fS);
        tName = found ? `Docente: Prof. ${found.apellidos}, ${found.nombres}` : "Docente: No asignado";
    }
    document.getElementById('report-teacher-name').textContent = tName;
    const filtered = getFilteredData();
    tb.innerHTML = filtered.map(s => `
        <tr class="hover:bg-zinc-50 border-b">
            <td class="px-6 py-5 font-black uppercase text-xs text-guindo">${s.apellidos}, ${s.nombres}</td>
            <td class="px-6 py-5 text-xs text-center font-bold">${s.grado} ${s.seccion}</td>
            <td class="px-6 py-5 font-mono text-[11px] text-center text-plomo">${s.date}</td>
            <td class="px-6 py-5 font-black text-xs text-center ${s.st === 'FALTA' ? 'text-red-600' : 'text-emerald-600'}">${s.st}</td>
        </tr>`).join('');
};

window.generatePDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const filtered = getFilteredData();
    const fG = document.getElementById('f-grade').value || "TODOS";
    const fS = document.getElementById('f-section').value || "TODOS";
    const fD = document.getElementById('f-date').value;
    const now = getSimTime();
    const displayDate = fD || now.toISOString().split('T')[0];
    const tName = document.getElementById('report-teacher-name').textContent;
    doc.setFont("helvetica", "bold"); doc.setTextColor(99, 13, 22); doc.setFontSize(16);
    doc.text("REPORTE DE ASISTENCIA I.E. SEÑOR DE LA AGONÍA", 105, 20, { align: "center" });
    doc.setFontSize(10); doc.setTextColor(0);
    doc.text(`FECHA REPORTE: ${displayDate}`, 14, 30);
    doc.text(tName.toUpperCase(), 14, 38);
    const rows = filtered.map(s => [s.apellidos + ", " + s.nombres, s.grado + " " + s.seccion, s.date, s.st]);
    doc.autoTable({ head: [['ESTUDIANTE', 'GRADO/SEC', 'FECHA', 'ESTADO']], body: rows, startY: 45, headStyles: { fillColor: [99, 13, 22] } });
    const h = doc.internal.pageSize.height;
    doc.line(30, h-30, 80, h-30); doc.text("FIRMA DOCENTE", 42, h-25);
    doc.line(130, h-30, 180, h-30); doc.text("FIRMA DIRECTOR(A)", 142, h-25);
    const fileName = `Asistencia_${fG}-${fS}_${displayDate}`.replace(/[\\/:*?"<>|]/g, '-');
    doc.save(`${fileName}.pdf`);
};

window.promptAuth = (action, type, id) => {
    pendingAuthAction = { action, type, id };
    const pi = document.getElementById('auth-password');
    if (pi) pi.value = '';
    document.getElementById('auth-modal').classList.replace('hidden', 'flex');
    setTimeout(() => { 
        document.getElementById('auth-modal').classList.add('opacity-100'); 
        document.getElementById('auth-modal-content').classList.remove('scale-95');
        if (pi) pi.focus();
    }, 10);
};

window.verifyAuth = () => {
    const pi = document.getElementById('auth-password');
    if (pi.value === SYSTEM_PASSWORD) {
        if (pendingAuthAction.action === 'delete') {
            const idToDelete = pendingAuthAction.id;
            if (pendingAuthAction.type === 'student') students = students.filter(s => s.id !== idToDelete);
            else teachers = teachers.filter(t => t.id !== idToDelete);
            saveToLocalStorage();
            syncDeleteToSheets(idToDelete);
            renderStudentsTable(); renderTeachersTable();
            window.closeAuthModal();
            window.showToast("REGISTRO ELIMINADO", "success");
        } else if (pendingAuthAction.action === 'edit') {
            window.closeAuthModal();
            setTimeout(() => window.openEditModal(pendingAuthAction.type, pendingAuthAction.id), 400);
        }
    } else { 
        window.showToast("CONTRASEÑA INCORRECTA", "error"); 
        pi.value = ''; pi.focus();
    }
};

window.closeAuthModal = () => {
    const m = document.getElementById('auth-modal');
    m.classList.remove('opacity-100');
    setTimeout(() => m.classList.replace('flex', 'hidden'), 300);
};

window.openEditModal = (type, id) => {
    const p = type === 'student' ? students.find(s => s.id === id) : teachers.find(t => t.id === id);
    if (!p) return;
    document.getElementById('edit-type').value = type;
    document.getElementById('edit-original-id').value = id;
    document.getElementById('edit-id').value = p.id;
    document.getElementById('edit-nombres').value = p.nombres;
    document.getElementById('edit-apellidos').value = p.apellidos;
    document.getElementById('edit-grado').value = p.grado;
    document.getElementById('edit-seccion').value = p.seccion;
    if (type === 'student') {
        document.getElementById('edit-inst-container').classList.remove('hidden');
        document.getElementById('edit-institucion').value = p.institucion || '';
    } else document.getElementById('edit-inst-container').classList.add('hidden');
    document.getElementById('edit-photo-base64').value = p.photo || '';
    const prev = document.getElementById('edit-photo-preview');
    prev.innerHTML = p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : '<i data-lucide="image" class="text-zinc-300"></i>';
    lucide.createIcons();
    document.getElementById('edit-modal').classList.replace('hidden', 'flex');
    setTimeout(() => document.getElementById('edit-modal').classList.add('opacity-100'), 10);
};

window.saveEdit = (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    if (id.length !== 8) return window.showToast("DNI DEBE SER DE 8 DÍGITOS", "error");
    const type = document.getElementById('edit-type').value;
    const originalId = document.getElementById('edit-original-id').value;
    const data = { id, nombres: document.getElementById('edit-nombres').value.toUpperCase(), apellidos: document.getElementById('edit-apellidos').value.toUpperCase(), grado: document.getElementById('edit-grado').value, seccion: document.getElementById('edit-seccion').value, photo: document.getElementById('edit-photo-base64').value };
    
    if (type === 'student') {
        data.institucion = document.getElementById('edit-institucion').value.toUpperCase();
        students[students.findIndex(s => s.id === originalId)] = data;
    } else {
        teachers[teachers.findIndex(t => t.id === originalId)] = data;
    }
    
    saveToLocalStorage();
    syncUpdateToSheets({ ...data, type, originalId }); // Sincronización con Sheets
    
    window.closeEditModal(); 
    renderStudentsTable(); 
    renderTeachersTable();
    window.showToast("CAMBIOS GUARDADOS", "success");
};

window.closeEditModal = () => {
    const m = document.getElementById('edit-modal');
    m.classList.remove('opacity-100');
    setTimeout(() => m.classList.replace('flex', 'hidden'), 300);
};

window.toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    document.getElementById('theme-icon').setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    document.getElementById('logo-img').src = isDark ? 'LOGOSISTEMADARK.png' : 'LOGOSISTEMA.png';
    lucide.createIcons();
};

function updateClock() { 
    const el = document.getElementById('current-time');
    if (el) el.textContent = new Date().toLocaleTimeString('es-PE'); 
}

window.showToast = (m, t) => {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const d = document.createElement('div');
    // z-index 100002 para estar por encima del contenedor si es necesario
    d.className = `bg-guindo text-white px-8 py-4 rounded-3xl font-black border-2 border-white shadow-2xl uppercase text-[10px] animate-bounce z-[100002]`;
    d.textContent = m; 
    c.appendChild(d);
    setTimeout(() => {
        d.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => d.remove(), 500);
    }, 3500);
};

window.openLiveCamera = async (b, p) => {
    try {
        liveStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        document.getElementById('live-video').srcObject = liveStream;
        document.getElementById('live-camera-modal').classList.replace('hidden', 'flex');
        window.targetPhoto = { b, p };
    } catch (e) { window.showToast("ERROR CÁMARA", "error"); }
};

window.closeLiveCamera = () => {
    if (liveStream) liveStream.getTracks().forEach(t => t.stop());
    document.getElementById('live-camera-modal').classList.replace('flex', 'hidden');
};

window.captureLivePhoto = () => {
    const v = document.getElementById('live-video');
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const data = c.toDataURL('image/jpeg', 0.7);
    document.getElementById(window.targetPhoto.b).value = data;
    document.getElementById(window.targetPhoto.p).innerHTML = `<img src="${data}" class="w-full h-full object-cover">`;
    window.closeLiveCamera();
};

window.showQRCode = (id, isT) => {
    const p = isT ? teachers.find(t => t.id === id) : students.find(s => s.id === id);
    if (!p) return;
    document.getElementById('carnet-names').textContent = p.nombres;
    document.getElementById('carnet-surnames').textContent = p.apellidos;
    document.getElementById('carnet-grado').textContent = p.grado || '--';
    document.getElementById('carnet-seccion').textContent = p.seccion || '--';
    document.getElementById('carnet-dni').textContent = p.id;
    const ieVert = document.getElementById('carnet-ie-vertical');
    if (ieVert) ieVert.textContent = p.institucion || 'I.E. SEÑOR DE LA AGONÍA';
    const photoCont = document.getElementById('carnet-photo');
    if (p.photo) photoCont.innerHTML = `<img src="${p.photo}" class="w-full h-full object-cover">`;
    else { photoCont.innerHTML = '<i data-lucide="user" class="w-8 h-8 text-zinc-300"></i>'; lucide.createIcons(); }
    const design = document.getElementById('carnet-design');
    const label = document.getElementById('carnet-type-label');
    if (isT) { design.classList.replace('carnet-student', 'carnet-teacher'); label.textContent = 'CARNET DOCENTE'; }
    else { design.classList.replace('carnet-teacher', 'carnet-student'); label.textContent = 'CARNET ESTUDIANTIL'; }
    const cont = document.getElementById('modal-qr-container');
    cont.innerHTML = '';
    new QRCode(cont, { text: id, width: 100, height: 100, correctLevel: QRCode.CorrectLevel.H });
    document.getElementById('qr-modal').classList.replace('hidden', 'flex');
    setTimeout(() => document.getElementById('qr-modal').classList.add('opacity-100'), 10);
};

window.downloadCarnet = () => {
    window.showToast("GENERANDO CARNET...", "info");
    const carnet = document.getElementById('carnet-design');
    if (!carnet) return window.showToast("ERROR", "error");
    setTimeout(() => {
        html2canvas(carnet, { scale: 2, backgroundColor: null, logging: false, useCORS: true, allowTaint: true }).then(canvas => {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `Carnet_${document.getElementById('carnet-dni').textContent}.png`;
            link.click();
            window.showToast("CARNET DESCARGADO", "success");
        }).catch(() => window.showToast("ERROR", "error"));
    }, 500);
};

window.closeQRModal = () => {
    const m = document.getElementById('qr-modal');
    m.classList.remove('opacity-100');
    setTimeout(() => m.classList.replace('flex', 'hidden'), 300);
};
