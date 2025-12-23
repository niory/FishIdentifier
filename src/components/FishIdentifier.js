import React, { useState, useRef, useEffect } from 'react';
import './FishIdentifier.css';
import * as tmImage from '@teachablemachine/image';

const FishIdentifier = () => {
  const [imagePreview, setImagePreview] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [model, setModel] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false); // ← ДОБАВЛЕНО
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Словарь для перевода названий рыб с английского на русский
  const fishNames = {
    'Gourami': 'гурами',
    'Catfish': 'сом',
    'Perch': 'окунь',
    'northern pike ':'щука',  
    'unknown': 'неизвестная рыба'
  };

   // Инициализация
  useEffect(() => {
    loadModel();
    checkCameraSupport();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Проверка поддержки камеры
  const checkCameraSupport = () => {
    const hasMediaDevices = 'mediaDevices' in navigator;
    const hasGetUserMedia = hasMediaDevices && 'getUserMedia' in navigator.mediaDevices;
    
    console.log('Camera check:', { hasMediaDevices, hasGetUserMedia });
    setCameraSupported(hasGetUserMedia);
  };

  // Загрузка модели
  const loadModel = async () => {
    try {
      setLoading(true);
      const modelURL = process.env.PUBLIC_URL + '/model/model.json';
      const metadataURL = process.env.PUBLIC_URL + '/model/metadata.json';
      
      const loadedModel = await tmImage.load(modelURL, metadataURL);
      setModel(loadedModel);
      setIsModelLoaded(true);
      console.log('Model loaded successfully');
    } catch (error) {
      console.error('Model load error:', error);
      setError('Не удалось загрузить модель');
    } finally {
      setLoading(false);
    }
  };

  // Старт камеры (упрощенный)
  const startCamera = async () => {
    try {
      setError('');
      stopCamera();
      
      // Простые настройки
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        return true;
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError(`Ошибка камеры: ${err.message}`);
      return false;
    }
  };

  // Остановка камеры
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Сделать фото
  const takePhoto = () => {
    if (!videoRef.current || !streamRef.current) {
      setError('Камера не активна');
      return;
    }
    
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const photo = canvas.toDataURL('image/jpeg');
      
      stopCamera();
      setImagePreview(photo);
      analyzeImage(photo);
      
    } catch (err) {
      setError('Ошибка при съемке фото');
    }
  };

  // Анализ изображения
  const analyzeImage = async (imageSrc) => {
    if (!model) {
      setError('Модель не загружена');
      return;
    }
    
    setLoading(true);
    setPrediction(null);
    
    try {
      const img = new Image();
      img.src = imageSrc;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      const predictions = await model.predict(img);
      const topPrediction = predictions.reduce((a, b) => 
        a.probability > b.probability ? a : b
      );
      
      const probability = (topPrediction.probability * 100).toFixed(2);
      const translatedName = fishNames[topPrediction.className?.toLowerCase()] || topPrediction.className;
      
      setPrediction({
        className: topPrediction.className,
        translatedName: translatedName,
        probability: probability
      });
      
    } catch (err) {
      setError('Ошибка анализа');
    } finally {
      setLoading(false);
    }
  };

  // Обработчик файла
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    stopCamera();
    setError('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      analyzeImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Кнопка камеры
  const handleCameraClick = async () => {
    if (!cameraSupported) {
      setError('Камера не поддерживается в этом браузере');
      return;
    }
    
    const success = await startCamera();
    if (!success) {
      setError('Не удалось запустить камеру. Попробуйте загрузить фото.');
    }
  };

  // Сброс
  const handleReset = () => {
    stopCamera();
    setImagePreview(null);
    setPrediction(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Перетаскивание
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      handleFileSelect({ target: { files: dt.files } });
    }
  };

  return (
    <div className="fish-identifier">
      {/* Загрузка модели */}
      {!isModelLoaded && (
        <div className="model-loading">
          <div className="spinner"></div>
          <h3>Загружаем модель...</h3>
        </div>
      )}

      {/* Основной интерфейс */}
      <div className="upload-section" style={{ display: isModelLoaded ? 'block' : 'none' }}>
        
        {/* Камера */}
        {cameraActive ? (
          <div className="camera-preview">
            <video ref={videoRef} autoPlay playsInline className="camera-video" />
            <div className="camera-controls">
              <button onClick={takePhoto} className="btn capture-btn">
                📸 Сделать фото
              </button>
              <button onClick={stopCamera} className="btn cancel-btn">
                ✖ Отмена
              </button>
            </div>
          </div>
        ) : (
          /* Область загрузки */
          <div 
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="preview-image" />
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon">🐟</div>
                <h3>Идентификатор рыб</h3>
                <p>Загрузите фото или сделайте снимок</p>
                {!cameraSupported && (
                  <p className="no-camera-warning">
                    ⚠️ Камера недоступна. Используйте загрузку файла.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="file-input"
        />
        
        {error && <div className="error-message">{error}</div>}
        
        {/* Кнопки */}
        <div className="controls">
          {!cameraActive && (
            <>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="btn primary"
                disabled={loading}
              >
                📁 Выбрать фото
              </button>
              
              {cameraSupported && (
                <button 
                  onClick={handleCameraClick}
                  className="btn camera-btn"
                  disabled={loading}
                >
                  📷 Сделать фото
                </button>
              )}
            </>
          )}
          
          <button 
            onClick={handleReset}
            className="btn secondary"
            disabled={(!imagePreview && !cameraActive) || loading}
          >
            {cameraActive ? '✖ Отмена' : '🗑️ Сбросить'}
          </button>
        </div>
      </div>

      {/* Загрузка */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Анализируем изображение...</p>
        </div>
      )}

      {/* Результат */}
      {prediction && !loading && !cameraActive && (
        <div className="result-section">
          <div className="result-card">
            <div className="result-icon">🎯</div>
            <h2 className="result-title">
              На картинке <span className="fish-name">{prediction.translatedName}</span>
            </h2>
            <p className="confidence">
              с вероятностью <span className="probability-high">{prediction.probability}%</span>
            </p>
          </div>
        </div>
      )}

      {/* Инструкции */}
      {!imagePreview && !loading && !cameraActive && isModelLoaded && (
        <div className="instructions">
          <h3>Как определить рыбу:</h3>
          <div className="steps">
            {cameraSupported && (
              <div className="step">
                <div className="step-icon">📷</div>
                <div className="step-content">
                  <h4>Сфотографируйте</h4>
                  <p>Наведите камеру на рыбу</p>
                </div>
              </div>
            )}
            <div className="step">
              <div className="step-icon">📁</div>
              <div className="step-content">
                <h4>Загрузите фото</h4>
                <p>Выберите фото из галереи</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
// В конец файла FishIdentifier.js добавьте:
console.log('CSS loaded:', document.styleSheets.length > 0);
console.log('Component styles:', document.querySelectorAll('style').length);
export default FishIdentifier;