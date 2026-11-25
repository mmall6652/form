import { ROSTER, BRANCHES, ASPIRATIONS, NOTICE_2, isRosterName, canonicalName } from './roster.js';

const $ = (id) => document.getElementById(id);
const form = $('survey');
const headerCard = document.querySelector('header.header-card');
const nameInput = $('fullName');
const aspBox = $('aspirations');
const conditional = $('conditional');
const submitBtn = $('submitBtn');
const clearBtn = $('clearBtn');
const clearAspBtn = $('clearAspBtn');
const aspClearWrap = $('asp-clear-wrap');
const doneBox = $('done');
const doneMsg = $('done-msg');
const editAgainBtn = $('editAgainBtn');

// Gửi qua API thật (xem tests/verify-server.mjs để mock boundary khi test).

function clearError(id) {
  const el = $(id);
  if (!el) return;
  el.textContent = '';
  el.closest('.card')?.classList.remove('has-error');
}

function setError(id, msg) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.closest('.card')?.classList.add('has-error');
}

function createRequiredTitle(tag, text, htmlFor) {
  const el = document.createElement(tag);
  el.className = 'q-title';
  if (htmlFor) el.setAttribute('for', htmlFor);
  el.textContent = `${text} `;
  const req = document.createElement('span');
  req.className = 'req';
  req.textContent = '*';
  el.append(req);
  return el;
}

// --- Render danh sách tên + nguyện vọng ---
$('roster').innerHTML = '';
for (const name of ROSTER) {
  const opt = document.createElement('option');
  opt.value = name;
  $('roster').append(opt);
}

for (const [value, label] of Object.entries(ASPIRATIONS)) {
  const wrap = document.createElement('label');
  wrap.className = 'option';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'aspiration';
  radio.value = value;
  const span = document.createElement('span');
  span.textContent = `${value}. ${label}`;
  radio.addEventListener('change', renderConditional);
  wrap.append(radio, span);
  aspBox.append(wrap);
}

function aspirationValue() {
  return aspBox.querySelector('input[name="aspiration"]:checked')?.value ?? null;
}

function renderConditional() {
  conditional.innerHTML = '';
  conditional.classList.remove('has-error');
  const value = aspirationValue();
  if (aspClearWrap) aspClearWrap.hidden = !value;

  if (value === '2' || value === '3') {
    conditional.hidden = false;
    if (value === '2') {
      const notice = document.createElement('p');
      notice.className = 'notice';
      notice.textContent = NOTICE_2;
      conditional.append(notice);
    }
    const fieldset = document.createElement('fieldset');
    fieldset.append(createRequiredTitle('legend', 'Chọn bưu cục'));
    const options = document.createElement('div');
    options.className = 'options';
    for (const branch of BRANCHES) {
      const label = document.createElement('label');
      label.className = 'option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'branch';
      radio.value = branch;
      radio.addEventListener('change', () => clearError('err-branch'));
      const span = document.createElement('span');
      span.textContent = branch;
      label.append(radio, span);
      options.append(label);
    }
    fieldset.append(options);
    conditional.append(fieldset);
    const err = document.createElement('p');
    err.className = 'error';
    err.id = 'err-branch';
    err.setAttribute('role', 'alert');
    conditional.append(err);
  } else if (value === '5') {
    conditional.hidden = false;
    const label = createRequiredTitle('label', 'Ghi rõ nguyện vọng khác', 'otherText');
    const field = document.createElement('div');
    field.className = 'gf-field';
    const textarea = document.createElement('textarea');
    textarea.id = 'otherText';
    textarea.name = 'otherText';
    textarea.rows = 3;
    textarea.maxLength = 1000;
    textarea.placeholder = 'Nhập chi tiết nguyện vọng riêng của bạn...';
    const meta = document.createElement('div');
    meta.className = 'field-meta';
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = 'Nội dung này sẽ được gửi riêng cho quản lý xem xét.';
    const counter = document.createElement('span');
    counter.className = 'char-count';
    counter.textContent = '0 / 1000';
    meta.append(hint, counter);

    textarea.addEventListener('input', () => {
      textarea.classList.remove('is-invalid');
      clearError('err-other');
      counter.textContent = `${textarea.value.length} / 1000`;
    });
    field.append(textarea);
    const err = document.createElement('p');
    err.className = 'error';
    err.id = 'err-other';
    err.setAttribute('role', 'alert');
    conditional.append(label, field, meta, err);
  } else {
    conditional.hidden = true;
  }
  clearError('err-asp');
}

nameInput.addEventListener('input', () => {
  nameInput.classList.remove('is-invalid');
  clearError('err-name');
});

clearAspBtn?.addEventListener('click', () => {
  for (const r of aspBox.querySelectorAll('input[name="aspiration"]')) {
    r.checked = false;
  }
  renderConditional();
});

clearBtn?.addEventListener('click', () => {
  form.reset();
  nameInput.classList.remove('is-invalid');
  clearError('err-name');
  clearError('err-asp');
  clearError('err-global');
  renderConditional();
});

function validate() {
  let ok = true;
  clearError('err-name'); clearError('err-asp'); clearError('err-global');
  nameInput.classList.remove('is-invalid');

  const name = nameInput.value;
  if (!isRosterName(name)) {
    setError('err-name', 'Vui lòng chọn họ tên đúng trong danh sách.');
    nameInput.classList.add('is-invalid');
    ok = false;
  }
  const asp = aspirationValue();
  if (!asp) {
    setError('err-asp', 'Vui lòng chọn một nguyện vọng.');
    ok = false;
  } else if (asp === '2' || asp === '3') {
    const branch = conditional.querySelector('input[name="branch"]:checked');
    if (!branch) {
      setError('err-branch', 'Vui lòng chọn một bưu cục.');
      ok = false;
    }
  } else if (asp === '5') {
    const otherEl = $('otherText');
    const other = otherEl?.value.trim() ?? '';
    if (!other) {
      otherEl?.classList.add('is-invalid');
      setError('err-other', 'Vui lòng ghi rõ nguyện vọng.');
      ok = false;
    }
  }
  return ok;
}

function payload() {
  const asp = Number(aspirationValue());
  const data = {
    fullName: canonicalName(nameInput.value),
    aspiration: asp,
    branch: (asp === 2 || asp === 3)
      ? conditional.querySelector('input[name="branch"]:checked')?.value ?? null
      : null,
    otherText: asp === 5 ? ($('otherText')?.value.trim() ?? '') : null,
  };
  return data;
}

function showDone(message) {
  if (headerCard) headerCard.hidden = true;
  form.hidden = true;
  doneMsg.textContent = message;
  doneBox.hidden = false;
}

editAgainBtn?.addEventListener('click', () => {
  doneBox.hidden = true;
  if (headerCard) headerCard.hidden = false;
  form.hidden = false;
  clearError('err-global');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function send(data) {
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  let body = {};
  try { body = await res.json(); } catch { /* response không JSON */ }
  return { status: res.status, body };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validate()) return;
  const data = payload();
  submitBtn.disabled = true;
  try {
    const { status, body } = await send(data);
    if (status === 200 || status === 201) {
      let detail = ASPIRATIONS[data.aspiration];
      if (data.branch) detail += ` (${data.branch})`;
      if (data.otherText) detail += ` — "${data.otherText}"`;
      const prefix = body?.updated
        ? `Đã cập nhật nguyện vọng cho ${data.fullName}`
        : `Cảm ơn ${data.fullName}. Nguyện vọng đã được ghi nhận`;
      showDone(`${prefix}: ${detail}.`);
    } else if (status === 409) {
      // Trường hợp cũ (server bản cũ) — giữ lại để tương thích.
      const old = body?.existing;
      const oldLabel = old ? ASPIRATIONS[old.aspiration] ?? 'đã gửi' : 'đã gửi';
      showDone(`Đã gửi: ${data.fullName} đã đăng ký nguyện vọng ${oldLabel} trước đó. Không cần gửi lại.`);
    } else if (status >= 500 || status === 0) {
      setError('err-global', 'Gửi chưa thành công. Vui lòng thử lại.');
    } else {
      setError('err-global', body?.error ?? 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.');
    }
  } catch {
    setError('err-global', 'Gửi chưa thành công. Vui lòng thử lại.');
  } finally {
    submitBtn.disabled = false;
  }
});

// Khi quay lại trang sau khi gửi: vẫn cho gửi (server là nguồn quyết định),
// nhưng báo rõ qua 409 thay vì giả vờ thành công.
renderConditional();
