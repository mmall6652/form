import { ASPIRATIONS } from './roster.js';

const $ = (id) => document.getElementById(id);
const tokenInput = $('token');
const errEl = $('err');
const tokenCard = tokenInput.closest('.card');
const resultsCard = $('resultsCard');

const cached = sessionStorage.getItem('ksat.adminToken');
if (cached) { tokenInput.value = cached; }

function describe(row) {
  if (!row.submitted) return '—';
  if (row.aspiration === 2 || row.aspiration === 3) return row.branch ?? '—';
  if (row.aspiration === 5) return row.otherText ?? '—';
  return '—';
}

function setTokenError(msg) {
  errEl.textContent = msg;
  tokenCard?.classList.toggle('has-error', Boolean(msg));
  tokenInput.classList.toggle('is-invalid', Boolean(msg));
}

function hideResults() {
  $('table').hidden = true;
  $('summary').hidden = true;
  if (resultsCard) resultsCard.hidden = true;
}

async function load() {
  const token = tokenInput.value.trim();
  setTokenError('');
  if (!token) { setTokenError('Vui lòng nhập mã quản lý.'); return; }
  sessionStorage.setItem('ksat.adminToken', token);
  try {
    const res = await fetch('/api/status', { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json();
    if (!res.ok) {
      setTokenError(body.error ?? 'Không tải được trạng thái.');
      hideResults();
      return;
    }
    const rows = $('rows');
    rows.innerHTML = '';
    body.rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      const cells = [
        String(i + 1),
        row.fullName,
        row.submitted ? 'Đã điền' : 'Chưa',
        row.aspiration ? `${row.aspiration}. ${ASPIRATIONS[row.aspiration] ?? ''}` : '—',
        describe(row),
      ];
      cells.forEach((text, idx) => {
        const td = document.createElement('td');
        td.textContent = text;
        if (idx === 2) td.className = row.submitted ? 'status-yes' : 'status-no';
        tr.append(td);
      });
      rows.append(tr);
    });
    $('summary').textContent = `Đã điền: ${body.done}/${body.total} · Chưa: ${body.total - body.done}`;
    $('summary').hidden = false;
    $('table').hidden = false;
    if (resultsCard) resultsCard.hidden = false;
  } catch {
    setTokenError('Không tải được trạng thái. Kiểm tra kết nối.');
    hideResults();
  }
}

tokenInput.addEventListener('input', () => setTokenError(''));
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') load();
});

$('loadBtn').addEventListener('click', load);
$('refreshBtn').addEventListener('click', load);
