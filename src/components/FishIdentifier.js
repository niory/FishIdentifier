import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as tmImage from '@teachablemachine/image';
import { fishNames, normalizeLabel, summarizePredictions } from '../prediction';
import './FishIdentifier.css';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function FishIdentifier() {
  const [model, setModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [imagePreview, setImagePreview] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraSupported = typeof navigator.mediaDevices?.getUserMedia === 'function';
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const modelPromise = useRef(null);
  const mounted = useRef(false);
  const cameraRequest = useRef(0);
  const analysisRequest = useRef(0);
  const busy = useRef(false);

  const stopCamera = useCallback(() => {
    cameraRequest.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraActive(false);
    setCameraPending(false);
    setCameraReady(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cameraRequest.current += 1;
      analysisRequest.current += 1;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setModelLoading(true);
    setError('');
    if (!modelPromise.current) {
      const base = process.env.PUBLIC_URL || '.';
      modelPromise.current = tmImage.load(`${base}/model/model.json`, `${base}/model/metadata.json`);
    }
    modelPromise.current.then(loaded => {
      if (!cancelled) setModel(loaded);
    }).catch(() => {
      if (!cancelled) {
        modelPromise.current = null;
        setError('Не удалось загрузить модель. Проверьте подключение и повторите попытку.');
      }
    }).finally(() => {
      if (!cancelled) setModelLoading(false);
    });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      const request = cameraRequest.current;
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {
        if (mounted.current && request === cameraRequest.current) {
          stopCamera();
          setError('Не удалось показать видео. Попробуйте загрузить фото.');
        }
      });
    }
  }, [cameraActive, stopCamera]);

  const startCamera = async () => {
    if (busy.current || cameraPending) return;
    stopCamera();
    setError('');
    setCameraPending(true);
    const request = cameraRequest.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      if (!mounted.current || request !== cameraRequest.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      if (mounted.current && request === cameraRequest.current) {
        setError(err.name === 'NotAllowedError'
          ? 'Доступ к камере запрещён. Разрешите доступ в браузере или загрузите фото.'
          : 'Не удалось запустить камеру. Попробуйте загрузить фото.');
      }
    } finally {
      if (mounted.current && request === cameraRequest.current) setCameraPending(false);
    }
  };

  const analyzeImage = async (src, request) => {
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });
      const result = summarizePredictions(await model.predict(img));
      if (mounted.current && request === analysisRequest.current) setPrediction(result);
    } catch {
      if (mounted.current && request === analysisRequest.current) {
        setError('Не удалось прочитать или проанализировать изображение. Выберите другое фото.');
      }
    } finally {
      if (mounted.current && request === analysisRequest.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  };

  const beginAnalysis = () => {
    busy.current = true;
    setLoading(true);
    setError('');
    setPrediction(null);
    return ++analysisRequest.current;
  };

  const selectFile = file => {
    if (!file || !model || busy.current || cameraPending) return;
    if (!file.type.startsWith('image/')) {
      setError('Выберите файл изображения.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Размер изображения не должен превышать 20 МБ.');
      return;
    }
    stopCamera();
    const request = beginAnalysis();
    const reader = new FileReader();
    reader.onload = () => {
      if (!mounted.current || request !== analysisRequest.current) return;
      setImagePreview(reader.result);
      analyzeImage(reader.result, request);
    };
    reader.onerror = () => {
      if (!mounted.current || request !== analysisRequest.current) return;
      busy.current = false;
      setLoading(false);
      setError('Не удалось прочитать файл. Попробуйте другое фото.');
    };
    reader.readAsDataURL(file);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!cameraReady || !video?.videoWidth || !video.videoHeight || busy.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const photo = canvas.toDataURL('image/jpeg');
      stopCamera();
      setImagePreview(photo);
      analyzeImage(photo, beginAnalysis());
    } catch {
      setError('Ошибка при съёмке фото. Попробуйте ещё раз.');
    }
  };

  const reset = () => {
    stopCamera();
    setImagePreview(null);
    setPrediction(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fish-identifier">
      {error && <div className="error-message" role="alert">{error}</div>}
      {modelLoading && <div className="model-loading" role="status"><div className="spinner" />Загружаем модель…</div>}
      {!modelLoading && !model && <button className="btn primary" onClick={() => setAttempt(value => value + 1)}>Повторить загрузку</button>}
      {model && <>
        <div className="upload-section">
          {cameraActive ? (
            <div className="camera-preview">
              <video ref={videoRef} autoPlay playsInline muted className="camera-video"
                onLoadedData={() => setCameraReady(true)} />
              <div className="camera-controls">
                <button onClick={takePhoto} disabled={!cameraReady || loading} className="btn capture-btn">📸 Сделать фото</button>
                <button onClick={stopCamera} className="btn cancel-btn">✖ Отмена</button>
              </div>
            </div>
          ) : (
            <div className="upload-area" role="button" tabIndex={loading || cameraPending ? -1 : 0}
              aria-label="Загрузить изображение" aria-disabled={loading || cameraPending}
              onClick={() => { if (!busy.current && !cameraPending) fileInputRef.current?.click(); }}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !busy.current && !cameraPending) { e.preventDefault(); fileInputRef.current?.click(); } }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }}>
              {imagePreview ? <img src={imagePreview} alt="Выбранное изображение" className="preview-image" /> :
                <div className="upload-placeholder"><div className="upload-icon">🐟</div>
                  <h3>Идентификатор рыб</h3><p>Загрузите фото или сделайте снимок</p>
                  <p>Модель знает сома, гурами, окуня и щуку.</p>
                  {!cameraSupported && <p className="no-camera-warning">Камера недоступна. Используйте загрузку файла.</p>}
                </div>}
            </div>
          )}
          <input type="file" ref={fileInputRef} accept="image/*" aria-label="Фото рыбы" className="file-input"
            disabled={loading || cameraPending} onChange={e => { selectFile(e.target.files[0]); e.target.value = ''; }} />
          <div className="controls">
            {!cameraActive && <>
              <button onClick={() => fileInputRef.current?.click()} disabled={loading || cameraPending} className="btn primary">📁 Выбрать фото</button>
              {cameraSupported && <button onClick={startCamera} disabled={loading || cameraPending} className="btn camera-btn">{cameraPending ? 'Открываем камеру…' : '📷 Сделать фото'}</button>}
            </>}
            {!cameraActive && <button onClick={reset} className="btn secondary" disabled={loading || (!imagePreview && !cameraPending)}>
              {cameraPending ? '✖ Отмена' : '🗑️ Сбросить'}
            </button>}
          </div>
        </div>
        {loading && <div className="loading-overlay" role="status"><div className="spinner" />Анализируем изображение…</div>}
        {prediction && !loading && !cameraActive && <div className="result-section" aria-live="polite" data-uncertain={prediction.uncertain}>
          <div className="result-card"><div className="result-icon">{prediction.uncertain ? '❔' : '🎯'}</div>
            <h2 className="result-title">{prediction.uncertain ? 'Не удалось уверенно определить рыбу' : <>Предположительно <span className="fish-name">{prediction.translatedName}</span></>}</h2>
            <p className="confidence">Ближайший класс: {prediction.translatedName}. Оценка модели: <span>{(prediction.probability * 100).toFixed(2)}%</span></p>
            <p>Оценка модели не гарантирует правильное определение. Попробуйте чёткое фото рыбы целиком.</p>
            <details><summary>Все оценки модели</summary>
              {prediction.scores.map(score => <p key={score.className} className="prediction-score" data-class={score.className} data-probability={score.probability}>
                {fishNames[normalizeLabel(score.className)] || score.className}: {(score.probability * 100).toFixed(2)}%
              </p>)}
            </details>
          </div>
        </div>}
      </>}
    </div>
  );
}
