import React, { useState, useRef, useEffect } from 'react';
import './FishIdentifier.css';
import * as tmImage from '@teachablemachine/image';

const FishIdentifier = () => {
  // Состояния
  const [imagePreview, setImagePreview] = useState(null);
  const [prediction, setPrediction] = useState(null); // Теперь только один результат
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [model, setModel] = useState(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  
  const fileInputRef = useRef(null);

  // Словарь для перевода названий рыб с английского на русский
  const fishNames = {
    'Gourami': 'гурами',
    'Catfish': 'сом',
    'Perch': 'окунь',
    'northern pike ':'щука',  
    'unknown': 'неизвестная рыба'
  };

  // Функция для перевода названия
  const translateFishName = (englishName) => {
    // Приводим к нижнему регистру и убираем лишние пробелы
    const lowerName = englishName.toLowerCase().trim();
    
    // Пробуем найти точное совпадение
    if (fishNames[lowerName]) {
      return fishNames[lowerName];
    }
    
    // Пробуем найти частичное совпадение (если название состоит из нескольких слов)
    for (const [key, value] of Object.entries(fishNames)) {
      if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
        return value;
      }
    }
    
    // Если не нашли - возвращаем оригинал
    console.log('Не найден перевод для:', englishName);
    console.log('Доступные ключи:', Object.keys(fishNames));
    return englishName;
  };

  // Загрузка модели при старте
  useEffect(() => {
    loadModel();
  }, []);

  // Функция загрузки модели Teachable Machine
  const loadModel = async () => {
    try {
      setLoading(true);
      // Пути к файлам модели (должны быть в public/model/)
      const modelURL = process.env.PUBLIC_URL + '/model/model.json';
      const metadataURL = process.env.PUBLIC_URL + '/model/metadata.json';
      
      console.log('Загружаю модель с:', modelURL);
      
      const loadedModel = await tmImage.load(modelURL, metadataURL);
      setModel(loadedModel);
      setIsModelLoaded(true);
      console.log('Модель загружена успешно!');
      setError('');
    } catch (error) {
      console.error('Ошибка загрузки модели:', error);
      setError('Не удалось загрузить модель. Проверьте файлы в папке public/model/');
    } finally {
      setLoading(false);
    }
  };

  // Анализ изображения с помощью модели
  const analyzeImage = async (imageSrc) => {
    if (!model) {
      setError('Модель не загружена');
      return null;
    }
    
    try {
      // Создаем изображение
      const img = new Image();
      img.src = imageSrc;
      
      // Ждем загрузки
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      // Делаем предсказание
      const predictions = await model.predict(img);
      
      // Берем самый вероятный результат
      const topPrediction = predictions.reduce((prev, current) => 
        (prev.probability > current.probability) ? prev : current
      );
      
      const probability = (topPrediction.probability * 100).toFixed(2);
      const translatedName = translateFishName(topPrediction.className);
      
      return {
        className: topPrediction.className,
        translatedName: translatedName,
        probability: probability
      };
      
    } catch (error) {
      console.error('Ошибка анализа:', error);
      setError('Ошибка при анализе изображения');
      return null;
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
      setError('Модель еще загружается. Подождите...');
      return;
    }
    
    setError('');
    setPrediction(null); // Сбрасываем предыдущий результат
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      setImagePreview(e.target.result);
      setLoading(true);
      
      try {
        const result = await analyzeImage(e.target.result);
        setPrediction(result);
        
        if (!result) {
          setError('Не удалось проанализировать изображение');
        }
      } catch (err) {
        console.error('Ошибка:', err);
        setError('Ошибка при анализе изображения');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Сброс
  const handleReset = () => {
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
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      handleFileSelect({ target: { files: dataTransfer.files } });
    }
  };

  // Функция для отображения результата
  const renderResult = () => {
    if (!prediction) return null;
    
    const { className, translatedName, probability } = prediction;
    const confidence = parseFloat(probability);
    
    // Если это unknown или уверенность низкая
    if (className.toLowerCase() === 'unknown' || confidence < 50) {
      return (
        <div className="unknown-result">
          <h2>Сомневаюсь, что на картинке знакомая мне рыба...</h2>
          <p className="unknown-text">
            Точность: <span className="probability-low">{probability}%</span>
          </p>
          <p className="suggestion">Попробуйте другую картинку, где рыбу видно более четко</p>
        </div>
      );
    }
    
    // Нормальный результат
    return (
      <div className="result-card">
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
      {/* Индикатор загрузки модели */}
      {!isModelLoaded && (
        <div className="model-loading">
          <div className="spinner"></div>
          <h3>Загружаею модель идентификации рыб...</h3>
          <p>Это займет несколько секунд</p>
          {error && <p className="error-text">{error}</p>}
        </div>
      )}

      {/* Основной интерфейс */}
      <div className="upload-section" style={{ 
        display: !isModelLoaded ? 'none' : 'block' 
      }}>
        <div 
          className="upload-area"
          onClick={() => fileInputRef.current?.click()}
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
              <h3>Загрузите фото рыбы</h3>
              <p>Перетащите сюда или нажмите для выбора</p>
              <p className="formats">JPG, PNG, WebP</p>
            </div>
          )}
        </div>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          className="file-input"
        />
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="controls">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="btn primary"
            disabled={loading}
          >
            Загрузить фото
          </button>
          <button 
            onClick={handleReset}
            className="btn secondary"
            disabled={!imagePreview || loading}
          >
            Сбросить
          </button>
        </div>
      </div>

      {/* Индикатор анализа */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p className="loading-text">Анализирую изображение...</p>
          <p className="loading-subtext">Определяю вид рыбы...</p>
        </div>
      )}

      {/* Результат */}
      {prediction && !loading && (
        <div className="result-section">
          {renderResult()}
        </div>
      )}

      {/* Инструкции */}
      {!imagePreview && !loading && isModelLoaded && (
        <div className="instructions">
          <h3>Как определить рыбу по фото:</h3>
          <div className="steps">
            <div className="step">
              <div className="step-icon">1</div>
              <div className="step-content">
                <h4>Загрузите фотографию рыбы</h4>
                <p>Или сфотографируйте*</p>
              </div>
            </div>
            <div className="step">
              <div className="step-icon">2</div>
              <div className="step-content">
                <h4>Дайте подумать...</h4>
                <p>Я определю вид за пару секунд!</p>
              </div>
            </div>
            <div className="step">
              <div className="step-icon">3</div>
              <div className="step-content">
                <h4>Получите результат</h4>
                <p>Узнайте название рыбы и точность определения</p>
              </div>
            </div>
          </div>
          
          <div className="tips">
            <h4>Советы для лучшего результата:</h4>
            <ul>
              <li>Фотографируйте рыбу сбоку, чтобы видна была форма тела</li>
              <li>Убедитесь, что рыба хорошо освещена</li>
              <li>Старайтесь, чтобы рыба занимала большую часть кадра</li>
              <li>Избегайте размытых и темных фото</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default FishIdentifier;