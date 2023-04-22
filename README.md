# 課程專注度辨識功能

## 功能展示
![展示GIF](https://i.imgur.com/oVstZaI.gif)

## 使用工具
項目       |工具
----------|----------------
演算   | HTML、JS
人臉辨識     | [Mediapipe Facemesh](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)

## 演算邏輯
1. 使用  [Mediapipe Facemesh](https://developers.google.com/mediapipe/solutions/vision/face_landmarker) 套件辨識人臉 468 特徵點
2. 主要依靠眼部、嘴部開闔間距判斷
3. 對比平常平均值判斷是否有超出閾值，若超出則開始計路持續時間  
    >因為 facemesh 偶有較誇張誤差，因此設定持續時間以過濾誤差狀況
4. 當超出閾值的情況持續一段時間後，專注數值下降。
    >專注數值計算是採用眼睛開闔、嘴部開闔進行加權運算 (權重為多次測試調整所得)