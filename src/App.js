import React, { useEffect, useState } from 'react';
import FishIdentifier from './components/FishIdentifier';
import './App.css';

function App() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Проверяем запущено ли приложение в standalone режиме (установлено)
    const isInStandaloneMode = () =>
      (window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator.standalone) ||
      document.referrer.includes('android-app://');
    
    setIsStandalone(isInStandaloneMode());
    
    // Для iOS показываем инструкцию по установке
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS && !isInStandaloneMode()) {
      setTimeout(() => {
        console.log('iOS устройство, можно предложить установку');
      }, 3000);
    }
  }, []);

  return (
    <div className={`app ${isStandalone ? 'standalone' : ''}`}>
      <header className="header">
        <h1>Fish Identifier</h1>
        <p>Определите вида рыбы по фотографии</p>
        {!isStandalone && (
          <div className="pwa-hint">
            ⚡ Установите приложение для быстрого доступа
          </div>
        )}
      </header>
      
      <main className="main">
        <FishIdentifier />
      </main>
      
      <footer className="footer">
        <p>PWA приложение • Работает оффлайн • Использует Teachable Machine</p>
        <p className="version">Версия 1.0.0</p>
      </footer>
    </div>
  );
}

export default App;