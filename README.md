# Умная парковка

Курсовой проект: симуляция работы парковки для легковых и грузовых автомобилей.

## Запуск backend

```powershell
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend запускается на `http://127.0.0.1:8000`.

Код backend находится в папке `backend`:

- `app.py` создает FastAPI-приложение;
- `routes.py` содержит API-эндпоинты;
- `parking.py` хранит состояние и логику симуляции;
- `models.py` содержит модели входных данных.

## Запуск frontend

```powershell
cd my-app
npm install
npm run dev
```

Frontend запускается через Vite и обращается к FastAPI по адресу `http://127.0.0.1:8000`.

## CSV

Файл расписания должен иметь поля:

```csv
type,arrival,hours
car,1,3
truck,2,5
```
