import { ASPIRATIONS, BRANCHES } from './roster.js';

const $ = (id) => document.getElementById(id);
const tokenInput = $('token');
const errEl = $('err');
const tokenCard = tokenInput.closest('.card');
const overviewCard = $('overviewCard');
const otherListCard = $('otherListCard');
const resultsCard = $('resultsCard');
const searchInput = $('searchInput');
const filterSelect = $('filterSelect');
const exportCsvBtn = $('exportCsvBtn');

let lastData = null;

const cached = sessionStorage.getItem('ksat.adminToken');
if (cached) { tokenInput.value = cached; }

function describe(row) {
  if (!row.submitted) return '—';
  if (row.aspiration === 2 || row.aspiration === 3) return row.branch ?? '—';
  if (row.aspiration === 5) return row.otherText ?? '—';
  return '—';
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function setTokenError(msg) {
  errEl.textContent = msg;
  tokenCard?.classList.toggle('has-error', Boolean(msg));
  tokenInput.classList.toggle('is-invalid', Boolean(msg));
}

function hideResults() {
  $('table').hidden = true;
  $('summary').hidden = true;
  if (overviewCard) overviewCard.hidden = true;
  if (otherListCard) otherListCard.hidden = true;
  if (resultsCard) resultsCard.hidden = true;
}

function renderBreakdown(data) {
  const box = $('breakdown');
  box.innerHTML = '';
  const total = data.total || 1;
  const fill = $('progressFill');
  if (fill) fill.style.width = `${Math.round((data.done / total) * 100)}%`;

  for (const [key, label] of Object.entries(ASPIRATIONS)) {
    const aspNum = Number(key);
    const matching = data.rows.filter((r) => r.submitted && r.aspiration === aspNum);
    const count = matching.length;
    const pct = data.done ? Math.round((count / data.done) * 100) : 0;

    const item = document.createElement('div');
    item.className = 'breakdown-item';

    const top = document.createElement('div');
    top.className = 'breakdown-top';
    const nameEl = document.createElement('span');
    nameEl.className = 'breakdown-label';
    nameEl.textContent = `${key}. ${label}`;
    const statEl = document.createElement('span');
    statEl.className = 'breakdown-stat';
    statEl.textContent = `${count} (${pct}%)`;
    top.append(nameEl, statEl);

    const track = document.createElement('div');
    track.className = 'breakdown-track';
    const bar = document.createElement('div');
    bar.className = 'breakdown-bar';
    bar.style.width = `${pct}%`;
    track.append(bar);

    item.append(top, track);

    if ((aspNum === 2 || aspNum === 3) && count > 0) {
      const pills = document.createElement('div');
      pills.className = 'branch-pills';
      const branchKeys = [...new Set([...BRANCHES, ...matching.map((r) => r.branch).filter(Boolean)])];
      for (const b of branchKeys) {
        const bCount = matching.filter((r) => r.branch === b).length;
        if (bCount > 0) {
          const pill = document.createElement('span');
          pill.className = 'branch-pill';
          pill.textContent = `${b}: ${bCount}`;
          pills.append(pill);
        }
      }
      if (pills.children.length > 0) item.append(pills);
    }

    box.append(item);
  }
}

function renderOtherList(data) {
  const list = $('otherList');
  const countBadge = $('otherCount');
  list.innerHTML = '';
  const others = data.rows.filter((r) => r.submitted && r.aspiration === 5);
  if (countBadge) countBadge.textContent = String(others.length);

  if (others.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-note';
    empty.textContent = 'Chưa có nhân viên nào chọn nguyện vọng khác.';
    list.append(empty);
    return;
  }

  for (const row of others) {
    const card = document.createElement('div');
    card.className = 'other-item';
    const head = document.createElement('div');
    head.className = 'other-item-head';
    const who = document.createElement('strong');
    who.textContent = row.fullName;
    const when = document.createElement('span');
    when.className = 'other-time';
    when.textContent = formatTime(row.submittedAt);
    head.append(who, when);

    const text = document.createElement('p');
    text.className = 'other-item-text';
    text.textContent = row.otherText ?? '—';

    card.append(head, text);
    list.append(card);
  }
}

function renderTable() {
  if (!lastData) return;
  const rowsEl = $('rows');
  rowsEl.innerHTML = '';

  const q = (searchInput?.value ?? '').trim().toLowerCase();
  const mode = filterSelect?.value ?? 'all';

  const indexed = lastData.rows.map((row, idx) => ({ row, num: idx + 1 }));
  const filtered = indexed.filter(({ row }) => {
    if (mode === 'done' && !row.submitted) return false;
    if (mode === 'pending' && row.submitted) return false;
    if (['1', '2', '3', '4', '5'].includes(mode) && String(row.aspiration) !== mode) return false;
    if (q) {
      const hay = `${row.fullName} ${describe(row)} ${ASPIRATIONS[row.aspiration] ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'empty-row';
    td.textContent = 'Không có dòng nào phù hợp bộ lọc.';
    tr.append(td);
    rowsEl.append(tr);
    return;
  }

  for (const { row, num } of filtered) {
    const tr = document.createElement('tr');
    const cells = [
      String(num),
      row.fullName,
      row.submitted ? 'Đã điền' : 'Chưa',
      row.aspiration ? `${row.aspiration}. ${ASPIRATIONS[row.aspiration] ?? ''}` : '—',
      describe(row),
      formatTime(row.submittedAt),
    ];
    cells.forEach((text, idx) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (idx === 2) td.className = row.submitted ? 'status-yes' : 'status-no';
      if (idx === 4 && row.aspiration === 5) td.className = 'cell-other-text';
      tr.append(td);
    });
    rowsEl.append(tr);
  }
}

function exportCsv() {
  if (!lastData) return;
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['STT', 'Họ tên', 'Trạng thái', 'Nguyện vọng', 'Bưu cục / Nguyện vọng riêng', 'Thời gian gửi'];
  const lines = [header.map(esc).join(',')];
  lastData.rows.forEach((row, i) => {
    lines.push([
      i + 1,
      row.fullName,
      row.submitted ? 'Đã điền' : 'Chưa',
      row.aspiration ? `${row.aspiration}. ${ASPIRATIONS[row.aspiration] ?? ''}` : '',
      row.submitted ? describe(row) : '',
      row.submittedAt ? new Date(row.submittedAt).toLocaleString('vi-VN') : '',
    ].map(esc).join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `khao-sat-nguyen-vong-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
    lastData = body;
    $('summary').textContent = `Đã điền: ${body.done}/${body.total} · Chưa: ${body.total - body.done}`;
    $('summary').hidden = false;
    $('table').hidden = false;
    if (overviewCard) overviewCard.hidden = false;
    if (otherListCard) otherListCard.hidden = false;
    if (resultsCard) resultsCard.hidden = false;

    renderBreakdown(body);
    renderOtherList(body);
    renderTable();
  } catch {
    setTokenError('Không tải được trạng thái. Kiểm tra kết nối.');
    hideResults();
  }
}

tokenInput.addEventListener('input', () => setTokenError(''));
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') load();
});

searchInput?.addEventListener('input', renderTable);
filterSelect?.addEventListener('change', renderTable);
exportCsvBtn?.addEventListener('click', exportCsv);

$('loadBtn').addEventListener('click', load);
$('refreshBtn').addEventListener('click', load);
