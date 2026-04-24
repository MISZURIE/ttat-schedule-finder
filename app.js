// ===== TTAT Championship Schedule Finder =====
let scheduleData = { matches: [], teams: [], total_matches: 0, total_teams: 0 };
let currentSearchTeam = '';
let currentMatchResults = [];
let currentDateFilter = 'all';

// ===== Initialize =====
async function initApp() {
    try {
        const response = await fetch('schedule_data.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        scheduleData.matches = data.matches.filter(m =>
            !m.team1.startsWith('PS.') && !m.team2.startsWith('PS.') &&
            !m.team1.startsWith('Rank') && !m.team2.startsWith('Rank') &&
            m.team1 !== '-' && m.team2 !== '-' && m.team1 !== '' && m.team2 !== ''
        );
        
        updateCombinedData();
    } catch (error) {
        console.warn('Could not load initial data (likely due to opening file directly without a server). Please upload a PDF file instead.', error);
        document.getElementById('teamGrid').innerHTML = '<div class="no-results" style="grid-column:1/-1"><div class="no-results-icon">📥</div><h3>ไม่มีข้อมูลเริ่มต้นในระบบ</h3><p style="margin-top: 8px;">กรุณาคลิก <b>"อัปโหลด PDF / URL"</b> ที่มุมขวาบนเพื่อนำเข้าตารางแข่งขันครับ</p></div>';
    } finally {
        createParticles();
        setupEventListeners();
        setupUploadModal();
        setupNotifModal();
    }
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    let cur = 0; const step = Math.ceil(target / 40);
    const iv = setInterval(() => { cur += step; if (cur >= target) { cur = target; clearInterval(iv); } el.textContent = cur; }, 25);
}

function createParticles() {
    const c = document.getElementById('bgParticles');
    const cols = ['#6366f1','#8b5cf6','#06b6d4','#a78bfa'];
    for (let i = 0; i < 15; i++) {
        const p = document.createElement('div'); p.className = 'particle';
        const s = Math.random()*200+50;
        p.style.cssText = `width:${s}px;height:${s}px;left:${Math.random()*100}%;top:${Math.random()*100}%;background:${cols[Math.floor(Math.random()*4)]};animation-delay:${Math.random()*10}s;animation-duration:${Math.random()*15+15}s`;
        c.appendChild(p);
    }
}

function updateCombinedData() {
    // Sort matches by date and time
    scheduleData.matches.sort((a, b) => parseDateKey(a.date) - parseDateKey(b.date) || parseTime(a.time) - parseTime(b.time));
    const teamSet = new Set();
    scheduleData.matches.forEach(m => { if (m.team1) teamSet.add(m.team1); if (m.team2) teamSet.add(m.team2); });
    scheduleData.teams = Array.from(teamSet).sort();
    scheduleData.total_matches = scheduleData.matches.length;
    scheduleData.total_teams = scheduleData.teams.length;
    
    animateNumber('totalMatches', scheduleData.total_matches);
    animateNumber('totalTeams', scheduleData.total_teams);
    renderTeamGrid();
    updateDateFilterChips();
    
    if (currentSearchTeam) {
        searchTeam(currentSearchTeam);
    }
}

function updateDateFilterChips() {
    const chipContainer = document.getElementById('dateFilterChips');
    if (!chipContainer) return;
    
    const dates = new Set();
    scheduleData.matches.forEach(m => dates.add(m.date));
    const sortedDates = Array.from(dates).sort((a, b) => parseDateKey(a) - parseDateKey(b));
    
    let html = `<button class="chip ${currentDateFilter === 'all' ? 'active' : ''}" data-date="all">ทั้งหมด</button>`;
    sortedDates.forEach(d => {
        html += `<button class="chip ${currentDateFilter === d ? 'active' : ''}" data-date="${d}">${formatDateThai(d)}</button>`;
    });
    chipContainer.innerHTML = html;
    
    document.querySelectorAll('#dateFilterChips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#dateFilterChips .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active'); 
            currentDateFilter = chip.dataset.date;
            if (document.getElementById('resultsSection').style.display !== 'none' && currentSearchTeam) {
                searchTeam(currentSearchTeam);
            } else {
                renderTeamGrid();
            }
        });
    });
}

// ===== Event Listeners =====
function setupEventListeners() {
    const si = document.getElementById('searchInput'), cb = document.getElementById('clearBtn');
    si.addEventListener('input', e => {
        const q = e.target.value.trim(); cb.style.display = q ? 'flex' : 'none';
        q.length >= 1 ? showSuggestions(q) : (hideSuggestions(), showTeamList());
    });
    si.addEventListener('focus', () => { const q = si.value.trim(); if (q.length >= 1) showSuggestions(q); });
    cb.addEventListener('click', () => { si.value = ''; cb.style.display = 'none'; hideSuggestions(); showTeamList(); si.focus(); });
    document.getElementById('backBtn').addEventListener('click', showTeamList);
    // Filter chip listeners are now dynamically attached in updateDateFilterChips
    document.addEventListener('click', e => { if (!e.target.closest('.search-box')) hideSuggestions(); });
    si.addEventListener('keydown', e => { if (e.key === 'Enter' && si.value.trim()) { hideSuggestions(); searchTeam(si.value.trim()); } if (e.key === 'Escape') hideSuggestions(); });

    // Export buttons
    document.getElementById('exportBtn').addEventListener('click', () => exportTeamExcel());
    document.getElementById('notifBtn').addEventListener('click', () => openNotifModal());
    document.getElementById('exportAllBtn').addEventListener('click', () => exportAllDataExcel());
    document.getElementById('openUploadBtn').addEventListener('click', () => { document.getElementById('uploadModal').style.display = 'flex'; });
}

// ===== Search =====
function showSuggestions(query) {
    const c = document.getElementById('searchSuggestions'), ql = query.toLowerCase();
    const matches = scheduleData.teams.filter(t => t.toLowerCase().includes(ql)).slice(0, 15);
    if (!matches.length) { c.innerHTML = '<div class="suggestion-item" style="justify-content:center;color:var(--text-muted);cursor:default">ไม่พบทีมที่ค้นหา</div>'; c.classList.add('show'); return; }
    c.innerHTML = matches.map(t => `<div class="suggestion-item" onclick="selectTeam('${escapeHtml(t)}')"><div class="team-icon">${getTeamInitials(t)}</div><span class="team-name">${highlightMatch(t, query)}</span><span class="match-count">${getTeamMatchCount(t)} แมตช์</span></div>`).join('');
    c.classList.add('show');
}
function hideSuggestions() { document.getElementById('searchSuggestions').classList.remove('show'); }

function selectTeam(n) { document.getElementById('searchInput').value = n; document.getElementById('clearBtn').style.display = 'flex'; hideSuggestions(); searchTeam(n); }

function searchTeam(name) {
    currentSearchTeam = name;
    const nl = name.toLowerCase();
    let m = scheduleData.matches.filter(x => x.team1.toLowerCase().includes(nl) || x.team2.toLowerCase().includes(nl));
    if (currentDateFilter !== 'all') m = m.filter(x => x.date === currentDateFilter);
    currentMatchResults = m;
    showResults(name, m);
}

function showResults(teamName, matches) {
    document.getElementById('teamListSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsTitle').textContent = `📋 ตารางแข่งขันของ ${teamName}`;
    document.getElementById('resultsSubtitle').textContent = `พบ ${matches.length} แมตช์`;
    const rg = document.getElementById('resultsGrid');
    if (!matches.length) { rg.innerHTML = '<div class="no-results"><div class="no-results-icon">🔍</div><h3>ไม่พบข้อมูลการแข่งขัน</h3></div>'; return; }
    const grouped = {}; matches.forEach(m => { if (!grouped[m.date]) grouped[m.date] = []; grouped[m.date].push(m); });
    const sorted = Object.keys(grouped).sort((a, b) => parseDateKey(a) - parseDateKey(b));
    let html = '';
    sorted.forEach(dk => {
        const dm = grouped[dk]; dm.sort((a, b) => parseTime(a.time) - parseTime(b.time));
        html += `<div class="date-group-header"><span class="date-icon">📅</span><span class="date-text">${formatDateThai(dk)}</span><span class="match-count-badge">${dm.length} แมตช์</span></div>`;
        dm.forEach(m => {
            const t1h = m.team1.toLowerCase().includes(teamName.toLowerCase()), t2h = m.team2.toLowerCase().includes(teamName.toLowerCase());
            html += `<div class="match-card"><div class="match-datetime"><div class="match-date">${dk}</div><div class="match-time">${m.time}</div></div><div class="match-details"><div class="match-teams"><span class="team-badge team1 ${t1h?'highlight':''}" title="${m.team1}">${m.team1}</span><span class="vs-text">VS</span><span class="team-badge team2 ${t2h?'highlight':''}" title="${m.team2}">${m.team2}</span></div><div class="match-meta"><span class="meta-tag event">🏓 ${m.event}</span>${m.group?`<span class="meta-tag">${m.group}</span>`:''}${m.stage?`<span class="meta-tag stage">${m.stage}</span>`:''}${m.table?`<span class="meta-tag table-no">โต๊ะ ${m.table}</span>`:''}${m.isUploaded?`<span class="meta-tag" style="background:var(--accent-primary);color:white;border:none">📄 อัปโหลดใหม่</span>`:''}</div></div></div>`;
        });
    });
    rg.innerHTML = html;
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showTeamList() { document.getElementById('resultsSection').style.display = 'none'; document.getElementById('teamListSection').style.display = 'block'; currentSearchTeam = ''; currentMatchResults = []; }

function renderTeamGrid() {
    const g = document.getElementById('teamGrid');
    const teams = scheduleData.teams.filter(t => !t.startsWith('PS.') && !t.startsWith('Rank') && t !== '-' && t.length > 1);
    const validTeams = teams.filter(t => getTeamMatchCount(t) > 0);
    
    if (!validTeams.length) {
        g.innerHTML = '<div class="no-results" style="grid-column:1/-1"><div class="no-results-icon">📅</div><h3>ไม่พบทีมที่แข่งขันในวันที่เลือก</h3></div>';
        return;
    }
    
    g.innerHTML = validTeams.map(t => `<div class="team-card" onclick="selectTeam('${escapeHtml(t)}')"><div class="team-avatar">${getTeamInitials(t)}</div><div class="team-info"><div class="team-name" title="${t}">${t}</div><div class="team-matches">${getTeamMatchCount(t)} แมตช์</div></div></div>`).join('');
}

// ===== EXCEL EXPORT =====
function exportTeamExcel() {
    if (!currentMatchResults.length) { showToast('warning', '⚠️', 'ไม่มีข้อมูลให้ส่งออก'); return; }
    const rows = currentMatchResults.map(m => ({
        'วันที่': m.date, 'วันที่ (ไทย)': formatDateThai(m.date), 'เวลา': m.time,
        'ประเภท': m.event, 'กลุ่ม': m.group, 'รอบ': m.stage, 'โต๊ะ': m.table,
        'ทีม 1': m.team1, 'ทีม 2': m.team2
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{wch:12},{wch:22},{wch:8},{wch:10},{wch:12},{wch:12},{wch:6},{wch:35},{wch:35}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ตารางแข่งขัน');
    const fname = `ตารางแข่งขัน_${currentSearchTeam.replace(/[^a-zA-Z0-9ก-๙]/g,'_')}.xlsx`;
    XLSX.writeFile(wb, fname);
    showToast('success', '✅', `ส่งออก Excel สำเร็จ: ${fname}`);
}

function exportAllDataExcel() {
    if (!scheduleData) return;
    const rows = scheduleData.matches.map(m => ({
        'วันที่': m.date, 'วันที่ (ไทย)': formatDateThai(m.date), 'เวลา': m.time,
        'ประเภท': m.event, 'กลุ่ม': m.group, 'รอบ': m.stage, 'โต๊ะ': m.table,
        'ทีม 1': m.team1, 'ทีม 2': m.team2
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{wch:12},{wch:22},{wch:8},{wch:10},{wch:12},{wch:12},{wch:6},{wch:35},{wch:35}];
    // Team list sheet
    const teamRows = scheduleData.teams.filter(t => !t.startsWith('PS.') && t !== '-' && t.length > 1).map(t => ({
        'ชื่อทีม': t, 'จำนวนแมตช์': getTeamMatchCount(t)
    }));
    const ws2 = XLSX.utils.json_to_sheet(teamRows);
    ws2['!cols'] = [{wch:40},{wch:14}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'แมตช์ทั้งหมด');
    XLSX.utils.book_append_sheet(wb, ws2, 'รายชื่อทีม');
    XLSX.writeFile(wb, 'TTAT_Championship_2569_ทั้งหมด.xlsx');
    showToast('success', '✅', `ส่งออกข้อมูลทั้งหมด ${rows.length} แมตช์ สำเร็จ!`);
}

// ===== NOTIFICATION EXPORT =====
function openNotifModal() {
    if (!currentMatchResults.length) { showToast('warning', '⚠️', 'กรุณาค้นหาทีมก่อนส่งออกแจ้งเตือน'); return; }
    const modal = document.getElementById('notifModal');
    modal.style.display = 'flex';
    // Build preview table
    const preview = document.getElementById('notifPreview');
    let html = '<table class="notif-preview-table"><thead><tr><th>วันที่</th><th>เวลา</th><th>ประเภท</th><th>คู่แข่ง</th></tr></thead><tbody>';
    const sorted = [...currentMatchResults].sort((a,b) => parseDateKey(a.date)-parseDateKey(b.date) || parseTime(a.time)-parseTime(b.time));
    sorted.forEach(m => {
        const opponent = m.team1.toLowerCase().includes(currentSearchTeam.toLowerCase()) ? m.team2 : m.team1;
        html += `<tr><td>${formatDateThai(m.date)}</td><td>${m.time}</td><td>${m.event}</td><td>${opponent}</td></tr>`;
    });
    html += '</tbody></table>';
    preview.innerHTML = html;
}

function setupNotifModal() {
    document.getElementById('closeNotifModal').addEventListener('click', () => { document.getElementById('notifModal').style.display = 'none'; });
    document.getElementById('notifModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

    document.getElementById('exportNotifExcel').addEventListener('click', () => {
        exportNotification('excel');
        document.getElementById('notifModal').style.display = 'none';
    });
    document.getElementById('exportNotifCSV').addEventListener('click', () => {
        exportNotification('csv');
        document.getElementById('notifModal').style.display = 'none';
    });
    document.getElementById('exportNotifAlert').addEventListener('click', () => {
        exportNotification('alert');
        document.getElementById('notifModal').style.display = 'none';
    });
}

function exportNotification(type) {
    const sorted = [...currentMatchResults].sort((a,b) => parseDateKey(a.date)-parseDateKey(b.date) || parseTime(a.time)-parseTime(b.time));
    const team = currentSearchTeam;

    if (type === 'csv') {
        let csv = '\uFEFF' + 'วันที่,เวลา,ประเภท,กลุ่ม,รอบ,โต๊ะ,ทีมเรา,คู่แข่ง,หมายเหตุแจ้งเตือน\n';
        sorted.forEach(m => {
            const opp = m.team1.toLowerCase().includes(team.toLowerCase()) ? m.team2 : m.team1;
            const ourTeam = m.team1.toLowerCase().includes(team.toLowerCase()) ? m.team1 : m.team2;
            csv += `"${formatDateThai(m.date)}","${m.time}","${m.event}","${m.group}","${m.stage}","${m.table}","${ourTeam}","${opp}","แข่ง ${m.event} เวลา ${m.time}"\n`;
        });
        downloadFile(csv, `แจ้งเตือน_${team.replace(/[^a-zA-Z0-9ก-๙]/g,'_')}.csv`, 'text/csv;charset=utf-8');
        showToast('success', '✅', 'ส่งออก CSV สำเร็จ!');
        return;
    }

    const rows = sorted.map(m => {
        const opp = m.team1.toLowerCase().includes(team.toLowerCase()) ? m.team2 : m.team1;
        const ourTeam = m.team1.toLowerCase().includes(team.toLowerCase()) ? m.team1 : m.team2;
        const base = { 'วันที่': formatDateThai(m.date), 'เวลา': m.time, 'ประเภท': m.event, 'กลุ่ม': m.group, 'รอบ': m.stage, 'โต๊ะ': m.table, 'ทีมเรา': ourTeam, 'คู่แข่ง': opp };
        if (type === 'alert') {
            base['🔔 แจ้งเตือน'] = `📢 ${ourTeam} แข่ง ${m.event} วันที่ ${formatDateThai(m.date)} เวลา ${m.time} น. โต๊ะ ${m.table} พบ ${opp}`;
            base['สถานะ'] = 'รอแข่ง';
        }
        return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    if (type === 'alert') {
        ws['!cols'] = [{wch:22},{wch:8},{wch:10},{wch:12},{wch:12},{wch:6},{wch:30},{wch:30},{wch:60},{wch:10}];
    } else {
        ws['!cols'] = [{wch:22},{wch:8},{wch:10},{wch:12},{wch:12},{wch:6},{wch:30},{wch:30}];
    }

    // Summary sheet
    const summary = [
        { 'รายการ': 'ชื่อทีม', 'ข้อมูล': team },
        { 'รายการ': 'จำนวนแมตช์ทั้งหมด', 'ข้อมูล': String(sorted.length) },
        { 'รายการ': 'วันแข่งวันแรก', 'ข้อมูล': sorted.length ? formatDateThai(sorted[0].date) : '-' },
        { 'รายการ': 'วันแข่งวันสุดท้าย', 'ข้อมูล': sorted.length ? formatDateThai(sorted[sorted.length-1].date) : '-' },
        { 'รายการ': 'สร้างเมื่อ', 'ข้อมูล': new Date().toLocaleString('th-TH') },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summary);
    ws2['!cols'] = [{wch:25},{wch:40}];

    const wb = XLSX.utils.book_new();
    const sheetName = type === 'alert' ? 'แจ้งเตือนการแข่งขัน' : 'ตารางแข่งขัน';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.utils.book_append_sheet(wb, ws2, 'สรุป');

    const prefix = type === 'alert' ? 'แจ้งเตือน' : 'ตารางแข่งขัน';
    XLSX.writeFile(wb, `${prefix}_${team.replace(/[^a-zA-Z0-9ก-๙]/g,'_')}.xlsx`);
    showToast('success', '✅', `ส่งออก${type === 'alert' ? 'แจ้งเตือน' : ' Excel'} สำเร็จ!`);
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===== GEMINI API EXTRACTOR =====
async function extractWithGemini(imageDataArray, apiKey, progressFill, progressText) {
    progressFill.style.width = '40%';
    progressText.textContent = 'ส่งข้อมูลให้ Gemini AI ประมวลผลเพื่อความแม่นยำ 100%...';
    
    const prompt = `You are an expert data extractor. Extract the sports tournament schedule from ALL the provided images.
Return ONLY a valid JSON array of objects.
Each object must represent one match and contain exactly these keys:
- "date": Date of the match (e.g., "22/4/69", "22 เมษายน 2569"). Use the date found in the document.
- "match_no": Match number if available, else empty string.
- "time": Time of the match (e.g., "09:00", "13:30").
- "event": Event category (e.g., "BT11", "GT15", "MT", "WT", "ประเภทชายเดี่ยว").
- "group": Group or pool name (e.g., "Group 1", "สาย A"), else empty string.
- "stage": Tournament stage (e.g., "รอบแรก", "Semi-Final", "รอบ 16"), else empty string.
- "table": Table number (e.g., "1", "2"), else empty string.
- "team1": Name of the first team/player. Do not include match numbers or prefixes like "PS.".
- "team2": Name of the second team/player.

Important: Read ALL images carefully, do not miss any matches, maintain exact team names.`;

    // สร้าง parts: รูปภาพทุกหน้า + prompt ตัวเดียว
    const parts = imageDataArray.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }));
    parts.push({ text: prompt });

    const requestBody = {
        contents: [{ parts }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        date: { type: "STRING" },
                        match_no: { type: "STRING" },
                        time: { type: "STRING" },
                        event: { type: "STRING" },
                        group: { type: "STRING" },
                        stage: { type: "STRING" },
                        table: { type: "STRING" },
                        team1: { type: "STRING" },
                        team2: { type: "STRING" }
                    },
                    required: ["date", "time", "event", "team1", "team2"]
                }
            }
        }
    };

    const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let data;
    
    for (let mi = 0; mi < models.length; mi++) {
        const model = models[mi];
        const isLast = mi === models.length - 1;
        progressText.textContent = `ส่งข้อมูลให้ ${model} ประมวลผล...`;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const body = JSON.stringify(requestBody);
        
        // ลองได้สูงสุด 2 ครั้ง (ครั้งแรก + retry 1 ครั้งหลังรอ)
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                });

                if (response.ok) {
                    data = await response.json();
                    break; // Success
                } else {
                    const errData = await response.json().catch(() => ({}));
                    console.warn(`${model} failed (attempt ${attempt + 1}):`, errData);
                    
                    // ถ้าเป็น 429 (Rate Limit) ลอง parse retryDelay แล้วรอ
                    if ((response.status === 429 || response.status === 503) && attempt === 0) {
                        let waitSec = 40; // ค่าเริ่มต้นถ้าหา retryDelay ไม่เจอ
                        try {
                            const details = errData.error?.details || [];
                            for (const d of details) {
                                if (d.retryDelay) {
                                    waitSec = Math.ceil(parseFloat(d.retryDelay));
                                    break;
                                }
                            }
                            // ลอง parse จาก message ด้วย
                            const match = (errData.error?.message || '').match(/retry in ([\d.]+)s/i);
                            if (match) waitSec = Math.ceil(parseFloat(match[1]));
                        } catch (_) {}
                        
                        // แสดง Countdown ให้ผู้ใช้เห็น
                        for (let sec = waitSec; sec > 0; sec--) {
                            progressText.textContent = `⏳ โควตาเต็มชั่วคราว รอ ${sec} วินาที แล้วลองใหม่อัตโนมัติ...`;
                            await sleep(1000);
                        }
                        continue; // retry
                    }
                    
                    if (isLast && attempt > 0) {
                        let msg = errData.error?.message || response.statusText;
                        if (msg.toLowerCase().includes('quota') || response.status === 429) {
                            msg = 'โควตา API ของคุณเต็ม หรือใช้งานถี่เกินไป กรุณารอสักครู่ (ประมาณ 1 นาที) แล้วลองใหม่ครับ';
                        }
                        throw new Error(msg);
                    }
                    break; // ลองโมเดลถัดไป
                }
            } catch (e) {
                if (e.message && (e.message.includes('โควตา') || e.message.includes('Gemini API'))) throw e;
                console.error(`Fetch error for ${model}:`, e);
                if (isLast) throw e;
                break; // ลองโมเดลถัดไป
            }
        }
        if (data) break; // ถ้าได้ data แล้วออกจาก model loop
    }
    progressFill.style.width = '80%';
    progressText.textContent = 'วิเคราะห์ข้อมูลเสร็จสิ้น...';
    
    try {
        let textResult = data.candidates[0].content.parts[0].text;
        // พยายาม parse ตรงๆ ก่อน
        try {
            const matches = JSON.parse(textResult);
            if (!Array.isArray(matches)) throw new Error("Result is not an array.");
            return matches;
        } catch (parseErr) {
            // ถ้า JSON ถูกตัดจบ ให้พยายามซ่อมแซม (repair truncated JSON)
            console.warn('JSON parse failed, attempting repair...', parseErr.message);
            // ตัดข้อมูลที่ไม่สมบูรณ์ออก แล้วปิด array
            const lastCompleteObj = textResult.lastIndexOf('},');
            const lastObj = textResult.lastIndexOf('}');
            if (lastCompleteObj > 0) {
                const repaired = textResult.substring(0, lastCompleteObj + 1) + ']';
                const matches = JSON.parse(repaired);
                if (Array.isArray(matches) && matches.length > 0) {
                    console.log(`Repaired JSON: recovered ${matches.length} matches`);
                    return matches;
                }
            } else if (lastObj > 0) {
                const repaired = textResult.substring(0, lastObj + 1) + ']';
                const matches = JSON.parse(repaired);
                if (Array.isArray(matches) && matches.length > 0) {
                    console.log(`Repaired JSON: recovered ${matches.length} matches`);
                    return matches;
                }
            }
            throw parseErr; // ซ่อมไม่สำเร็จ
        }
    } catch (e) {
        console.error("Failed to parse Gemini response:", e);
        throw new Error("GEMINI_PARSE_ERROR");
    }
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== UPLOAD MODAL =====
function setupUploadModal() {
    const modal = document.getElementById('uploadModal');
    document.getElementById('closeUploadModal').addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

    // API Key load
    const apiKeyInput = document.getElementById('geminiApiKey');
    if (apiKeyInput) {
        apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';
        apiKeyInput.addEventListener('input', (e) => {
            localStorage.setItem('geminiApiKey', e.target.value.trim());
        });
    }

    // Tab switching
    document.querySelectorAll('.upload-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.upload-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });

    // Dropzone
    const dz = document.getElementById('dropzone'), fi = document.getElementById('fileInput');
    dz.addEventListener('click', () => fi.click());
    document.getElementById('browseBtn').addEventListener('click', e => { e.stopPropagation(); fi.click(); });
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    fi.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
    document.getElementById('removeFile').addEventListener('click', () => { fi.value = ''; document.getElementById('selectedFile').style.display = 'none'; dz.style.display = 'block'; });

    // Process button
    document.getElementById('processBtn').addEventListener('click', processUpload);
}

let uploadedFile = null;
function handleFile(file) {
    if (!file.name.endsWith('.pdf')) { showToast('error', '❌', 'กรุณาเลือกไฟล์ PDF เท่านั้น'); return; }
    uploadedFile = file;
    document.getElementById('dropzone').style.display = 'none';
    document.getElementById('selectedFile').style.display = 'flex';
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

async function processUpload() {
    const activeTab = document.querySelector('.upload-tab.active').dataset.tab;
    const progress = document.getElementById('processProgress');
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');

    if (activeTab === 'pdf' && !uploadedFile) { showToast('warning', '⚠️', 'กรุณาเลือกไฟล์ PDF ก่อน'); return; }
    if (activeTab === 'url' && !document.getElementById('pdfUrlInput').value.trim()) { showToast('warning', '⚠️', 'กรุณาใส่ URL ก่อน'); return; }

    progress.style.display = 'block';
    fill.style.width = '5%'; text.textContent = 'กำลังเตรียมข้อมูล...';

    try {
        let pdfArrayBuffer;
        let mimeType = 'application/pdf';
        const apiKey = document.getElementById('geminiApiKey')?.value.trim();

        if (activeTab === 'pdf') {
            fill.style.width = '10%'; text.textContent = 'กำลังอ่านไฟล์ PDF...';
            pdfArrayBuffer = await readFileAsArrayBuffer(uploadedFile);
        } else {
            const url = document.getElementById('pdfUrlInput').value.trim();
            fill.style.width = '10%'; text.textContent = 'กำลังดาวน์โหลดไฟล์จาก URL...';
            try {
                const resp = await fetch(url);
                const blob = await resp.blob();
                mimeType = blob.type || 'application/pdf';
                pdfArrayBuffer = await blob.arrayBuffer();
            } catch (err) {
                fill.style.width = '0%'; progress.style.display = 'none';
                showToast('error', '❌', 'ไม่สามารถดาวน์โหลดไฟล์จาก URL ได้ (CORS blocked) - กรุณาดาวน์โหลดไฟล์แล้วอัปโหลดแทน');
                return;
            }
        }

        let allMatches = [];
        let useFallback = !apiKey;

        if (apiKey) {
            try {
                // เปลี่ยนไปใช้ pdf.js เรนเดอร์เป็นรูปภาพแทน pdf-lib เพื่อแก้ปัญหา CSP Eval Error
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                // ใช้สำเนาของ ArrayBuffer เพื่อไม่ให้ถูก detach (เผื่อ fallback ต้องใช้อีก)
                const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer.slice(0) }).promise;
                const totalPages = pdf.numPages;
                
                // เรนเดอร์ทุกหน้าเป็นรูปภาพก่อน
                fill.style.width = '15%'; text.textContent = `กำลังเตรียมรูปภาพ ${totalPages} หน้า...`;
                const allImages = [];
                for (let i = 1; i <= totalPages; i++) {
                    fill.style.width = `${15 + Math.floor((i / totalPages) * 25)}%`;
                    text.textContent = `แปลงหน้า ${i}/${totalPages} เป็นรูปภาพ...`;
                    
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    
                    allImages.push({
                        data: canvas.toDataURL('image/jpeg', 0.75).split(',')[1],
                        mimeType: 'image/jpeg'
                    });
                }
                
                // ส่งรูปภาพให้ AI ทีละ 5 หน้า (ลดจำนวน API calls จาก 15 เหลือ 3)
                const batchSize = 5;
                for (let bStart = 0; bStart < allImages.length; bStart += batchSize) {
                    const batch = allImages.slice(bStart, bStart + batchSize);
                    const bEnd = Math.min(bStart + batchSize, allImages.length);
                    fill.style.width = `${40 + Math.floor((bStart / allImages.length) * 40)}%`;
                    text.textContent = `ให้ AI ประมวลผลหน้า ${bStart + 1}-${bEnd} (จาก ${totalPages} หน้า)...`;
                    
                    const chunkMatches = await extractWithGemini(batch, apiKey, fill, text);
                    allMatches.push(...chunkMatches);
                    
                    // เว้นระยะ 5 วินาทีระหว่างชุด
                    if (bEnd < allImages.length) await sleep(5000);
                }
            } catch (err) {
                console.warn('Gemini extraction failed, falling back to local parser:', err.message);
                const reason = err.message === 'GEMINI_PARSE_ERROR' 
                    ? 'AI อ่านข้อมูลไม่สำเร็จ' 
                    : (err.message.includes('โควตา') ? 'โควตา API เต็ม' : 'AI ไม่พร้อมให้บริการ');
                text.textContent = `${reason} — สลับไปใช้ระบบดึงข้อมูลปกติ...`;
                showToast('warning', '⚠️', `${reason} ระบบสลับไปใช้ตัวอ่าน PDF ปกติแทนอัตโนมัติ`);
                allMatches = []; // ล้างข้อมูลที่อาจได้มาบางส่วน
                useFallback = true;
                await sleep(1500);
            }
        }

        if (useFallback) {
            // Set PDF.js worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            fill.style.width = '20%'; text.textContent = 'กำลังเปิดไฟล์ PDF...';
            const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer.slice(0) }).promise;
            const totalPages = pdf.numPages;

            fill.style.width = '30%'; text.textContent = `พบ ${totalPages} หน้า - กำลังดึงข้อมูล...`;

            for (let i = 1; i <= totalPages; i++) {
                const pct = 30 + Math.floor((i / totalPages) * 50);
                fill.style.width = pct + '%';
                text.textContent = `กำลังอ่านหน้า ${i}/${totalPages}...`;

                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const lines = extractLinesFromTextContent(textContent);
                allMatches.push(...parseScheduleLines(lines, i));
            }
            fill.style.width = '85%'; text.textContent = 'กำลังประมวลผลข้อมูล...';
            await sleep(300);
        }

        if (allMatches.length === 0) {
            fill.style.width = '100%'; text.textContent = '⚠️ ไม่พบข้อมูลตารางแข่งขัน';
            showToast('warning', '⚠️', 'ไม่พบข้อมูลตารางแข่งขันในรูปแบบที่รองรับ');
            await sleep(2000);
            progress.style.display = 'none'; fill.style.width = '0%';
            return;
        }

        // Filter valid matches
        const validMatches = allMatches.filter(m =>
            m.team1 && m.team2 &&
            m.team1 !== '-' && m.team2 !== '-' &&
            m.team1.length > 1 && m.team2.length > 1 &&
            !m.team1.startsWith('PS.') && !m.team2.startsWith('PS.') &&
            !m.team1.startsWith('Rank') && !m.team2.startsWith('Rank')
        );

        // Setup uploaded matches - clear old data and replace with new
        scheduleData.matches = validMatches;
        currentDateFilter = 'all'; // reset filter
        
        // Update last upload text
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        
        const lastUploadInfo = document.getElementById('lastUploadInfo');
        if (lastUploadInfo) {
            lastUploadInfo.textContent = `Last upload . ${dd}/${mm}/${yy} , ${hh}:${min}`;
            lastUploadInfo.style.display = 'block';
        }

        fill.style.width = '90%'; text.textContent = 'กำลังอัปเดตข้อมูลบนหน้าเว็บ...';
        await sleep(300);

        // Update combined data in-memory
        updateCombinedData();

        // Reset search if active
        if (currentSearchTeam) {
            showTeamList();
            document.getElementById('searchInput').value = '';
            document.getElementById('clearBtn').style.display = 'none';
        }

        fill.style.width = '100%';
        text.textContent = `✅ สำเร็จ! พบ ${validMatches.length} แมตช์`;
        showToast('success', '🎉', `นำเข้าข้อมูลสำเร็จ! พบ ${validMatches.length} แมตช์ใหม่`);

        await sleep(2500);
        document.getElementById('uploadModal').style.display = 'none';
        progress.style.display = 'none'; fill.style.width = '0%';

        // Reset upload form
        uploadedFile = null;
        document.getElementById('fileInput').value = '';
        document.getElementById('selectedFile').style.display = 'none';
        document.getElementById('dropzone').style.display = 'block';

    } catch (err) {
        console.error('PDF processing error:', err);
        fill.style.width = '0%'; progress.style.display = 'none';
        showToast('error', '❌', `เกิดข้อผิดพลาด: ${err.message}`);
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Extract text lines from PDF.js textContent, grouping by Y position
function extractLinesFromTextContent(textContent) {
    const items = textContent.items;
    if (!items.length) return [];

    // Group text items by approximate Y position (same line)
    const lineMap = {};
    items.forEach(item => {
        const y = Math.round(item.transform[5]);
        if (!lineMap[y]) lineMap[y] = [];
        lineMap[y].push({ x: item.transform[4], text: item.str });
    });

    // Sort by Y descending (PDF Y goes bottom-up), then items by X
    const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
    const lines = sortedYs.map(y => {
        const items = lineMap[y].sort((a, b) => a.x - b.x);
        return items.map(i => i.text).join(' ').trim();
    }).filter(l => l.length > 0);

    return lines;
}

// Parse schedule lines into match objects
function parseScheduleLines(lines, pageNum) {
    const matches = [];
    let currentDate = '';
    let currentEvent = '';

    // Date patterns: "22/4/69", "วันที่ 22 เมษายน", "4 พ.ย.2566"
    const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+[ก-๙\.]+\s*\d{2,4})/;
    // Time pattern: "9:00", "10:30", "13:00", "16.00"
    const timeRegex = /(?:เวลา\s*)?(\d{1,2}[:.]\d{2})/;
    // Event patterns: BT11, GT11, MT, WT, MT40, เยาวชน...
    const eventRegex = /^(BT\d+|GT\d+|MT\d*|WT\d*|ประเภท)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for date header
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
            currentDate = dateMatch[1];
        }

        // Check for event type in line
        const eventMatch = line.match(eventRegex);
        if (eventMatch) {
            currentEvent = line; // Use the whole line as event name for new formats
        } else {
            const shortEventMatch = line.match(/^(BT\d+|GT\d+|MT\d*|WT\d*)/);
            if (shortEventMatch) currentEvent = shortEventMatch[1];
        }

        // Split by 2+ spaces first, if less than 4 parts, try 1 space
        let parts = line.split(/\s{2,}/);
        if (parts.length < 4) {
            parts = line.split(/\s+/);
        }

        if (parts.length >= 4) {
            // Find time in parts
            let timeIdx = -1;
            for (let j = 0; j < Math.min(parts.length, 5); j++) {
                if (/^\d{1,2}[:.]\d{2}$/.test(parts[j])) {
                    timeIdx = j;
                    break;
                }
            }

            if (timeIdx >= 0) {
                const matchNo = timeIdx > 0 ? parts[timeIdx - 1] : '';
                let time = parts[timeIdx].replace('.', ':'); // Normalize to :
                
                // Extract remaining fields
                const remaining = parts.slice(timeIdx + 1).filter(p => p.trim() !== '');
                
                if (remaining.length >= 2) {
                    let event = currentEvent;
                    let group = '';
                    let stage = '';
                    let table = '';
                    let team1 = '';
                    let team2 = '';

                    // Check if first remaining part is event
                    if (/^(BT|GT|MT|WT)\d*/.test(remaining[0])) {
                        event = remaining.shift();
                    }
                    // Check for GROUP/สาย
                    if (remaining.length > 0 && /^(GROUP|Main|กลุ่ม|สาย)/i.test(remaining[0])) {
                        group = remaining.shift();
                        if (remaining.length > 0 && /^\d+$/.test(remaining[0])) {
                            group += ' ' + remaining.shift();
                        }
                    } else if (remaining.length > 0 && /^\d+$/.test(remaining[0])) {
                        // Might be group number directly after time
                        group = remaining.shift();
                    }
                    
                    // Check for stage
                    if (remaining.length > 0 && /^(แรก|รอบ|Round|R\/|Semi|QF|Final)/i.test(remaining[0])) {
                        stage = remaining.shift();
                    }
                    
                    // Check for table number
                    if (remaining.length > 0 && /^\d{1,2}$/.test(remaining[0])) {
                        table = remaining.shift();
                    }

                    // Remaining should be teams
                    if (remaining.length >= 2) {
                        // If there are many remaining parts, join them, then split by vs/พบ/-
                        const teamsStr = remaining.join(' ');
                        const teamParts = teamsStr.split(/\s+(?:vs|VS|พบ|-)\s+/);
                        if (teamParts.length >= 2) {
                            team1 = teamParts[0];
                            team2 = teamParts.slice(1).join(' ');
                        } else {
                            // Fallback: first part is team1, last part is team2
                            team1 = remaining[0];
                            team2 = remaining[remaining.length - 1];
                            
                            // If team names are the same, try to grab more words
                            if (team1 === team2 && remaining.length > 2) {
                                team1 = remaining.slice(0, Math.floor(remaining.length/2)).join(' ');
                                team2 = remaining.slice(Math.floor(remaining.length/2)).join(' ');
                            }
                        }
                    }

                    if (team1 && team2 && currentDate) {
                        matches.push({
                            date: currentDate,
                            match_no: matchNo,
                            time: time,
                            event: event || '',
                            group: group || '',
                            stage: stage || '',
                            table: table || '',
                            team1: team1.replace(/^[a-zA-Z0-9\-\.]+\s+/, '').trim(), // Remove leading numbers
                            team2: team2.replace(/^[a-zA-Z0-9\-\.]+\s+/, '').trim(),
                            page: pageNum
                        });
                    }
                }
            }
        }
    }

    return matches;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== TOAST =====
function showToast(type, icon, message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-exit'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// ===== Helpers =====
function getTeamMatchCount(n) { return scheduleData.matches.filter(m => (m.team1 === n || m.team2 === n) && (currentDateFilter === 'all' || m.date === currentDateFilter)).length; }
function getTeamInitials(n) { return /^[A-Za-z]/.test(n) ? n.split(/[\s-]+/).slice(0,2).map(w=>w[0]).join('').toUpperCase() : n.substring(0,2); }
function highlightMatch(t, q) { return t.replace(new RegExp(`(${escapeRegex(q)})`, 'gi'), '<strong style="color:var(--accent-secondary)">$1</strong>'); }
function escapeHtml(s) { return s.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function parseDateKey(d) { const p = d.split('/'); return p.length >= 3 ? parseInt(p[1])*100+parseInt(p[0]) : 0; }
function parseTime(t) { const p = t.split(':'); return parseInt(p[0])*60+(parseInt(p[1])||0); }
function formatDateThai(d) {
    const m = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const p = d.split('/'); if (p.length >= 3) { const y = parseInt(p[2]); return `${parseInt(p[0])} ${m[parseInt(p[1])]||''} ${y<100?y+2500:y}`; } return d;
}

document.addEventListener('DOMContentLoaded', initApp);
