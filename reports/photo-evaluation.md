# Проверка модели на фотографиях

Дата: 2026-11-05T15:26:52.618Z

Верный первый класс: 7/8. Уверенные верные ответы: 7. Уверенные ошибки: 0. Отказы: 1.

Это небольшая подборка из интернета, не оценка общей точности. Состав обучающей выборки неизвестен. Сом, гурами и окунь проверены на двух разных видах внутри широкой категории; метаданные модели не уточняют виды обучения.

| Фото | Ожидание | Ответ | Оценка | Решение |
|---|---|---|---:|---|
| [catfish-wels](https://commons.wikimedia.org/wiki/File:Silurus_glanis_02.jpg) | Catfish | Catfish | 99.99% | Верно |
| [catfish-channel](https://commons.wikimedia.org/wiki/File:Channel_Catfish_(Ictalurus_punctatus)_white_background.jpg) | Catfish | Catfish | 99.99% | Верно |
| [gourami-three-spot](https://commons.wikimedia.org/wiki/File:Trichogster_trichopterus_13.jpg) | Gourami | Gourami | 99.91% | Верно |
| [gourami-pearl](https://commons.wikimedia.org/wiki/File:Trichopodus_leerii_Natural_History_Museum_University_of_Pisa.jpg) | Gourami | northern pike | 76.29% | Отказ |
| [perch-european](https://commons.wikimedia.org/wiki/File:Perca_fluviatilis_-_Perche_commune_-_European_perch_(cropped).jpg) | Perch | Perch | 100.00% | Верно |
| [perch-yellow](https://commons.wikimedia.org/wiki/File:Yellow_Perch_(Perca_flavescens)_(cropped).jpg) | Perch | Perch | 99.78% | Верно |
| [pike-aquarium](https://commons.wikimedia.org/wiki/File:Esox_lucius_ZOO_1.jpg) | northern pike | northern pike | 99.98% | Верно |
| [pike-river](https://commons.wikimedia.org/wiki/File:Esox_lucius.jpg) | northern pike | northern pike | 99.99% | Верно |
| [control-react-logo](../public/logo192.png) | unknown | unknown | 100.00% | Отказ |

Пороги интерфейса: оценка не ниже 80%, отрыв от второго класса не меньше 15 процентных пунктов, класс unknown всегда означает отказ. Эти пороги не калиброваны на контрольной выборке.
