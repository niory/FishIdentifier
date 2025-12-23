import React, { useState, useRef, useEffect } from 'react';
import './FishIdentifier.css';
import * as tmImage from '@teachablemachine/image';

const FishIdentifier = () => {
  // Состояния
  const [imagePreview, setImagePreview] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [model, setModel] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  
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

   // Проверка доступности камеры при загрузке
  useEffect(() => {
    loadModel();
    checkCameraAvailability();
    
    return () => {
      stopCamera();
    };
  }, []);

  // Проверяем, есть ли камера у устройства
  const checkCameraAvailability = () => {
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    setHasCamera(hasMediaDevices);
  };

  // Функция для перевода названия
  const translateFishName = (englishName) => {
    const lowerName = englishName.toLowerCase().trim();
    
    if (fishNames[lowerName]) {
      return fishNames[lowerName];
    }
    
    for (const [key, value] of Object.entries(fishNames)) {
      if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
        return value;
      }
    }
    
    return englishName;
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
      setError('');
    } catch (error) {
      console.error('Ошибка загрузки модели:', error);
      setError('Не удалось загрузить модель. Проверьте файлы модели.');
    } finally {
      setLoading(false);
    }
  };

  // Остановка камеры
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Запуск камеры
  const startCamera = async () => {
    try {
      if (!hasCamera) {
        setError('Камера не поддерживается вашим устройством');
        return false;
      }
      
      setError('');
      stopCamera();
      
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      // На компьютере используем обычную камеру
      if (!/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
        constraints.video.facingMode = 'user';
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
      
      return true;
    } catch (error) {
      console.error('Ошибка камеры:', error);
      
      let errorMessage = 'Не удалось запустить камеру. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Разрешите доступ к камере в настройках браузера.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'Камера не найдена.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Камера уже используется другим приложением.';
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
      return false;
    }
  };

  // Сделать фото
  const takePhoto = () => {
    if (!videoRef.current || !cameraActive) {
      setError('Камера не активна');
      return;
    }
    
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      stopCamera();
      setImagePreview(photoDataUrl);
      analyzeImage(photoDataUrl);
      
    } catch (error) {
      console.error('Ошибка при создании фото:', error);
      setError('Не удалось сделать фото');
    }
  };

  // Анализ изображения
  const analyzeImage = async (imageSrc) => {
    if (!model) {
      setError('Модель не загружена');
      return null;
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
      
      const topPrediction = predictions.reduce((prev, current) => 
        (prev.probability > current.probability) ? prev : current
      );
      
      const probability = (topPrediction.probability * 100).toFixed(2);
      const translatedName = translateFishName(topPrediction.className);
      
      const result = {
        className: topPrediction.className,
        translatedName: translatedName,
        probability: probability
      };
      
      setPrediction(result);
      return result;
      
    } catch (error) {
      console.error('Ошибка анализа:', error);
      setError('Ошибка при анализе изображения');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Обработчик выбора файла
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение (JPG, PNG, WebP)');
      return;
    }
    
    if (!isModelLoaded) {
      setError('Модель еще загружается');
      return;
    }
    
    setError('');
    stopCamera();
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      setImagePreview(e.target.result);
      await analyzeImage(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Обработчик кнопки камеры
  const handleCameraClick = async () => {
    if (!isModelLoaded) {
      setError('Модель еще загружается');
      return;
    }
    
    setError('');
    setImagePreview(null);
    setPrediction(null);
    
    const success = await startCamera();
    if (!success && hasCamera) {
      // Если камера есть, но не запустилась — предлагаем загрузить файл
      setTimeout(() => {
        setError('Не удалось запустить камеру. Попробуйте загрузить фото файлом.');
      }, 500);
    }
  };

  // Сброс
  const handleReset = () => {
    stopCamera();
    setImagePreview(null);
    setPrediction(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Перетаскивание файлов
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      stopCamera();
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      handleFileSelect({ target: { files: dataTransfer.files } });
    }
  };

  // Рендер результата
  const renderResult = () => {
    if (!prediction) return null;
    
    const { className, translatedName, probability } = prediction;
    const confidence = parseFloat(probability);
    
    if (className.toLowerCase() === 'unknown' || confidence < 50) {
      return (
        <div className="unknown-result">
          <div className="unknown-icon">🤔</div>
          <h2>Сомневаюсь, что на картинке знакомая мне рыба</h2>
          <p className="unknown-text">
            Вероятность: <span className="probability-low">{probability}%</span>
          </p>
          <p className="suggestion">Попробуйте другую картинку</p>
        </div>
      );
    }
    
    return (
      <div className="result-card">
        <div className="result-icon">🎯</div>
        <h2 className="result-title">
          На картинке <span className="fish-name">{translatedName}</span>
        </h2>
        <p className="confidence">
          с вероятностью <span className="probability-high">{probability}%</span>
        </p>
        
        {confidence > 80 && (
          <div className="high-confidence">
            <span className="checkmark">✓</span>
            <span>Высокая уверенность</span>
          </div>
        )}
        
        <div className="confidence-meter">
          <div 
            className="meter-fill"
            style={{ width: `${confidence}%` }}
          ></div>
          <div className="meter-labels">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fish-identifier">
      {/* Загрузка модели */}
      {!isModelLoaded && (
        <div className="model-loading">
          <div className="spinner"></div>
          <h3>Загружаем модель идентификации...</h3>
          <p>Это займет несколько секунд</p>
        </div>
      )}

      {/* Основной интерфейс */}
      <div className="upload-section" style={{ 
        display: !isModelLoaded ? 'none' : 'block' 
      }}>
        {/* Камера */}
        {cameraActive ? (
          <div className="camera-preview">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="camera-video"
            />
            <div className="camera-controls">
              <button 
                onClick={takePhoto}
                className="btn capture-btn"
              >
                📸 Сделать фото
              </button>
              <button 
                onClick={stopCamera}
                className="btn cancel-btn"
              >
                ✖ Отмена
              </button>
            </div>
          </div>
        ) : (
          /* Область загрузки */
          <div 
            className="upload-area"
            onClick={() => !cameraActive && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {imagePreview ? (
              <div className="image-container">
                <img src={imagePreview} alt="Предпросмотр" className="preview-image" />
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon">🐟</div>
                <h3>Идентификатор рыб</h3>
                <p>Загрузите фото или сделайте снимок</p>
                {!hasCamera && (
                  <p className="no-camera-warning">
                    ⚠️ Камера не обнаружена. Используйте загрузку файла.
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
        
        {/* Кнопки управления */}
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
              
              {hasCamera && (
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

      {/* Индикатор загрузки */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p className="loading-text">Анализируем изображение...</p>
          <p className="loading-subtext">Определяю вид рыбы</p>
        </div>
      )}

      {/* Результат */}
      {prediction && !loading && !cameraActive && (
        <div className="result-section">
          {renderResult()}
        </div>
      )}

      {/* Инструкции */}
      {!imagePreview && !loading && !cameraActive && isModelLoaded && (
        <div className="instructions">
          <h3>Как определить рыбу:</h3>
          <div className="steps">
            {hasCamera && (
              <div className="step">
                <div className="step-icon">📷</div>
                <div className="step-content">
                  <h4>Сфотографируйте</h4>
                  <p>Наведите камеру на рыбу и сделайте снимок</p>
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
            <div className="step">
              <div className="step-icon">🤖</div>
              <div className="step-content">
                <h4>Получите результат</h4>
                <p>ИИ определит вид за несколько секунд</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FishIdentifier;