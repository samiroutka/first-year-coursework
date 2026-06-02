# Умная парковка

Курсовой проект: симуляция работы парковки для легковых и грузовых автомобилей.

## Запуск FastAPI

Перейди в папку backend-части:

```powershell
cd fastapi
```

Запусти сервер:

```powershell
uvicorn main:app --reload
```

Сервер будет доступен на `http://127.0.0.1:8000`.

## Структура FastAPI

- `fastapi/main.py` точка входа для запуска сервера;
- `fastapi/app.py` создает FastAPI-приложение;
- `fastapi/routes.py` содержит API-эндпоинты;
- `fastapi/parking.py` хранит состояние и логику симуляции;
- `fastapi/models.py` содержит модели входных данных.

## Запуск React

```powershell
cd react
npm install
npm run dev
```

Frontend обращается к FastAPI по адресу `http://127.0.0.1:8000`.

## CSV

Файл расписания должен иметь поля:

```csv
type,arrival,hours
car,1,3
truck,2,5
```
