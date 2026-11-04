// ───────── Supabase 연결 ─────────
// supabase.com 프로젝트 → Project Settings → API 에서 복사해서 붙여넣기
const SUPABASE_URL = 'https://tcyzvtsveihvzgzgixdy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Tv8pirPA7x0t5ify4sUwtA_1uJoC-O5';
const BUCKET = 'artworks';     // 사진 저장소 이름
const MAX_SIZE = 1600;         // 사진 올릴 때 긴 변을 이 크기(px)로 줄여서 무료 용량 아끼기

const db = SUPABASE_URL.startsWith('https://')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// DB 요청 실행: 실패하면 알려주고 { error } 돌려줌
async function run(query) {
  if (!db) {
    alert('sketch.js 맨 위에 Supabase 주소와 키를 먼저 넣어주세요.');
    return { error: true };
  }
  const res = await query;
  if (res.error) alert('저장에 실패했어요: ' + res.error.message);
  return res;
}

// 들어오자마자 음악 재생
// 브라우저는 사용자가 한 번도 누르지 않은 페이지의 소리를 막을 수 있어서,
// 막히면 처음 클릭·키 입력 때 바로 재생
const bgm = document.querySelector('.bgm');
function playBgm() {
  bgm.play().then(() => {
    ['pointerdown', 'keydown', 'touchstart'].forEach((t) => document.removeEventListener(t, playBgm));
  }).catch(() => {});
}
['pointerdown', 'keydown', 'touchstart'].forEach((t) => document.addEventListener(t, playBgm));
playBgm();

// 첫 화면(art.jpg): 2초 보여준 뒤 사라지고 메인 페이지
const splash = document.querySelector('.splash');
setTimeout(() => {
  splash.classList.add('is-gone');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
}, 2000);

const windows = document.querySelector('.windows');
const addBtn = document.querySelector('.add-btn');
const modal = document.querySelector('.modal');
const modalClose = document.querySelector('.modal-close');
const form = document.querySelector('.modal-body');
const hallNum = document.querySelector('.hall-num');

const gallery = document.querySelector('.gallery');
const track = document.querySelector('.gallery-track');
const caption = document.querySelector('.gallery-caption');
const note = document.querySelector('.gallery-note');
const designBtn = document.querySelector('.design-btn');

// 만들어진 전시관 정보 (순서 = 전시관 번호 - 1)
const halls = [];

// + 버튼: 가운데 창 열기 (전시관 번호 = 지금 창 개수 + 1)
addBtn.addEventListener('click', () => {
  hallNum.textContent = windows.children.length + 1;
  form.reset();
  modal.showModal();
});

// 🖌️ 붓 버튼: 그림판 열기 (그림판 코드는 맨 아래)
document.querySelector('.brush-btn').addEventListener('click', () => {
  paint.hidden = false;
});

// × 버튼, 창 바깥 클릭, Esc 키로 닫기
modalClose.addEventListener('click', () => {
  modal.close();
});
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.close();
});

// '전시관 만들기': 입력한 내용으로 아래에 창 추가
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const hall = {
    name: data.get('name').trim(),
    maker: data.get('maker').trim(),
    theme: data.get('theme').trim(),
    desc: data.get('desc').trim(),
  };
  const submitBtn = form.querySelector('.submit-btn');
  submitBtn.disabled = true;
  const { data: row, error } = await run(db?.from('halls')
    .insert({ name: hall.name, maker: hall.maker, theme: hall.theme, description: hall.desc })
    .select().single());
  submitBtn.disabled = false;
  if (error) return;

  hall.id = row.id;
  hall.nodes = [];
  hall.edges = [];
  addWindow(hall);
  modal.close();
});

// 아래 창 하나 추가 (창들은 CSS flex로 자동으로 폭을 나눠 가짐)
function addWindow(hall) {
  halls.push(hall);
  const count = halls.length;

  const win = document.createElement('section');
  win.className = 'window';
  win.innerHTML = `
    <div class="window-head">
      <button class="window-bar" type="button">
        <span class="bar-name"><span class="bar-num">${count}</span><span class="bar-label">전시관</span></span>
        <span class="bar-enter">입장 →</span>
      </button>
      <button class="window-del" type="button" aria-label="전시관 지우기" title="전시관 지우기">×</button>
    </div>
    <div class="window-body">
      <div class="win-info">
        <h2 class="hall-name"></h2>
        <p class="hall-maker"></p>
        <div class="hall-more"><div>
          <p class="hall-theme"></p>
          <p class="hall-desc"></p>
        </div></div>
      </div>
      <div class="win-arts"></div>
    </div>
  `;
  // 입력한 글은 textContent로 넣어야 <, > 같은 글자도 그대로 보임
  win.querySelector('.hall-name').textContent = hall.name;
  win.querySelector('.hall-maker').textContent = hall.maker;
  win.querySelector('.hall-theme').textContent = hall.theme;
  win.querySelector('.hall-desc').textContent = hall.desc;

  // 전시관 N 누르면 그 전시로 들어가기
  win.querySelector('.window-bar').addEventListener('click', () => {
    openGallery(count);
  });
  // × : 전시관 지우기
  win.querySelector('.window-del').addEventListener('click', () => deleteHall(hall));

  windows.appendChild(win);
  renderWindowArts(count);
}

// 전시관 지우기: 작품·연결선(DB에서 같이 지워짐)과 사진 파일까지
// 전시관 순서: 댓글 많은 전시관이 왼쪽(앞), 댓글 수가 같으면 먼저 만든 전시관이 왼쪽
function hallCommentCount(hall) {
  return (hall.nodes || []).reduce(
    (sum, node) => sum + (comments.get(node.id) || []).filter((c) => c.text).length, 0);
}

function reorderWindows() {
  const sorted = [...halls].sort((a, b) =>
    hallCommentCount(b) - hallCommentCount(a) || a.id - b.id);
  halls.length = 0;
  windows.innerHTML = '';
  sorted.forEach(addWindow);   // 번호(전시관 N)도 새 순서대로
}

async function deleteHall(hall) {
  if (!confirm(`'${hall.name}' 전시관을 지울까요?\n안에 있는 작품도 모두 지워지고, 되돌릴 수 없어요.`)) return;

  const { error } = await run(db?.from('halls').delete().eq('id', hall.id));
  if (error) return;
  const paths = (hall.nodes || []).map((n) => n.imagePath);
  if (paths.length) run(db.storage.from(BUCKET).remove(paths));

  // 번호(전시관 N)가 당겨지니까 창들을 처음부터 다시 그림
  const rest = halls.filter((h) => h !== hall);
  halls.length = 0;
  windows.innerHTML = '';
  rest.forEach(addWindow);
}

// 메인 창 안, 전시관 설명 밑에 작품들 (전시 순서대로: 제목, 작가, 이미지, 해석)
function renderWindowArts(num) {
  const box = windows.children[num - 1].querySelector('.win-arts');
  box.innerHTML = '';
  exhibitOrder(halls[num - 1]).forEach((art, i) => {
    const el = document.createElement('article');
    el.className = 'win-art';
    el.innerHTML = `
      <p class="win-art-title"><span class="win-art-num"></span> <span class="win-art-name"></span></p>
      <p class="win-art-artist"></p>
      <img alt="">
      <p class="win-art-note"></p>
    `;
    el.querySelector('.win-art-num').textContent = `(${String(i + 1).padStart(2, '0')})`;
    el.querySelector('.win-art-name').textContent = art.title || '무제';
    el.querySelector('.win-art-artist').textContent = art.artist || '';
    el.querySelector('img').src = art.src;
    el.querySelector('.win-art-note').textContent = art.note || '';
    box.appendChild(el);
  });
}

// ───────── 전시 화면 ─────────

const ART_COUNT = 10;      // 전시관마다 작품 칸 개수 (지금은 빈 칸)
const SMALL = 0.26;        // 옆 작품 최대 높이 (화면 높이 대비)
const BIG = 0.56;          // 가운데 작품 최대 높이 (화면 높이 대비)
const MAX_WIDE = 1.6;      // 최대 너비 = 최대 높이 × 이 값 (가로로 긴 사진이 너무 넓어지지 않게)
const RATIO = 3 / 4;       // 사진 없는 회색 칸·사진 불러오는 중의 가로:세로
const GAP = 48;            // 작품 사이 간격(px)

let items = [];            // 작품 칸 요소들
let pos = 0;               // 지금 가운데에 있는 위치 (소수 = 넘어가는 중)
let target = 0;            // 가야 할 위치
let animating = false;
let snapTimer;
let currentNum;            // 지금 들어가 있는 전시관 번호
let artworks = [];         // 전시 순서대로 놓인 사진 노드들 (제목·작가·해석 포함)
let hallName = '';

function openGallery(num) {
  currentNum = num;
  const hall = halls[num - 1];
  gallery.querySelector('.g-theme').textContent = hall.theme;
  gallery.querySelector('.g-desc').textContent = hall.desc;

  // 작품 칸 만들기: 설계 방에 올린 사진이 있으면 그 사진들, 없으면 회색 빈 칸
  artworks = exhibitOrder(hall);
  const count = artworks.length || ART_COUNT;
  hallName = hall.name;
  track.innerHTML = '';
  items = [];
  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'art-item';
    if (artworks.length) {
      const img = document.createElement('img');
      img.src = artworks[i].src;
      // 사진 원래 크기를 알게 되면 그 비율로 다시 배치
      img.addEventListener('load', () => {
        item.dataset.w = img.naturalWidth;
        item.dataset.h = img.naturalHeight;
        layout();
      });
      item.appendChild(img);
    } else {
      const l1 = 55 + ((i * 37) % 35);
      const l2 = 20 + ((i * 53) % 45);
      item.style.background = `linear-gradient(160deg, hsl(30, 6%, ${l1}%), hsl(30, 6%, ${l2}%))`;
    }
    item.addEventListener('click', () => {
      if (!gallery.classList.contains('comment-mode')) goTo(i);   // 댓글 모드에선 넘기지 않고 글쓰기
    });
    track.appendChild(item);
    items.push(item);
  }

  pos = target = 0;
  shownActive = -1;
  gallery.hidden = false;
  layout();
  requestAnimationFrame(() => gallery.classList.add('is-open'));
}

function closeGallery() {
  setCommentMode(false);
  gallery.classList.remove('is-open');
  setTimeout(() => { gallery.hidden = true; }, 400);
  reorderWindows();   // 그 사이 달린 댓글 수에 맞춰 순서 다시
}

// 작품 크기·위치 계산: 가운데에 가까울수록 크게
function layout() {
  const vh = window.innerHeight;
  const centerY = vh / 2;
  // 사진 원래 가로세로 비율 그대로. 칸(최대 높이·너비)보다 크면 비율 유지하며 줄이고, 작으면 원래 크기
  const sizes = items.map((item, i) => {
    const t = Math.max(0, 1 - Math.abs(i - pos)); // 가운데면 1, 한 칸 이상 떨어지면 0
    const maxH = vh * (SMALL + (BIG - SMALL) * t);
    const maxW = maxH * MAX_WIDE;
    const nw = Number(item.dataset.w);
    const nh = Number(item.dataset.h);
    if (!nw || !nh) return { w: maxH * RATIO, h: maxH };   // 회색 칸, 아직 불러오는 중
    const scale = Math.min(1, maxW / nw, maxH / nh);
    return { w: nw * scale, h: nh * scale };
  });

  // 왼쪽부터 차례로 놓기
  const xs = [];
  let x = 0;
  sizes.forEach((s) => { xs.push(x); x += s.w + GAP; });

  // pos 위치의 작품이 화면 가운데 오도록 전체를 밀기
  const a = Math.floor(pos);
  const b = Math.min(a + 1, items.length - 1);
  const ca = xs[a] + sizes[a].w / 2;
  const cb = xs[b] + sizes[b].w / 2;
  const offset = window.innerWidth / 2 - (ca + (cb - ca) * (pos - a));

  const active = Math.round(pos);
  items.forEach((item, i) => {
    const s = sizes[i];
    item.style.width = s.w + 'px';
    item.style.height = s.h + 'px';
    item.style.transform = `translate(${xs[i] + offset}px, ${centerY - s.h / 2}px)`;
    item.classList.toggle('is-active', i === active);   // 댓글 모드에서 이 작품만 또렷하게
  });

  // 가운데 작품 왼쪽 위에 번호 + 제목
  const s = sizes[active];
  const art = artworks[active];
  caption.querySelector('.cap-num').textContent = `(${String(active + 1).padStart(2, '0')})`;
  caption.querySelector('.cap-title').textContent = art ? (art.title || '무제') : hallName;
  caption.querySelector('.cap-artist').textContent = art ? art.artist : '';
  caption.style.transform = `translate(${xs[active] + offset}px, ${centerY - s.h / 2 - 12}px) translateY(-100%)`;

  // 가운데 작품 아래에 해석
  note.textContent = art ? art.note : '';
  note.style.transform = `translate(${xs[active] + offset}px, ${centerY + s.h / 2 + 12}px)`;
  note.style.width = s.w + 'px';

  const fade = Math.max(0, 1 - Math.abs(pos - active) * 4);
  caption.style.opacity = fade;
  note.style.opacity = fade;

  // 댓글 층: 가운데 작품에 딱 겹치게. 가운데 작품이 바뀌면 그 작품에 쓴 글만 보이게
  commentLayer.style.transform = `translate(${xs[active] + offset}px, ${centerY - s.h / 2}px)`;
  commentLayer.style.width = s.w + 'px';
  commentLayer.style.height = s.h + 'px';
  commentLayer.style.opacity = fade;
  if (active !== shownActive) {
    shownActive = active;
    renderComments();
  }
}

// 부드럽게 target 쪽으로 이동
function animate() {
  pos += (target - pos) * 0.12;
  if (Math.abs(target - pos) < 0.001) pos = target;
  layout();
  if (pos !== target) {
    requestAnimationFrame(animate);
  } else {
    animating = false;
  }
}
function goTo(i) {
  target = Math.max(0, Math.min(items.length - 1, i));
  if (!animating) {
    animating = true;
    requestAnimationFrame(animate);
  }
}

// 스크롤(휠/트랙패드)하면 작품이 넘어가고, 멈추면 가장 가까운 작품에 딱 맞춤
gallery.addEventListener('wheel', (e) => {
  e.preventDefault();
  goTo(target + (e.deltaY + e.deltaX) * 0.004);
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => goTo(Math.round(target)), 150);
}, { passive: false });

document.addEventListener('keydown', (e) => {
  if (gallery.hidden) return;
  if (!design.hidden) {                 // 설계 방이 열려 있으면 Esc는 설계 방만 닫기
    if (e.key === 'Escape') closeDesign();
    return;
  }
  if (e.key === 'Escape') {
    if (gallery.classList.contains('comment-mode')) setCommentMode(false);   // 댓글 모드면 모드만 끄기
    else closeGallery();
  }
  if (e.key === 'ArrowRight') goTo(Math.round(target) + 1);
  if (e.key === 'ArrowLeft') goTo(Math.round(target) - 1);
});

window.addEventListener('resize', () => { if (!gallery.hidden) layout(); });

// '← 메인으로': 전시관에서 메인 화면으로
document.querySelector('.gallery-home').addEventListener('click', closeGallery);

// '댓글 달기' 버튼: 댓글 모드 켜기/끄기
// 켜지면 가운데 작품 말고는 흐려지고, 커서가 댓글 모양
const commentBtn = document.querySelector('.comment-btn');
commentBtn.addEventListener('click', () => {
  setCommentMode(!gallery.classList.contains('comment-mode'));
});

function setCommentMode(on) {
  gallery.classList.toggle('comment-mode', on);
  commentBtn.classList.toggle('is-on', on);
  commentBtn.setAttribute('aria-pressed', on);
  // 댓글 모드가 아닐 땐 댓글을 고칠 수 없게 (쓰던 글은 저장하고 끝냄)
  commentLayer.querySelector('.comment-text:focus')?.blur();
  commentLayer.querySelectorAll('.comment-text').forEach((el) => {
    el.contentEditable = on ? 'plaintext-only' : 'false';
  });
}

// ───────── 댓글: 클릭한 자리에 바로 글쓰기 ─────────
// 위치는 가운데 작품 기준 비율로 기억 → 그 작품이 가운데 올 때만 보임
// Supabase comments 표에 저장 → 나갔다 와도, 새로고침해도, 다른 사람에게도 그대로

const commentLayer = document.querySelector('.comment-layer');
const comments = new Map();   // 작품(노드) id → [{ id, node_id, x, y, text }]
let shownActive = -1;         // 지금 글을 보여주고 있는 작품 순서

// 댓글은 실패해도 알림창 없이 조용히 (comments 표가 아직 없어도 전시는 그대로 보이게)
async function quiet(query) {
  if (!db) return { error: true };
  const res = await query;
  if (res.error) console.warn('댓글 저장 실패:', res.error.message);
  return res;
}

// 사진 있는 작품은 노드 id, 사진 없는 회색 칸은 화면에서만 (저장 안 함)
function commentKey(i) {
  return artworks[i] ? artworks[i].id : `empty-${currentNum}-${i}`;
}

function renderComments() {
  commentLayer.querySelector('.comment-text:focus')?.blur();   // 쓰던 중에 넘어가도 저장되게
  commentLayer.innerHTML = '';
  (comments.get(commentKey(shownActive)) || []).forEach((c) => commentLayer.appendChild(makeComment(c)));
}

// 처음 열 때 모든 댓글 불러오기
async function loadComments() {
  const { data, error } = await quiet(db?.from('comments').select().order('id'));
  if (error) return;
  data.forEach((c) => {
    c.key = c.node_id;
    if (!comments.has(c.node_id)) comments.set(c.node_id, []);
    comments.get(c.node_id).push(c);
  });
}

// 다 쓴 글 저장: 새 글이면 추가, 있던 글이면 수정
async function saveComment(c) {
  if (!c.node_id) return;
  await c.saving;                                   // 앞의 저장이 끝난 뒤에
  c.saving = (async () => {
    if (c.id) {
      await quiet(db?.from('comments').update({ text: c.text }).eq('id', c.id));
    } else {
      const { data: row } = await quiet(db?.from('comments')
        .insert({ node_id: c.node_id, x: c.x, y: c.y, text: c.text }).select().single());
      if (row) c.id = row.id;
    }
  })();
  await c.saving;
}

// 글 한 개: 상자 없이 글자만, 클릭하면 다시 고칠 수 있음
function makeComment(c) {
  const el = document.createElement('div');
  el.className = 'comment-text';
  el.contentEditable = gallery.classList.contains('comment-mode') ? 'plaintext-only' : 'false';
  el.spellcheck = false;
  el.style.left = c.x * 100 + '%';
  el.style.top = c.y * 100 + '%';
  el.textContent = c.text;
  let before = c.text;
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();                                     // 쓰는 중엔 ←→, Esc로 전시관이 움직이지 않게
    if ((e.key === 'Enter' && !e.shiftKey && !e.isComposing) || e.key === 'Escape') {
      e.preventDefault();
      el.blur();                                             // Enter·Esc = 다 썼음 (Shift+Enter = 줄바꿈)
    }
  });
  el.addEventListener('blur', async () => {
    const text = el.textContent.trim();
    if (!text) {                                             // 글을 다 지우고 나가면 댓글도 지우기
      const list = comments.get(c.key) || [];
      list.splice(list.indexOf(c), 1);
      el.remove();
      await c.saving;
      if (c.id) quiet(db?.from('comments').delete().eq('id', c.id));
      return;
    }
    if (text === before) return;
    before = c.text = text;
    saveComment(c);
  });
  return el;
}

// 댓글 모드에서 작품 밖 클릭 → 그 자리에 깜빡이는 커서
gallery.addEventListener('click', (e) => {
  if (!gallery.classList.contains('comment-mode')) return;
  if (e.target.closest('button, .art-item.is-active, .comment-text')) return;
  const r = commentLayer.getBoundingClientRect();
  const key = commentKey(shownActive);
  const c = {
    key,
    node_id: artworks[shownActive]?.id,
    x: (e.clientX - r.left) / r.width,
    y: (e.clientY - r.top) / r.height,
    text: '',
  };
  if (!comments.has(key)) comments.set(key, []);
  comments.get(key).push(c);
  const el = makeComment(c);
  commentLayer.appendChild(el);
  el.focus();
});

// ───────── 전시관 설계하기: 사진 노드 ─────────

const design = document.querySelector('.design');
const canvas = document.querySelector('.design-canvas');
const lines = document.querySelector('.design-lines');
const hint = document.querySelector('.design-hint');
const fileInput = document.querySelector('.design-file');
const designStatus = document.querySelector('.design-status');

const NODE_WIDTH = 180;    // 사진 노드 너비(px)

let topZ = 1;              // 클릭한 노드를 맨 앞으로
let dropPoint = { x: 0, y: 0 };
let tempLine = null;       // 연결 중일 때 따라다니는 점선

designBtn.addEventListener('click', () => openDesign(currentNum));
document.querySelector('.design-back').addEventListener('click', closeDesign);

function currentHall() {
  return halls[currentNum - 1];
}

function openDesign(num) {
  const hall = halls[num - 1];
  hall.nodes = hall.nodes || [];   // { id, x, y, src, imagePath, title, artist, note }
  hall.edges = hall.edges || [];   // { id, from, to }  (from·to = 노드 id)
  design.querySelector('.design-title').textContent = `전시관 ${num} 설계 — ${hall.name}`;

  canvas.querySelectorAll('.node').forEach((el) => el.remove());
  hall.nodes.forEach(createNodeEl);
  renumber();
  drawLines();

  design.hidden = false;
  requestAnimationFrame(() => design.classList.add('is-open'));
}

function closeDesign() {
  design.classList.remove('is-open');
  setTimeout(() => { design.hidden = true; }, 300);
  openGallery(currentNum);   // 올린 사진들로 전시 화면 다시 그리기
  renderWindowArts(currentNum);  // 메인 창 안 작품 목록도 다시
}

// 캔버스 기준 좌표
function toLocal(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// 빈 곳 클릭 → 사진 고르기 → 클릭한 자리에 놓기
canvas.addEventListener('click', (e) => {
  if (e.target !== canvas && e.target !== lines) return;
  dropPoint = toLocal(e);
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  addPhotos(fileInput.files, dropPoint);
  fileInput.value = '';
});

// 사진을 끌어다 놓으면 놓은 자리에
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  addPhotos(e.dataTransfer.files, toLocal(e));
});

async function addPhotos(files, point) {
  const hall = currentHall();
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  const added = [];

  for (const [i, file] of images.entries()) {
    designStatus.textContent = `사진 올리는 중… (${i + 1}/${images.length})`;
    const blob = await shrink(file);
    const ext = blob.type === 'image/gif' ? 'gif' : 'jpg';
    const path = `${hall.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const up = await run(db?.storage.from(BUCKET).upload(path, blob, { contentType: blob.type }));
    if (up.error) break;
    const { data: row, error } = await run(db.from('nodes').insert({
      hall_id: hall.id,
      x: point.x - NODE_WIDTH / 2 + i * 28,   // 여러 장이면 살짝씩 겹쳐서
      y: point.y - 40 + i * 28,
      image_path: path,
    }).select().single());
    if (error) break;

    const node = rowToNode(row);
    hall.nodes.push(node);
    createNodeEl(node);
    added.push(node);
  }
  designStatus.textContent = '';
  renumber();

  // 올리자마자 첫 사진의 제목 칸에 바로 쓸 수 있게
  if (added.length) {
    canvas.querySelector(`.node[data-id="${added[0].id}"] .node-field`).focus();
  }
}

// 사진 줄이기: 긴 변을 MAX_SIZE 이하로, jpg로 (움직이는 gif는 그대로)
async function shrink(file) {
  if (file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIZE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';                  // 투명 배경 png는 흰 배경으로
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.85));
}

// DB 한 줄 → 노드
function rowToNode(row) {
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    title: row.title || '',
    artist: row.artist || '',
    note: row.note || '',
    imagePath: row.image_path,
    src: db.storage.from(BUCKET).getPublicUrl(row.image_path).data.publicUrl,
  };
}

// 노드 한 칸 수정해서 DB에 반영
function updateNode(node, fields) {
  run(db?.from('nodes').update(fields).eq('id', node.id));
}

function createNodeEl(node) {
  const el = document.createElement('div');
  el.className = 'node';
  el.dataset.id = node.id;
  el.style.width = NODE_WIDTH + 'px';
  el.style.left = node.x + 'px';
  el.style.top = node.y + 'px';
  el.innerHTML = `
    <div class="node-head">
      <span class="node-num"></span>
      <button class="node-del" type="button" aria-label="삭제">×</button>
    </div>
    <img alt="">
    <div class="node-info">
      <input class="node-field" data-key="title" type="text" placeholder="작품 제목">
      <input class="node-field" data-key="artist" type="text" placeholder="작가">
      <textarea class="node-field" data-key="note" rows="3" placeholder="해석"></textarea>
    </div>
    <span class="node-port" title="끌어서 다른 사진과 연결"></span>
  `;
  const img = el.querySelector('img');
  img.src = node.src;
  img.addEventListener('load', drawLines);   // 사진 높이가 정해지면 선 위치 다시

  // 제목·작가·해석 칸: 쓰는 대로 노드에 기록, 칸에서 나가면 저장
  el.querySelectorAll('.node-field').forEach((field) => {
    const key = field.dataset.key;
    field.value = node[key] || '';
    field.addEventListener('input', () => { node[key] = field.value; });
    field.addEventListener('change', () => updateNode(node, { [key]: field.value }));
  });

  // 노드 끌어서 옮기기 (입력 칸에서는 끌기 대신 글쓰기)
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.node-del, .node-port, .node-field')) return;
    el.style.zIndex = ++topZ;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX - node.x;
    const startY = e.clientY - node.y;
    const move = (ev) => {
      node.x = ev.clientX - startX;
      node.y = ev.clientY - startY;
      el.style.left = node.x + 'px';
      el.style.top = node.y + 'px';
      drawLines();
    };
    const up = () => {
      el.classList.remove('dragging');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      renumber();   // 시작 노드가 여러 개면 위치(왼쪽 먼저)로 순서가 바뀔 수 있음
      updateNode(node, { x: node.x, y: node.y });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });

  // × : 노드와 그 노드에 연결된 선 지우기
  el.querySelector('.node-del').addEventListener('click', () => {
    const hall = currentHall();
    hall.nodes = hall.nodes.filter((n) => n !== node);
    hall.edges = hall.edges.filter((ed) => ed.from !== node.id && ed.to !== node.id);
    el.remove();
    renumber();
    drawLines();
    // DB에서 지우면 연결선도 같이 지워짐 (on delete cascade)
    run(db?.from('nodes').delete().eq('id', node.id));
    run(db?.storage.from(BUCKET).remove([node.imagePath]));
  });

  // 오른쪽 동그라미를 끌어서 다른 노드에 놓으면 연결
  const port = el.querySelector('.node-port');
  port.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    port.setPointerCapture(e.pointerId);
    const move = (ev) => {
      tempLine = { from: node.id, to: toLocal(ev) };
      drawLines();
    };
    const up = async (ev) => {
      tempLine = null;
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.node');
      const to = target && Number(target.dataset.id);
      const hall = currentHall();
      port.removeEventListener('pointermove', move);
      port.removeEventListener('pointerup', up);
      drawLines();
      if (to && to !== node.id &&
          !hall.edges.some((ed) => ed.from === node.id && ed.to === to)) {
        const { data: row, error } = await run(db?.from('edges')
          .insert({ hall_id: hall.id, from_node: node.id, to_node: to })
          .select().single());
        if (error) return;
        hall.edges.push({ id: row.id, from: node.id, to });
        renumber();
        drawLines();
      }
    };
    port.addEventListener('pointermove', move);
    port.addEventListener('pointerup', up);
  });

  canvas.appendChild(el);
}

// 전시 순서: 연결선을 따라감
// 1) 들어오는 선이 없는 시작 노드부터 (여러 개면 왼쪽에 있는 것 먼저)
// 2) 선을 따라 다음 노드로 (갈래가 여러 개면 먼저 연결한 선부터)
// 3) 어디에도 연결 안 된 사진은 맨 뒤에 올린 순서대로
function exhibitOrder(hall) {
  const nodes = hall.nodes || [];
  const edges = hall.edges || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const connected = new Set(edges.flatMap((ed) => [ed.from, ed.to]));
  const hasIncoming = new Set(edges.map((ed) => ed.to));
  const order = [];
  const visited = new Set();

  const visit = (node) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    order.push(node);
    edges.filter((ed) => ed.from === node.id).forEach((ed) => visit(byId.get(ed.to)));
  };

  const linked = nodes.filter((n) => connected.has(n.id));
  linked.filter((n) => !hasIncoming.has(n.id))
    .sort((a, b) => a.x - b.x)
    .forEach(visit);
  linked.forEach(visit);                                     // 고리처럼 시작점이 없는 경우
  nodes.filter((n) => !connected.has(n.id)).forEach(visit);  // 연결 안 된 사진
  return order;
}

// 노드 번호 (01), (02)… = 전시 화면 작품 순서
function renumber() {
  const hall = currentHall();
  exhibitOrder(hall).forEach((node, i) => {
    const el = canvas.querySelector(`.node[data-id="${node.id}"]`);
    el.querySelector('.node-num').textContent = `(${String(i + 1).padStart(2, '0')})`;
  });
  hint.hidden = hall.nodes.length > 0;
}

// 연결선 그리기: A 오른쪽 → B 왼쪽 곡선
function drawLines() {
  const hall = currentHall();
  const box = (id) => {
    const el = canvas.querySelector(`.node[data-id="${id}"]`);
    const n = hall.nodes.find((nd) => nd.id === id);
    return { x: n.x, y: n.y, w: el.offsetWidth, h: el.offsetHeight };
  };
  const curve = (x1, y1, x2, y2) => {
    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  let svg = hall.edges.map((ed, i) => {
    const a = box(ed.from);
    const b = box(ed.to);
    return `<path class="edge" data-i="${i}" d="${curve(a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2)}"><title>클릭하면 연결 삭제</title></path>`;
  }).join('');

  if (tempLine) {
    const a = box(tempLine.from);
    svg += `<path class="edge-temp" d="${curve(a.x + a.w, a.y + a.h / 2, tempLine.to.x, tempLine.to.y)}"/>`;
  }
  lines.innerHTML = svg;
}

// 선 클릭하면 연결 삭제
lines.addEventListener('click', (e) => {
  const path = e.target.closest('.edge');
  if (!path) return;
  e.stopPropagation();
  const [edge] = currentHall().edges.splice(Number(path.dataset.i), 1);
  drawLines();
  renumber();
  run(db?.from('edges').delete().eq('id', edge.id));
});

// ───────── 불러오기: 모든 사람이 만든 전시관 (Supabase) ─────────

async function load() {
  if (!db) return;
  const [h, n, e] = await Promise.all([
    run(db.from('halls').select().order('id')),
    run(db.from('nodes').select().order('id')),
    run(db.from('edges').select().order('id')),
  ]);
  if (h.error || n.error || e.error) return;

  h.data.forEach((row) => {
    addWindow({
      id: row.id,
      name: row.name,
      maker: row.maker,
      theme: row.theme || '',
      desc: row.description || '',
      nodes: n.data.filter((r) => r.hall_id === row.id).map(rowToNode),
      edges: e.data.filter((r) => r.hall_id === row.id)
        .map((r) => ({ id: r.id, from: r.from_node, to: r.to_node })),
    });
  });
}

// 불러오기가 끝난 뒤에야 "전시관 없음" 글귀를 보여줌 (불러오는 동안 잠깐 깜빡이지 않게)
Promise.all([load(), loadComments()])
  .then(reorderWindows)
  .finally(() => document.body.classList.add('loaded'));

// ───────── 그림판: 붓 / 지우개 / 물감 채우기 / 색 고르기 / 도형 ─────────

const paint = document.querySelector('.paint');
const paintCanvas = document.querySelector('.paint-canvas');
const previewCanvas = document.querySelector('.paint-preview');   // 도형 끌 때 미리보기용
const pctx = paintCanvas.getContext('2d', { willReadFrequently: true });
const prev = previewCanvas.getContext('2d');
const paintStatus = document.querySelector('.paint-status');
const customColor = document.querySelector('.paint-custom');
const PW = paintCanvas.width;
const PH = paintCanvas.height;

const TOOL_NAMES = {
  brush: '붓', eraser: '지우개', fill: '물감 채우기', picker: '색 고르기 (그림을 누르면 그 색을 가져와요)',
  line: '직선', rect: '사각형', ellipse: '원',
};
// 그림판 기본 색 28개
const PALETTE = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080',
  '#800080', '#808040', '#004040', '#0080ff', '#004080', '#8000ff', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff',
  '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff0080', '#ff8040',
];

let tool = 'brush';
let lastTool = 'brush';    // 색 고르기 뒤에 돌아갈 도구
let color = '#000000';
let size = 5;

// 흰 도화지로 시작
pctx.fillStyle = '#fff';
pctx.fillRect(0, 0, PW, PH);

// 색 팔레트 만들기
const paletteBox = document.querySelector('.paint-palette');
PALETTE.forEach((c) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.background = c;
  b.title = c;
  b.addEventListener('click', () => setColor(c));
  paletteBox.appendChild(b);
});
customColor.addEventListener('input', () => setColor(customColor.value));

function setColor(c) {
  color = c;
  customColor.value = c;
}

function setTool(t) {
  if (t !== 'picker') lastTool = t;
  tool = t;
  document.querySelectorAll('.paint-tools [data-tool]').forEach((b) => b.classList.toggle('is-on', b.dataset.tool === t));
  paintStatus.textContent = TOOL_NAMES[t];
}

document.querySelectorAll('.paint-tools [data-tool]').forEach((b) => {
  b.addEventListener('click', () => setTool(b.dataset.tool));
});
document.querySelectorAll('.paint-sizes [data-size]').forEach((b) => {
  b.addEventListener('click', () => {
    size = Number(b.dataset.size);
    document.querySelectorAll('.paint-sizes button').forEach((x) => x.classList.toggle('is-on', x === b));
  });
});

// ───── 전시관에 올리기: 그린 그림을 골라둔 전시관의 작품(노드)으로 저장 ─────
const uploadForm = document.querySelector('.paint-upload');
const uploadBtn = document.querySelector('.paint-upload-btn');
const hallSelect = document.querySelector('.paint-hall');

uploadBtn.addEventListener('click', () => {
  if (!halls.length) {
    alert('먼저 + 버튼으로 전시관을 만들어 주세요.');
    return;
  }
  hallSelect.innerHTML = '';
  halls.forEach((hall, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${i + 1} 전시관 · ${hall.name}`;
    hallSelect.appendChild(opt);
  });
  uploadForm.hidden = false;
  uploadBtn.hidden = true;
  uploadForm.querySelector('.paint-art-title').focus();
});

function closeUpload() {
  uploadForm.hidden = true;
  uploadBtn.hidden = false;
}
document.querySelector('.paint-upload-cancel').addEventListener('click', closeUpload);

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const num = Number(hallSelect.value) + 1;
  const hall = halls[num - 1];
  const goBtn = uploadForm.querySelector('.paint-upload-go');
  goBtn.disabled = true;
  paintStatus.textContent = '올리는 중…';

  const blob = await new Promise((resolve) => paintCanvas.toBlob(resolve, 'image/jpeg', 0.9));
  const path = `${hall.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  // 설계하기 방에서는 기존 노드들 오른쪽에 놓이게
  const nodes = hall.nodes || [];
  const x = nodes.length ? Math.max(...nodes.map((n) => n.x)) + NODE_WIDTH + 40 : 120;
  const y = nodes.length ? Math.min(...nodes.map((n) => n.y)) : 120;

  const up = await run(db?.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' }));
  const res = up.error ? up : await run(db.from('nodes').insert({
    hall_id: hall.id,
    x,
    y,
    image_path: path,
    title: uploadForm.querySelector('.paint-art-title').value.trim(),
    artist: uploadForm.querySelector('.paint-art-artist').value.trim(),
  }).select().single());
  goBtn.disabled = false;

  if (res.error) {
    paintStatus.textContent = '올리지 못했어요. 다시 해 주세요.';
    return;
  }
  hall.nodes = nodes;
  nodes.push(rowToNode(res.data));
  renderWindowArts(num);
  uploadForm.reset();
  closeUpload();
  paintStatus.textContent = `${num} 전시관에 올렸어요!`;
});

// 닫기: × 또는 Esc. 닫으면 그림판을 처음 상태로 (흰 도화지, 붓, 검정, 보통 굵기)
function closePaint() {
  paint.hidden = true;
  pctx.fillStyle = '#fff';
  pctx.fillRect(0, 0, PW, PH);
  prev.clearRect(0, 0, PW, PH);
  setTool('brush');
  setColor('#000000');
  document.querySelector('.paint-sizes [data-size="5"]').click();
  uploadForm.reset();
  closeUpload();
}
document.querySelector('.paint-close').addEventListener('click', closePaint);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !paint.hidden) closePaint();
});

// 화면 좌표 → 도화지 좌표 (도화지가 화면에서 줄어 보여도 정확하게)
function canvasPoint(e) {
  const r = previewCanvas.getBoundingClientRect();
  return {
    x: Math.round((e.clientX - r.left) * PW / r.width),
    y: Math.round((e.clientY - r.top) * PH / r.height),
  };
}

function drawShape(ctx, kind, a, b) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'line') {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  } else if (kind === 'rect') {
    ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else {
    ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
}

let start = null;   // 누른 지점
let last = null;    // 붓·지우개 직전 지점

previewCanvas.addEventListener('pointerdown', (e) => {
  previewCanvas.setPointerCapture(e.pointerId);
  const p = canvasPoint(e);

  if (tool === 'picker') {                       // 색 고르기: 누른 곳 색 가져오고 원래 도구로
    const [r, g, b] = pctx.getImageData(p.x, p.y, 1, 1).data;
    setColor('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''));
    setTool(lastTool);
    return;
  }
  if (tool === 'fill') {
    floodFill(p.x, p.y, color);
    return;
  }
  start = last = p;
  if (tool === 'brush' || tool === 'eraser') strokeTo(p);   // 콕 찍어도 점이 찍히게
});

previewCanvas.addEventListener('pointermove', (e) => {
  if (!start) return;
  const p = canvasPoint(e);
  if (tool === 'brush' || tool === 'eraser') {
    strokeTo(p);
  } else {
    prev.clearRect(0, 0, PW, PH);
    drawShape(prev, tool, start, p);
  }
});

previewCanvas.addEventListener('pointerup', (e) => {
  if (!start) return;
  if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
    prev.clearRect(0, 0, PW, PH);
    drawShape(pctx, tool, start, canvasPoint(e));
  }
  start = last = null;
});

// 붓·지우개: 직전 지점에서 지금 지점까지 선 (지우개 = 흰색으로 굵게)
function strokeTo(p) {
  const eraser = tool === 'eraser';
  pctx.strokeStyle = eraser ? '#fff' : color;
  pctx.lineWidth = eraser ? size * 3 : size;
  pctx.lineCap = eraser ? 'square' : 'round';
  pctx.lineJoin = 'round';
  pctx.beginPath();
  pctx.moveTo(last.x, last.y);
  pctx.lineTo(p.x, p.y);
  pctx.stroke();
  last = p;
}

// 물감 채우기: 누른 곳과 비슷한 색으로 이어진 영역을 한 번에 칠하기
function floodFill(x, y, hex) {
  const img = pctx.getImageData(0, 0, PW, PH);
  const d = img.data;
  const nr = parseInt(hex.slice(1, 3), 16);
  const ng = parseInt(hex.slice(3, 5), 16);
  const nb = parseInt(hex.slice(5, 7), 16);
  const i0 = (y * PW + x) * 4;
  const [tr, tg, tb] = [d[i0], d[i0 + 1], d[i0 + 2]];
  if (tr === nr && tg === ng && tb === nb) return;

  // 선 가장자리의 흐릿한 픽셀까지 어느 정도 같은 색으로 봄 (빈틈 없이 칠해지게)
  const same = (p) => {
    const i = p * 4;
    return Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= 120;
  };
  const seen = new Uint8Array(PW * PH);
  const stack = [y * PW + x];
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !same(p)) continue;
    // 가로로 왼쪽·오른쪽 끝까지 한 줄 칠하고, 위아래 줄은 나중에
    const row = Math.floor(p / PW);
    let l = p;
    let r = p;
    while (l % PW > 0 && !seen[l - 1] && same(l - 1)) l--;
    while (r % PW < PW - 1 && !seen[r + 1] && same(r + 1)) r++;
    for (let q = l; q <= r; q++) {
      seen[q] = 1;
      const i = q * 4;
      d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
      if (row > 0 && !seen[q - PW]) stack.push(q - PW);
      if (row < PH - 1 && !seen[q + PW]) stack.push(q + PW);
    }
  }
  pctx.putImageData(img, 0, 0);
}
