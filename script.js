"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const WORDS = {
    needs: ["ฉัน", "ต้องการ", "น้ำ", "อาหาร", "เข้าห้องน้ำ", "พักผ่อน", "เปิดไฟ", "ปิดไฟ", "ร้อน", "หนาว", "ช่วยจัดท่า", "ไม่เอา"],
    health: ["เจ็บ", "ปวดหัว", "ปวดท้อง", "หายใจไม่ออก", "เวียนหัว", "คลื่นไส้", "ชา", "คัน", "ไอ", "มีไข้", "ยา", "หมอ"],
    emergency: ["ช่วยด้วย", "ฉุกเฉิน", "เรียกพยาบาล", "หายใจไม่ออก", "เจ็บหน้าอก", "สำลัก", "ตกเตียง", "เลือดออก"],
    feelings: ["มีความสุข", "สบายดี", "เหนื่อย", "กังวล", "กลัว", "เศร้า", "เหงา", "โกรธ", "ไม่สบายใจ", "ขอบคุณ"],
    family: ["พ่อ", "แม่", "ลูก", "หลาน", "ญาติ", "อยากพบ", "โทรหา", "คิดถึง", "มาเยี่ยม", "กลับบ้าน"],
    short: ["ใช่", "ไม่ใช่", "ได้", "ไม่ได้", "เอา", "ไม่เอา", "ดี", "ไม่ดี", "ขอบคุณ", "กรุณา", "อีกครั้ง", "พอแล้ว"]
  };

  const state = {
    user: null,
    words: [],
    history: [],
    activeCategory: "needs",
    gazeIndex: 0,
    screen: 'category', // category | words
    lastDirection: "CENTER",
    lastBlinkCount: 0,
    gazeStartedAt: 0,
    eyeTimer: null,
    cameraStream: null
  };
  let customCategories = {};

  const pages = $$(".page");
  const toast = $("#toast");
  let toastTimer;

  function showPage(name) {
    pages.forEach(page => page.classList.toggle("active", page.id === `page-${name}`));
    if (name !== "dashboard") stopDashboard();
  }

  function notify(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  async function postJSON(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  $("#go-register").addEventListener("click", () => showPage("register"));
  $("#go-login").addEventListener("click", () => showPage("login"));

  $("#register-form").addEventListener("submit", async event => {
    event.preventDefault();
    const error = $("#register-error");
    error.textContent = "";
    const user = {
      name: $("#reg-name").value.trim(),
      age: Number($("#reg-age").value),
      gender: $("#reg-gender").value,
      condition: $("#reg-condition").value.trim(),
      caretakerPhone: $("#reg-caretaker-phone").value.trim(),
      email: $("#reg-email").value.trim().toLowerCase(),
      password: $("#reg-password").value
    };
    if (!event.currentTarget.checkValidity()) {
      error.textContent = "กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง";
      event.currentTarget.reportValidity();
      return;
    }
    if (user.password.length < 6) {
      error.textContent = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
      return;
    }
    try {
      const result = await postJSON("/register", user);
      if (!result.success) throw new Error(result.message || "สมัครสมาชิกไม่สำเร็จ");
      event.currentTarget.reset();
      $("#login-email").value = user.email;
      showPage("login");
      notify("สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ");
    } catch (err) {
      error.textContent = err.message === "Failed to fetch" ? "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" : err.message;
    }
  });

  $("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const error = $("#login-error");
    error.textContent = "";
    const credentials = {
      email: $("#login-email").value.trim().toLowerCase(),
      password: $("#login-password").value
    };
    if (!event.currentTarget.checkValidity()) {
      error.textContent = "กรุณากรอกอีเมลและรหัสผ่าน";
      return;
    }
    try {
      const result = await postJSON("/login", credentials);
      if (!result.success) throw new Error(result.message || "เข้าสู่ระบบไม่สำเร็จ");
      state.user = result.user;

      sessionStorage.setItem(
      "eyetalkUser",
      JSON.stringify(result.user)
   );
      loadCustomCategoriesForUser();
      sessionStorage.setItem("eyetalkUser", JSON.stringify(result.user));
     document.querySelector("#page-login")?.classList.remove("active");
     document.querySelector("#page-register")?.classList.remove("active");
     document.querySelector("#page-calibration")?.classList.remove("active");

    openDashboard();
    } catch (err) {
      error.textContent = err.message === "Failed to fetch" ? "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" : err.message;
    }
  });

  function openDashboard() {
    showPage("dashboard");
    state.gazeIndex = 0;
    $("#topbar-username").textContent = state.user?.name || "ผู้ใช้งาน";
    state.words = [];
    renderMessage();
    loadHistory();
    // กล้องถูกเปิดโดย eyePos.py อยู่แล้ว
// จึงไม่เปิดซ้ำจาก Browser
$("#camera-fallback").textContent = "กล้องกำลังทำงานผ่านระบบ Eye Tracking";
$("#status-camera").classList.add("online");

if (window.startBrowserCamera) {
  window.startBrowserCamera();
}

    $("#status-ai").classList.add("online");
    
    loadCustomCategoriesForUser();
    renderPredictions();
    showCategoryScreen();
  }

  $("#logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("eyetalkUser");
    state.user = null;
    customCategories = {};
    document.querySelectorAll(".custom-category-btn").forEach(btn => btn.remove());
    showPage("login");
    notify("ออกจากระบบแล้ว");
  });

  // ===== CATEGORY / WORD SCREEN =====
  function showCategoryScreen() {
    state.screen = 'category';
    state.gazeIndex = 0;

    $("#category-screen").style.display = 'flex';
    $("#word-screen").style.display = 'none';
    $("#vocabulary-screen").style.display = 'none';

    paintGazeCursor();
}
  function showVocabularyScreen() {
    state.screen = 'vocabulary';

    $("#category-screen").style.display = 'none';
    $("#word-screen").style.display = 'none';
    $("#vocabulary-screen").style.display = 'block';
}

  function showWordScreen(category) {
    state.screen = 'words';
    state.gazeIndex = 0;
    state.activeCategory = category;
    state.gazeIndex = 0;

    $('#category-screen').style.display = 'none';
    $('#word-screen').style.display = 'flex';

    renderWords();
    paintGazeCursor();
  }

  function renderWords() {
    const grid = $("#word-grid");
    grid.replaceChildren();
    WORDS[state.activeCategory].forEach((word, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `word-btn${state.activeCategory === "emergency" ? " emergency-word" : ""}`;
      button.textContent = word;
      button.dataset.index = index;
      button.addEventListener("click", () => addWord(word));
      grid.appendChild(button);
    });
    state.gazeIndex = Math.min(state.gazeIndex, WORDS[state.activeCategory].length - 1);
    paintGazeCursor();
  }
  
function getPredictions() {
  if (!state.words.length) {
    return ["ฉัน", "ช่วย", "ขอ", "รู้สึก", "อยาก"];
  }

  const lastWord = state.words[state.words.length - 1];

  const predictionMap = {
    "ฉัน": [
      "ต้องการ",
      "รู้สึก",
      "อยาก",
      "ปวด",
      "ไม่"
    ],

    "ต้องการ": [
      "น้ำ",
      "อาหาร",
      "พักผ่อน",
      "ยา",
      "ความช่วยเหลือ"
    ],

    "ขอ": [
      "น้ำ",
      "อาหาร",
      "ยา",
      "ความช่วยเหลือ",
      "พักผ่อน"
    ],

    "อยาก": [
      "พักผ่อน",
      "กลับบ้าน",
      "พบ",
      "โทรหา",
      "ดื่มน้ำ"
    ],

    "รู้สึก": [
      "เหนื่อย",
      "กังวล",
      "กลัว",
      "หนาว",
      "ร้อน"
    ],

    "ปวด": [
      "หัว",
      "ท้อง",
      "หลัง",
      "หน้าอก"
    ],

    "เจ็บ": [
      "หัว",
      "ท้อง",
      "หน้าอก",
      "หลัง"
    ],

    "ช่วย": [
      "เรียกพยาบาล",
      "จัดท่า",
      "เปิดไฟ",
      "ปิดไฟ",
      "หยิบน้ำ"
    ],

    "ช่วยด้วย": [
      "เรียกพยาบาล",
      "ฉุกเฉิน",
      "หายใจไม่ออก",
      "เจ็บหน้าอก"
    ],

    "ไม่": [
      "เอา",
      "ต้องการ",
      "ไหว",
      "สบาย",
      "ดี"
    ],

    "โทรหา": [
      "พ่อ",
      "แม่",
      "ลูก",
      "ญาติ"
    ],

    "พบ": [
      "พ่อ",
      "แม่",
      "ลูก",
      "ญาติ",
      "หมอ"
    ],

    "น้ำ": [
      "เย็น",
      "เพิ่ม",
      "พอแล้ว"
    ],

    "อาหาร": [
      "เพิ่ม",
      "ไม่เอา",
      "พอแล้ว"
    ],

    "ยา": [
      "เพิ่ม",
      "ไม่เอา",
      "เรียกพยาบาล"
    ]
  };

  return predictionMap[lastWord] || [
    "ฉัน",
    "ต้องการ",
    "ช่วย",
    "ไม่",
    "ขอบคุณ"
  ];
}

function renderPredictions() {
  const list = $("#prediction-list");
  if (!list) return;

  list.replaceChildren();

  const predictions = getPredictions()
    .filter(word => word !== state.words[state.words.length - 1])
    .slice(0, 5);

  predictions.forEach(word => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "prediction-btn";
    button.textContent = word;

    button.addEventListener("click", () => {
      addWord(word);
    });

    list.appendChild(button);
  });
    const buttons = getGazeButtons();
    state.gazeIndex = Math.min(state.gazeIndex, Math.max(0, buttons.length - 1));
      paintGazeCursor();
  }

  function addWord(word) {
    state.words.push(word);
    renderMessage();
    renderPredictions();
  }

  function renderMessage() {
    const output = $("#message-output");
    if (!state.words.length) {
      output.innerHTML = '<span class="message-placeholder">เลือกคำจากหมวดด้านล่างเพื่อเริ่มสร้างประโยค...</span>';
      return;
    }
    output.textContent = state.words.join(" ");
  }

  // ===== ปุ่มเลือกหมวดด้วยสายตา / เมาส์ (ผูกครั้งเดียวตอนโหลดหน้า) =====
  $$('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => showWordScreen(btn.dataset.cat));
  });

  // ปุ่มกลับเลือกหมวด
  $('#btn-back-category').addEventListener('click', () => showCategoryScreen());


  $("#btn-undo").addEventListener("click", () => {
    state.words.pop();
    renderMessage();
    renderPredictions();
  });
  $("#btn-clear").addEventListener("click", () => {
    state.words = [];
    renderMessage();
     renderPredictions();
  });
  $("#btn-ai-arrange").addEventListener("click", () => {
    if (!state.words.length) return notify("กรุณาเลือกคำก่อน");
    const unique = [...new Set(state.words)];
    const starters = ["ฉัน", "ผม", "หนู"];
    const starter = unique.find(word => starters.includes(word));
    state.words = starter ? [starter, ...unique.filter(word => word !== starter)] : unique;
    renderMessage();
    notify("จัดเรียงและตัดคำซ้ำแล้ว");
  });

  $("#btn-speak").addEventListener("click", speakMessage);
  function speakMessage() {
    const text = state.words.join(" ").trim();
    if (!text) return notify("ยังไม่มีข้อความให้อ่าน");
    if (!("speechSynthesis" in window)) return notify("เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง");
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
    addHistory(text);
  }

  function historyKey() {
    return `eyetalkHistory:${state.user?.email || "guest"}`;
  }
  function loadHistory() {
    try { state.history = JSON.parse(localStorage.getItem(historyKey())) || []; }
    catch { state.history = []; }
    renderHistory();
  }
  function addHistory(text) {
    state.history.unshift({ text, time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) });
    state.history = state.history.slice(0, 10);
    localStorage.setItem(historyKey(), JSON.stringify(state.history));
    renderHistory();
  }
  function renderHistory() {
    const list = $("#history-list");
    list.replaceChildren();
    if (!state.history.length) {
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "ยังไม่มีประวัติข้อความ";
      list.appendChild(empty);
      return;
    }
    state.history.forEach(entry => {
      const item = document.createElement("li");
      item.className = "history-item";
      const time = document.createElement("span");
      time.className = "history-time";
      time.textContent = entry.time;
      const text = document.createElement("span");
      text.className = "history-text";
      text.textContent = entry.text;
      item.append(time, text);
      list.appendChild(item);
    });
  }

  async function startCamera() {
    const fallback = $("#camera-fallback");
    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      $("#webcam").srcObject = state.cameraStream;
      fallback.classList.add("hidden");
      $("#status-camera").classList.add("online");
    } catch {
      fallback.classList.remove("hidden");
      $("#status-camera").classList.remove("online");
    }
  }

  function stopDashboard() {
    clearInterval(state.eyeTimer);
    state.eyeTimer = null;
    state.cameraStream?.getTracks().forEach(track => track.stop());
    state.cameraStream = null;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  function startEyeTracking() {
    clearInterval(state.eyeTimer);
    pollEye();
    state.eyeTimer = setInterval(pollEye, 350);
  }

  async function pollEye() {
    try {
      const response = await fetch("/eye", { cache: "no-store" });
      if (!response.ok) throw new Error("Eye service offline");
      const data = await response.json();
      const direction = String(data.direction || "CENTER").toUpperCase();
      const blinks = Number(data.blinks ?? data.blink ?? 0);
      updateEyeUI(direction, blinks, true);
      handleGaze(direction, blinks);
    } catch {
      updateEyeUI("CENTER", state.lastBlinkCount, false);
    }
  }

  function updateEyeUI(direction, blinks, detected) {
    $("#eye-direction").textContent = direction;
    $("#blink-count").textContent = String(blinks);
    $("#eye-detected").textContent = detected ? "YES" : "NO";
    $("#eye-detected").classList.toggle("eye-detected-yes", detected);
    $("#status-eye").classList.toggle("online", detected);
    const rotation = { LEFT: -90, CENTER: 0, RIGHT: 90, UP: 0, DOWN: 180 }[direction] ?? 0;
    $("#compass-arrow").style.transform = `rotate(${rotation}deg)`;
  }

  function getGazeButtons() {

  const actionButtons = [
    $('#btn-speak'),
    $('#btn-undo'),
    $('#btn-clear'),
    $('#btn-ai-arrange')
  ].filter(Boolean);

  if (state.screen === 'category') {
  return [
    ...$$('.category-btn'),
    ...$$('.prediction-btn'),
    ...actionButtons
  ].filter(Boolean);
}

  return [
  ...actionButtons,

  ...$$('.prediction-btn'),

  ...$$('.word-btn'),

  $('#btn-finish'),
  $('#btn-back-category')
].filter(Boolean);
}
  function handleGaze(direction, blinks) {
  const buttons = getGazeButtons();
  if (!buttons.length) return;

  // ถ้าตรวจพบการกระพริบเลือก
  // ให้เลือกข้อความที่กำลังโฟกัสอยู่ทันที
  // โดยไม่ขยับไปข้อความอื่น
  if (blinks > state.lastBlinkCount) {
    buttons[state.gazeIndex]?.click();

    state.lastBlinkCount = blinks;
    state.lastDirection = direction;
    return;
  }

  // ถ้าไม่ได้กระพริบ จึงอนุญาตให้สายตาเลื่อนตำแหน่ง
  if (direction !== "CENTER" && direction !== state.lastDirection) {
    state.gazeIndex =
      (state.gazeIndex +
        (direction === "LEFT" ? -1 : 1) +
        buttons.length) %
      buttons.length;

    state.gazeStartedAt = Date.now();
    paintGazeCursor();
  }

  state.lastDirection = direction;
  state.lastBlinkCount = blinks;

  const progress = state.gazeStartedAt
    ? Math.min(100, (Date.now() - state.gazeStartedAt) / 10)
    : 0;

  $("#gaze-progress-fill").style.width = `${progress}%`;
  $("#gaze-progress-value").textContent = `${Math.round(progress)}%`;
}
window.handleGaze = handleGaze;

  function paintGazeCursor() {
    const buttons = getGazeButtons();
    buttons.forEach((button, index) => {
      button.classList.toggle('gaze-focus', index === state.gazeIndex);
    });
  }

  const sosModal = $("#sos-modal");
  $("#sos-btn").addEventListener("click", () => {
    sosModal.classList.add("active");
    sosModal.setAttribute("aria-hidden", "false");
  });
  $("#sos-confirm-no").addEventListener("click", closeSosModal);
  sosModal.addEventListener("click", event => { if (event.target === sosModal) closeSosModal(); });

  function clickFocusedGazeButton() {
  const buttons = getGazeButtons();

  const button = buttons[state.gazeIndex];

  if (button) {
    button.click();
  }
}

window.clickFocusedGazeButton = clickFocusedGazeButton;

  function closeSosModal() {
    sosModal.classList.remove("active");
    sosModal.setAttribute("aria-hidden", "true");
  }
  $("#sos-confirm-yes").addEventListener("click", () => {
    closeSosModal();
    const success = $("#sos-success");
    success.classList.add("active");
    success.setAttribute("aria-hidden", "false");
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(() => {
      success.classList.remove("active");
      success.setAttribute("aria-hidden", "true");
    }, 2200);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSosModal();
    if (!$("#page-dashboard").classList.contains("active")) return;
    const buttons = getGazeButtons();
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && buttons.length) {
      event.preventDefault();
      state.gazeIndex = (state.gazeIndex + (event.key === "ArrowLeft" ? -1 : 1) + buttons.length) % buttons.length;
      paintGazeCursor();
    }
    if ((event.key === "Enter" || event.key === " ") && document.activeElement === document.body) {
      event.preventDefault();
      buttons[state.gazeIndex]?.click();
    }
  });

  $("#btn-finish").addEventListener("click", () => {
    if (!state.words.length) {
      notify("กรุณาเลือกคำก่อน");
      return;
    }
    $("#btn-ai-arrange").click();
    setTimeout(() => {
      $("#btn-speak").click();
    }, 300);
  });

  try { state.user = JSON.parse(sessionStorage.getItem("eyetalkUser")); } catch { state.user = null; }
  if (state.user) {
  if (state.user) {
  document.querySelector("#page-login")?.classList.remove("active");
  document.querySelector("#page-register")?.classList.remove("active");
  document.querySelector("#page-calibration")?.classList.remove("active");

  openDashboard();
}
}
  async function startCalibrationStep(target) {
  await fetch("/calibration/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ target })
  });
}

async function stopCalibrationStep() {
  await fetch("/calibration/stop", {
    method: "POST"
  });
}

async function finishCalibration() {
  const response = await fetch("/calibration/finish", {
    method: "POST"
  });

  return await response.json();
}

function setCalibrationPoint(target) {
  ["LEFT", "CENTER", "RIGHT"].forEach(name => {
    const el = document.querySelector(
      `#calibration-${name.toLowerCase()}`
    );

    if (el) {
      el.classList.toggle("active", name === target);
    }
  });
}
async function runCalibration() {
  const status = document.querySelector("#calibration-status");
  const button = document.querySelector("#btn-start-calibration");

  button.disabled = true;

  const steps = [
    { target: "LEFT", text: "กรุณามองจุดด้านซ้าย" },
    { target: "CENTER", text: "กรุณามองจุดตรงกลาง" },
    { target: "RIGHT", text: "กรุณามองจุดด้านขวา" }
  ];

 for (const step of steps) {
  status.textContent = step.text;
  setCalibrationPoint(step.target);

  if (window.startBrowserCalibrationStep) {
    window.startBrowserCalibrationStep(step.target);
  }

  await new Promise(resolve => setTimeout(resolve, 3500));

  if (window.stopBrowserCalibrationStep) {
    window.stopBrowserCalibrationStep();
  }

  await new Promise(resolve => setTimeout(resolve, 800));
}

const result = window.finishBrowserCalibration
  ? window.finishBrowserCalibration()
  : { success: false };
  if (result.success) {
    status.textContent = "ปรับเทียบสายตาสำเร็จ";
    setCalibrationPoint(null);

    setTimeout(() => {
  document.querySelector("#page-calibration").classList.remove("active");
  openDashboard();
}, 1000);

  } else {
    status.textContent = "ปรับเทียบไม่สำเร็จ กรุณาลองใหม่";
    button.disabled = false;
  }
}
const calibrationButton =
  document.querySelector("#btn-start-calibration");

if (calibrationButton) {
  calibrationButton.addEventListener("click", openDashboard);
}
$("#btn-manage-vocabulary")?.addEventListener("click", () => {
    showVocabularyScreen();
});

$("#btn-back-vocabulary")?.addEventListener("click", () => {
    showCategoryScreen();
});
let customWords = [];

function renderCustomWords() {
    const list = $("#custom-word-list");
    list.innerHTML = "";

    customWords.forEach((word, index) => {
        const chip = document.createElement("div");
        chip.className = "custom-word-chip";

        const text = document.createElement("span");
        text.textContent = word;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "custom-word-remove";
        removeBtn.textContent = "×";

        removeBtn.addEventListener("click", () => {
            customWords.splice(index, 1);
            renderCustomWords();
        });

        chip.appendChild(text);
        chip.appendChild(removeBtn);
        list.appendChild(chip);
    });
}
$("#btn-add-custom-word")?.addEventListener("click", () => {
    const input = $("#custom-word-input");
    const word = input.value.trim();

    if (!word) return;

    if (customWords.includes(word)) {
        notify("มีคำนี้อยู่แล้ว");
        return;
    }

    customWords.push(word);
    input.value = "";

    renderCustomWords();
});
$("#custom-word-input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        $("#btn-add-custom-word")?.click();
    }
});
function getCustomCategoryKey() {
  console.log("CURRENT USER =", state.user);

  const userKey =
    state.user?.email ||
    state.user?.username ||
    state.user?.name ||
    "guest";

  console.log("CUSTOM CATEGORY KEY =", `customCategories_${userKey}`);

  return `customCategories_${userKey}`;
}

function loadCustomCategoriesForUser() {
  const key = getCustomCategoryKey();

  customCategories = JSON.parse(
    localStorage.getItem(key) || "{}"
  );

  Object.entries(customCategories).forEach(([id, data]) => {
    WORDS[id] = [...data.words];
  });

  renderCustomCategories();
}

function renderCustomCategories() {
  const categoryGrid = document.querySelector(".category-grid");
  const savedList = $("#custom-category-list");

  // ลบปุ่มหมวด custom เก่าออกก่อน กันซ้ำ
  document.querySelectorAll(".custom-category-btn").forEach(btn => btn.remove());

  savedList.innerHTML = "";

  Object.entries(customCategories).forEach(([id, data]) => {
    // ปุ่มในหน้าเลือกหมวด
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-btn custom-category-btn";
    button.dataset.cat = id;
    button.textContent = data.name;

    button.addEventListener("click", () => {
      showWordScreen(id);
    });

    categoryGrid.appendChild(button);

    // รายการในหน้าจัดการคำศัพท์
    const item = document.createElement("div");
    item.className = "custom-category-item";

    const title = document.createElement("strong");
    title.textContent = data.name;

    const words = document.createElement("div");
    words.className = "custom-category-words";
    words.textContent = data.words.join(" • ");
    const actions = document.createElement("div");
actions.className = "custom-category-actions";

const editBtn = document.createElement("button");
editBtn.type = "button";
editBtn.className = "btn btn-secondary";
editBtn.textContent = "✏️ แก้ไข";

editBtn.addEventListener("click", () => {
  $("#custom-category-name").value = data.name;

  customWords = [...data.words];
  renderCustomWords();

  delete customCategories[id];
  delete WORDS[id];

  localStorage.setItem(
  getCustomCategoryKey(),
  JSON.stringify(customCategories)
);

  renderCustomCategories();
});

const deleteBtn = document.createElement("button");
deleteBtn.type = "button";
deleteBtn.className = "btn btn-secondary";
deleteBtn.textContent = "🗑️ ลบ";

deleteBtn.addEventListener("click", () => {
  const confirmed = confirm(`ลบหมวด "${data.name}" หรือไม่?`);

  if (!confirmed) return;

  delete customCategories[id];
  delete WORDS[id];

  localStorage.setItem(
    "customCategories",
    JSON.stringify(customCategories)
  );

  renderCustomCategories();
  notify("ลบหมวดหมู่แล้ว");
});

actions.appendChild(editBtn);
actions.appendChild(deleteBtn);

item.appendChild(title);
item.appendChild(words);
item.appendChild(actions);

savedList.appendChild(item);

  });
}
$("#btn-save-custom-category")?.addEventListener("click", () => {
  const nameInput = $("#custom-category-name");
  const categoryName = nameInput.value.trim();

  if (!categoryName) {
    notify("กรุณาใส่ชื่อหมวดหมู่");
    return;
  }

  if (customWords.length === 0) {
    notify("กรุณาเพิ่มคำศัพท์อย่างน้อย 1 คำ");
    return;
  }

  const id = "custom_" + Date.now();

  customCategories[id] = {
    name: categoryName,
    words: [...customWords]
  };

  localStorage.setItem(
    getCustomCategoryKey(),
    JSON.stringify(customCategories)
  );

  // ให้ระบบเดิมรู้จักคำของหมวดใหม่นี้
  WORDS[id] = [...customWords];

  nameInput.value = "";
  $("#custom-word-input").value = "";
  customWords = [];

  renderCustomWords();
  renderCustomCategories();

  notify("สร้างหมวดหมู่สำเร็จ");
});
Object.entries(customCategories).forEach(([id, data]) => {
  WORDS[id] = [...data.words];
});

renderCustomCategories();
});