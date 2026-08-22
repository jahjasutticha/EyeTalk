import {
  FaceLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm";

const video = document.querySelector("#webcam");

let faceLandmarker = null;
let lastVideoTime = -1;
let cameraStarted = false;
let lastSentDirection = "CENTER";
let candidateDirection = "CENTER";
let candidateFrames = 0;
let blinkStartTime = null;
let blinkTriggered = false;

const BLINK_SELECT_MIN = 350;
const BLINK_SELECT_MAX = 1500;
let lastSelectTime = 0;
const SELECT_COOLDOWN = 800;

const STABLE_FRAMES = 5;
let browserBlinkCount = 0;
let blinkStartedAt = null;
let blinkLocked = false;
let calibrationMode = false;
let calibrationTarget = null;
let smoothIrisRatio = null;
const SMOOTH_ALPHA = 0.35;
let calibrationSamples = {
  LEFT: [],
  CENTER: [],
  RIGHT: []
};

let gazeLeftThreshold = 0.38;
let gazeRightThreshold = 0.62;

const BLINK_THRESHOLD = 0.20;
const BLINK_MIN_TIME = 250;
const BLINK_MAX_TIME = 1200;

// ==============================
// เปิดกล้องของอุปกรณ์ผู้ใช้
// ==============================

async function startBrowserCamera() {
  if (!video) {
    console.error("ไม่พบ #webcam");
    return;
  }

  if (cameraStarted) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
  
video: {
  facingMode: "user"
},
audio: false
});
    video.srcObject = stream;

    cameraStarted = true;

    console.log("✅ Browser camera ready");

    await setupFaceLandmarker();

  } catch (error) {
    console.error("❌ Camera error:", error);
  }
}


// ==============================
// โหลด MediaPipe
// ==============================

async function setupFaceLandmarker() {
  try {

    console.log("กำลังโหลด MediaPipe...");

    const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
);

    faceLandmarker = await FaceLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        },

        runningMode: "VIDEO",

        numFaces: 1,

        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      }
    );

    console.log("✅ MediaPipe FaceLandmarker ready");

    detectFace();

  } catch (error) {

    console.error(
      "❌ MediaPipe load error:",
      error
    );

  }
}


// ==============================
// ตรวจใบหน้าทุก frame
// ==============================

function detectFace() {

  if (!faceLandmarker || !video) {
    requestAnimationFrame(detectFace);
    return;
  }

  if (
    video.readyState >= 2 &&
    video.currentTime !== lastVideoTime
  ) {

    lastVideoTime = video.currentTime;

    const now = performance.now();

    const result =
      faceLandmarker.detectForVideo(
        video,
        now
      );


    // ==========================
    // มีใบหน้า
    // ==========================

    if (
      result.faceLandmarks &&
      result.faceLandmarks.length > 0
    ) {

      const landmarks =
        result.faceLandmarks[0];

      console.log(
        "✅ FACE DETECTED",
        landmarks.length,
        "landmarks"
      );
// ==============================
// ตรวจทิศทางการมองจาก Iris
// ==============================

// ตาขวาของผู้ใช้
const eyeLeftCorner = landmarks[33];
const eyeRightCorner = landmarks[133];

// จุดกลางม่านตา
const iris = landmarks[468];

// ตำแหน่งม่านตาภายในความกว้างของตา
const minX = Math.min(eyeLeftCorner.x, eyeRightCorner.x);
const maxX = Math.max(eyeLeftCorner.x, eyeRightCorner.x);

const eyeWidth = maxX - minX;

const irisRatio =
  (iris.x - minX) / eyeWidth;
  if (smoothIrisRatio === null) {
  smoothIrisRatio = irisRatio;
} else {
  smoothIrisRatio =
    SMOOTH_ALPHA * irisRatio +
    (1 - SMOOTH_ALPHA) * smoothIrisRatio;
}

const gazeRatio = smoothIrisRatio;
console.log("IRIS RATIO =", irisRatio);
if (
  calibrationMode &&
  calibrationTarget &&
  calibrationSamples[calibrationTarget]
) {
  calibrationSamples[calibrationTarget].push(irisRatio);
  console.log(
  "CALIBRATING:",
  calibrationTarget,
  "COUNT:",
  calibrationSamples[calibrationTarget].length,
  "RATIO:",
  irisRatio
);
}
const leftTop = landmarks[159];
const leftBottom = landmarks[145];
const leftCorner1 = landmarks[33];
const leftCorner2 = landmarks[133];

const rightTop = landmarks[386];
const rightBottom = landmarks[374];
const rightCorner1 = landmarks[362];
const rightCorner2 = landmarks[263];

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const leftEyeRatio =
  distance(leftTop, leftBottom) /
  distance(leftCorner1, leftCorner2);

const rightEyeRatio =
  distance(rightTop, rightBottom) /
  distance(rightCorner1, rightCorner2);

const eyeRatio =
  (leftEyeRatio + rightEyeRatio) / 2;

console.log("EYE RATIO =", eyeRatio);
const eyesClosed = eyeRatio < 0.15;
console.log("TEST CLOSED =", eyesClosed, "RATIO =", eyeRatio);
const nowBlink = Date.now();

if (eyesClosed) {
  if (blinkStartTime === null) {
    blinkStartTime = nowBlink;
    blinkTriggered = false;
  }

  const blinkDuration = nowBlink - blinkStartTime;

  if (
  blinkDuration >= BLINK_SELECT_MIN &&
  blinkDuration <= BLINK_SELECT_MAX &&
  !blinkTriggered &&
  nowBlink - lastSelectTime > SELECT_COOLDOWN
) {
    blinkTriggered = true;
    lastSelectTime = nowBlink;

    console.log("BLINK SELECT");

    if (window.clickFocusedGazeButton) {
      window.clickFocusedGazeButton();
    }
  }

} else {
  blinkStartTime = null;
  blinkTriggered = false;
}

let direction = "CENTER";

// ค่าเริ่มต้นสำหรับทดสอบ
if (gazeRatio < gazeLeftThreshold) {
  direction = "RIGHT";
}
else if (irisRatio > gazeRightThreshold) {
  direction = "LEFT";
}
else {
  direction = "CENTER";
}

// แสดงผลบนหน้าเว็บ
const directionElement =
  document.querySelector("#eye-direction");

if (directionElement) {
  directionElement.textContent = direction;
}
// ส่งค่าการมองเข้า EyeTalk
if (direction === candidateDirection) {
  candidateFrames++;
} else {
  candidateDirection = direction;
  candidateFrames = 1;
}

if (
  candidateFrames >= STABLE_FRAMES &&
  candidateDirection !== lastSentDirection
) {
  if (window.handleGaze) {
    window.handleGaze(candidateDirection, 0);
  }

  lastSentDirection = candidateDirection;
  candidateFrames = 0;
}
console.log(
  "👁️ Direction:",
  direction,
  "Ratio:",
  irisRatio.toFixed(2)
);
      const eyeDetected =
  document.querySelector("#eye-detected");

if (eyeDetected) {
  eyeDetected.textContent = eyesClosed ? "CLOSED" : "YES";
}

    }


    // ==========================
    // ไม่พบใบหน้า
    // ==========================

    else {

      const eyeDetected =
        document.querySelector(
          "#eye-detected"
        );

      if (eyeDetected) {
        eyeDetected.textContent = "NO";
      }

    }
  }

  requestAnimationFrame(detectFace);
}


window.startBrowserCamera =
  startBrowserCamera;
  window.addEventListener("DOMContentLoaded", () => {
  startBrowserCamera();
});
window.startBrowserCalibrationStep = function(target) {
  calibrationTarget = target;
  calibrationSamples[target] = [];
  calibrationMode = true;
};

window.stopBrowserCalibrationStep = function() {
  calibrationMode = false;
};

window.finishBrowserCalibration = function() {
  const avg = values =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  console.log("CALIBRATION SAMPLES =", {
  LEFT: calibrationSamples.LEFT.length,
  CENTER: calibrationSamples.CENTER.length,
  RIGHT: calibrationSamples.RIGHT.length
});
  if (
    calibrationSamples.LEFT.length === 5 ||
    calibrationSamples.CENTER.length === 5 ||
    calibrationSamples.RIGHT.length === 5
  ) {
    console.log("CALIBRATION COUNTS", {
  left: calibrationSamples.LEFT.length,
  center: calibrationSamples.CENTER.length,
  right: calibrationSamples.RIGHT.length
});
    return {
      success: false
    };
  }

  const leftAvg = avg(calibrationSamples.LEFT);
  const centerAvg = avg(calibrationSamples.CENTER);
  const rightAvg = avg(calibrationSamples.RIGHT);

  const low = Math.min(leftAvg, rightAvg);
  const high = Math.max(leftAvg, rightAvg);

  gazeLeftThreshold = (low + centerAvg) / 2;
  gazeRightThreshold = (centerAvg + high) / 2;

  calibrationMode = false;
  calibrationTarget = null;

  return {
    success: true,
    leftAvg,
    centerAvg,
    rightAvg,
    gazeLeftThreshold,
    gazeRightThreshold
  };
};