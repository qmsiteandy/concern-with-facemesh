const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

var eyes_criticalRatio = 0.8, mouth_criticalRatio = 1.2;
var eyes_average = 0, mouth_average = 0;
var concernValue = 0.0;

//#region 攝影機 & 呼叫運算
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({ image: videoElement });
    },
    width: 1280,
    height: 720
});
camera.start();
//#endregion

//#region 臉部特徵點判斷 & 模型
const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
});
faceMesh.setOptions({
    maxNumFaces: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(onResults);
//#endregion

function onResults(results) {
    //#region 畫出臉部Mesh  
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
        results.image, 0, 0, canvasElement.width, canvasElement.height);
    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 1 });
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#FF3030' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, { color: '#FF3030' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#30FF30' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, { color: '#30FF30' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#E0E0E0' });
            drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#E0E0E0' });
        }
    }
    canvasCtx.restore();
    //#endregion

    //#region 計算專注度
    if (results.multiFaceLandmarks) {
        var righteye_ratio = CalcDotsDistance(results, 145, 159) / CalcDotsDistance(results, 33, 133);
        var lefteye_ratio = CalcDotsDistance(results, 374, 386) / CalcDotsDistance(results, 263, 362);
        var mouth_ratio = CalcDotsDistance(results, 13, 14) / CalcDotsDistance(results, 308, 78);

        Average_judgify(results, (righteye_ratio + lefteye_ratio) / 2, mouth_ratio);
        valueJudgment((righteye_ratio + lefteye_ratio) / 2, mouth_ratio);
    }
    else {
        console.log("No Face");
        document.getElementById("concernValue").textContent = "No Face";
    }
    //#endregion
}

//#region 第一步：對比平常平均值
function valueJudgment(value_eye, value_mouth) {
    value_eye = value_eye / eyes_average;
    value_mouth = value_mouth / mouth_average;

    valueJudgment2(value_eye, value_mouth);
}



//#region 第二步：判斷是否有超出閾值，若超出則開始計時
var timer_eye = 0.0, timer_mouth = 0.0;
var time_criticalValue = 3000;
var isTimeCounting_eye = false, isTimeCounting_mouth = false;
var overTimeLimit_eye = false, overTimeLimit_mouth = false;
function valueJudgment2(value_eye, value_mouth) {
    //眼睛
    if (value_eye >= eyes_criticalRatio) {
        isTimeCounting_eye = false
        overTimeLimit_eye = false;
    }
    else if (value_eye < eyes_criticalRatio * eyes_average) {
        if (isTimeCounting_eye === false) {
            timer_eye = Date.now() + time_criticalValue;
            isTimeCounting_eye = true;
        }
        else {
            if (Date.now() > timer_eye) {
                overTimeLimit_eye = true
            }
        }
        if (overTimeLimit_eye === false) value_eye = eyes_criticalRatio;
    }

    //嘴巴
    if (value_mouth <= mouth_criticalRatio * mouth_average) {
        isTimeCounting_mouth = false
        overTimeLimit_mouth = false;
    }
    else if (value_mouth > mouth_criticalRatio) {
        if (isTimeCounting_mouth === false) {
            timer_mouth = Date.now() + time_criticalValue;
            isTimeCounting_mouth = true;
        }
        else {
            if (Date.now() > timer_mouth) {
                overTimeLimit_mouth = true
            }
        }
        if (overTimeLimit_mouth === false) value_mouth = mouth_criticalRatio;
    }
    valueAverager(value_eye, value_mouth);
}
//#endregion

//#region 第三步：因facemesh判斷頻率過快，將n筆數劇平均後輸出，達到穩定誤差作用
var calcFreq = 4   //收到N筆數值後，統整平均為一筆
var valueCounter = 0; var eyes_sum = 0.0, mouth_sum = 0.0;
function valueAverager(value_eyes, value_mouth) {

    valueCounter += 1;

    eyes_sum += value_eyes;
    mouth_sum += value_mouth;

    if (valueCounter >= calcFreq) {
        var eyes_value = eyes_sum / valueCounter;
        var mouth_value = mouth_sum / valueCounter;
        valueCounter = 0;
        eyes_sum = 0; mouth_sum = 0;

        valueCalculator(eyes_value, mouth_value);
    }
}
//#endregion

//#region 第四步：將眼部嘴部數值計算出真正專注數值
var weight_eyes = 0.7, weight_mouth = 0.3; //設定兩組數據的權重
function valueCalculator(value_eye, value_mouth) {
    concernValue = value_eye * weight_eyes + (2 - value_mouth) * weight_mouth;
    //console.log(concernValue);
    document.getElementById("concernValue").textContent = concernValue;
}
//#endregion

//計算兩點特徵點的距離
function CalcDotsDistance(results, A, B) {
    var distance = Math.sqrt(Math.pow((results.multiFaceLandmarks[0][A].x - results.multiFaceLandmarks[0][B].x), 2) + Math.pow((results.multiFaceLandmarks[0][A].y - results.multiFaceLandmarks[0][B].y), 2));
    return distance;
}

//個別化調整臨界值，當臉部距離改變時也會自動重新調整
var dataCount = 0;
var dataMax = 50;
var eyeDistance_average = 0;
function Average_judgify(results, eyesValue, mouthValue) {

    if (dataCount < dataMax) {
        eyes_average = eyes_average * (dataCount / (dataCount + 1)) + eyesValue / (dataCount + 1);
        mouth_average = mouth_average * (dataCount / (dataCount + 1)) + mouthValue / (dataCount + 1);

        eyeDistance_average = eyeDistance_average  * (dataCount / (dataCount + 1)) + CalcDotsDistance(results, 243, 463) / (dataCount + 1);
        dataCount += 1;
    }
    else
    {
        var newEyeDistance = CalcDotsDistance(results, 243, 463);
        if(newEyeDistance < 0.85 * eyeDistance_average || newEyeDistance > 1.15 * eyeDistance_average)
        {
            dataCount = 0;
        }
    }  
}
