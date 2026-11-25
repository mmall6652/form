// DOM verification bằng Chromium thật (puppeteer-core) chạy local, không jsdom.
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const TOKEN = 'test-admin-token';
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('PASS:', msg); };

// Reset mock store để gate lặp lại được nhiều lần.
await fetch(`${BASE}/__reset`, { method: 'POST' });

const browser = await puppeteer.launch({
  executablePath: '/snap/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function newPage(path) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/401 \(Unauthorized\)|404 \(Not Found\)/.test(t)) errors.push(t);
  });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('input[name=aspiration]').length > 0 ||
    document.querySelectorAll('#rows tr').length > 0, { timeout: 5000 }).catch(() => {});
  return { page, errors };
}

const pick = (page, v) => page.click(`input[name=aspiration][value="${v}"]`);
const submit = async (page) => { await page.click('#submitBtn'); await new Promise((r) => setTimeout(r, 350)); };

try {
  // ---- Survey ----
  const { page, errors } = await newPage('/');
  assert(await page.$$eval('#roster option', (n) => n.length) === 22, 'dropdown đúng 22 tên');
  assert(await page.$$eval('input[name=aspiration]', (n) => n.length) === 5, '5 nguyện vọng');

  await pick(page, '2');
  const notice = await page.$eval('#conditional .notice', (e) => e.textContent);
  assert(notice === 'Bộ phận này đang lên kế hoạch bạn có thể xuống 1 trong 5 bưu cục trên làm tạm vài tháng không.',
    'NV2 thông báo đúng từng chữ');
  const branches = await page.$$eval('input[name=branch]', (ns) => ns.map((n) => n.value));
  assert(
    branches.join('|') === 'Hoà Vang (bưu tá)|Hoà Quý (bưu tá)|Hoà Xuân (bưu tá)|Liên Chiểu (bưu tá)|Hải Vân (Bưu tá, Khai thác)',
    'NV2 5 bưu cục đúng'
  );

  await pick(page, '3');
  assert((await page.$$('input[name=branch]')).length === 5 && !(await page.$('.notice')),
    'NV3 5 bưu cục, không có notice NV2');

  await pick(page, '5');
  assert(Boolean(await page.$('#otherText')), 'NV5 textarea hiện');
  assert((await page.$$('input[name=branch]')).length === 0, 'NV5 không còn bưu cục');

  await pick(page, '1');
  assert(await page.$eval('#conditional', (e) => e.children.length) === 0, 'NV1 conditional trống');

  // validate tên lạ
  await page.$eval('#fullName', (e) => { e.value = 'Người Lạ'; });
  await pick(page, '1');
  await submit(page);
  assert((await page.$eval('#err-name', (e) => e.textContent)).includes('đúng trong danh sách'),
    'tên lạ bị chặn inline');

  // gửi thật NV2 + Hoà Vang (bưu tá)
  await page.$eval('#fullName', (e) => { e.value = 'Huỳnh Thế Phương'; });
  await pick(page, '2');
  await submit(page);
  assert((await page.$eval('#err-branch', (e) => e.textContent)).includes('chọn một bưu cục'),
    'NV2 thiếu bưu cục -> lỗi inline');
  await page.$eval('input[name=branch][value="Hoà Vang (bưu tá)"]', (e) => e.click());
  await submit(page);
  const doneMsg = await page.$eval('#done-msg', (e) => e.textContent);
  assert(doneMsg.includes('Huỳnh Thế Phương') && doneMsg.includes('hàng xuất'),
    'gửi NV2 thành công, hiện tên + nguyện vọng');
  assert(errors.length === 0, `form không lỗi JS (${errors.join('; ') || 'none'})`);

  // gửi trùng ở tab mới
  const dup = await newPage('/');
  await dup.page.$eval('#fullName', (e) => { e.value = 'Huỳnh Thế Phương'; });
  await pick(dup.page, '1');
  await submit(dup.page);
  const dupMsg = await dup.page.$eval('#done-msg', (e) => e.textContent);
  assert(/Đã cập nhật nguyện vọng/i.test(dupMsg), 'gửi lại cùng tên -> cập nhật thành công (200), không bị chặn');
  await dup.page.close();

  // Lịch sử phải giữ bản cũ (NV2 Hoà Vang) bên cạnh bản mới (NV1).
  const hist = await fetch(`${BASE}/api/history`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());
  const entries = Object.entries(hist).find(([k]) => k.toLowerCase().includes('huỳnh thế phương'))?.[1] ?? [];
  assert(entries.length === 1 && entries[0].aspiration === 2 && entries[0].branch === 'Hoà Vang (bưu tá)',
    'lịch sử giữ bản cũ (NV2/Hoà Vang), không xoá');

  // Thêm 1 người NV2 để phủ cả 2 nhánh (NV1 + NV2) ở trang status, và kiểm tra nút điền lại.
  const nv2 = await newPage('/');
  await nv2.page.$eval('#fullName', (e) => { e.value = 'Văn Bá Thảo'; });
  await pick(nv2.page, '2');
  await nv2.page.$eval('input[name=branch][value="Hoà Vang (bưu tá)"]', (e) => e.click());
  await submit(nv2.page);
  assert((await nv2.page.$eval('#done-msg', (e) => e.textContent)).includes('hàng xuất'),
    'gửi NV2 cho Văn Bá Thảo thành công');
  await nv2.page.click('#editAgainBtn');
  assert(await nv2.page.$eval('#survey', (e) => !e.hidden), 'bấm Điền lại / Cập nhật mở lại form');
  await nv2.page.close();

  // ---- Status ----
  const st = await newPage('/status.html');
  const sp = st.page;
  await sp.click('#loadBtn');
  await new Promise((r) => setTimeout(r, 200));
  assert((await sp.$eval('#err', (e) => e.textContent)).includes('mã quản lý'), 'status thiếu token -> lỗi inline');

  await sp.$eval('#token', (e) => { e.value = 'sai-token'; });
  await sp.click('#loadBtn');
  await new Promise((r) => setTimeout(r, 350));
  assert((await sp.$eval('#err', (e) => e.textContent)).includes('Không có quyền'), 'status sai token -> 401');

  await sp.$eval('#token', (e, t) => { e.value = t; }, TOKEN);
  await sp.click('#loadBtn');
  await new Promise((r) => setTimeout(r, 400));
  const count = await sp.$$eval('#rows tr', (n) => n.length);
  assert(count === 22, 'status đúng 22 dòng');
  const summary = await sp.$eval('#summary', (e) => e.textContent);
  assert(summary.includes('Đã điền: 2/22'), `status tổng hợp 2/22 (${summary})`);
  const huynh = await sp.$$eval('#rows tr', (rows) => {
    const r = rows.find((x) => x.children[1].textContent === 'Huỳnh Thế Phương');
    return [r.children[2].textContent, r.children[3].textContent, r.children[4].textContent, r.children[6].textContent];
  });
  assert(huynh[0] === 'Đã điền' && huynh[1].includes('hàng nặng') && huynh[2] === '—' && huynh[3].includes('Hoà Vang (bưu tá)'),
    'status: Huỳnh Thế Phương = Đã điền, NV1 mới, vẫn giữ lịch sử NV2 Hoà Vang (bưu tá)');
  const vanBaThao = await sp.$$eval('#rows tr', (rows) => {
    const r = rows.find((x) => x.children[1].textContent === 'Văn Bá Thảo');
    return [r.children[2].textContent, r.children[3].textContent, r.children[4].textContent];
  });
  assert(vanBaThao[0] === 'Đã điền' && vanBaThao[1].includes('hàng xuất') && vanBaThao[2] === 'Hoà Vang (bưu tá)',
    'status: Văn Bá Thảo = Đã điền, NV2, Hoà Vang (bưu tá)');
  const chua = await sp.$$eval('#rows tr', (rows) => rows.filter((x) => x.children[2].textContent === 'Chưa').length);
  assert(chua === 20, 'status: 20 người Chưa');
  assert(st.errors.length === 0, `status không lỗi JS (${st.errors.join('; ') || 'none'})`);
  await sp.close();

  await page.close();
  console.log('\nALL BROWSER GATES PASSED');
} finally {
  await browser.close();
}
